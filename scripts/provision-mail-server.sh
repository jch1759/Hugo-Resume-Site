#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${DOMAIN:-joshuacharrison.com}"
MAIL_HOST="${MAIL_HOST:-mail.${DOMAIN}}"
MAILBOX_USER="${MAILBOX_USER:-contact}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root, for example: sudo DOMAIN=${DOMAIN} MAIL_HOST=${MAIL_HOST} $0" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

hostnamectl set-hostname "${MAIL_HOST}"
grep -q "${MAIL_HOST}" /etc/hosts || echo "127.0.1.1 ${MAIL_HOST} mail" >> /etc/hosts
echo "${DOMAIN}" > /etc/mailname

apt update
apt install -y \
  postfix dovecot-core dovecot-imapd dovecot-lmtpd opendkim opendkim-tools \
  rspamd certbot ufw mailutils

ufw allow OpenSSH
ufw allow 25/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 587/tcp
ufw allow 993/tcp

if ! id "${MAILBOX_USER}" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "${MAILBOX_USER}"
  echo "Created ${MAILBOX_USER}. Set an IMAP password with: sudo passwd ${MAILBOX_USER}"
fi

if [[ ! -d "/etc/letsencrypt/live/${MAIL_HOST}" ]]; then
  certbot certonly --standalone -d "${MAIL_HOST}"
fi

postconf -e "myhostname = ${MAIL_HOST}"
postconf -e "mydomain = ${DOMAIN}"
postconf -e "myorigin = /etc/mailname"
postconf -e "mydestination = \$myhostname, localhost.\$mydomain, localhost, \$mydomain"
postconf -e "home_mailbox = Maildir/"
postconf -e "smtpd_tls_cert_file = /etc/letsencrypt/live/${MAIL_HOST}/fullchain.pem"
postconf -e "smtpd_tls_key_file = /etc/letsencrypt/live/${MAIL_HOST}/privkey.pem"
postconf -e "smtpd_tls_security_level = may"
postconf -e "smtp_tls_security_level = may"
postconf -e "smtpd_sasl_type = dovecot"
postconf -e "smtpd_sasl_path = private/auth"
postconf -e "smtpd_sasl_auth_enable = yes"
postconf -e "smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination"
postconf -e "milter_default_action = accept"
postconf -e "milter_protocol = 6"
postconf -e "smtpd_milters = inet:localhost:8891"
postconf -e "non_smtpd_milters = inet:localhost:8891"

if ! grep -q "^submission inet" /etc/postfix/master.cf; then
  cat >> /etc/postfix/master.cf <<'MASTER_CF'
submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
MASTER_CF
fi

cat > /etc/dovecot/conf.d/99-resume-site-mail.conf <<DOVECOT_CONF
mail_location = maildir:~/Maildir
ssl = required
ssl_cert = </etc/letsencrypt/live/${MAIL_HOST}/fullchain.pem
ssl_key = </etc/letsencrypt/live/${MAIL_HOST}/privkey.pem

service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}
DOVECOT_CONF

install -d -o opendkim -g opendkim "/etc/opendkim/keys/${DOMAIN}"
if [[ ! -f "/etc/opendkim/keys/${DOMAIN}/default.private" ]]; then
  opendkim-genkey -b 2048 -d "${DOMAIN}" -s default -D "/etc/opendkim/keys/${DOMAIN}"
  chown -R opendkim:opendkim "/etc/opendkim/keys/${DOMAIN}"
fi

cat > /etc/opendkim.conf <<OPENDKIM_CONF
Syslog                  yes
UMask                   002
Canonicalization        relaxed/simple
Mode                    sv
SubDomains              no
Socket                  inet:8891@localhost
PidFile                 /run/opendkim/opendkim.pid
OversignHeaders         From
TrustAnchorFile         /usr/share/dns/root.key
KeyTable                refile:/etc/opendkim/key.table
SigningTable            refile:/etc/opendkim/signing.table
ExternalIgnoreList      /etc/opendkim/trusted.hosts
InternalHosts           /etc/opendkim/trusted.hosts
OPENDKIM_CONF

cat > /etc/opendkim/key.table <<OPENDKIM_KEY_TABLE
default._domainkey.${DOMAIN} ${DOMAIN}:default:/etc/opendkim/keys/${DOMAIN}/default.private
OPENDKIM_KEY_TABLE

cat > /etc/opendkim/signing.table <<OPENDKIM_SIGNING_TABLE
*@${DOMAIN} default._domainkey.${DOMAIN}
OPENDKIM_SIGNING_TABLE

cat > /etc/opendkim/trusted.hosts <<OPENDKIM_TRUSTED_HOSTS
127.0.0.1
::1
localhost
${MAIL_HOST}
${DOMAIN}
OPENDKIM_TRUSTED_HOSTS

systemctl restart postfix dovecot opendkim rspamd
systemctl enable postfix dovecot opendkim rspamd

echo
echo "Mail services configured."
echo "Publish this DKIM TXT record:"
cat "/etc/opendkim/keys/${DOMAIN}/default.txt"
echo
echo "Remember to set DNS MX/SPF/DMARC and Linode reverse DNS before relying on delivery."
