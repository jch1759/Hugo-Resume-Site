# Self-Hosted Contact Form and Mail Server

This runbook replaces the Formspree contact form with a local Node/Express API and a manual Postfix/Dovecot mail stack on the Ubuntu 24.04 VPS.

## Local App

```bash
pnpm install
pnpm test
```

The form posts to `https://joshuacharrison.com/api/contact`. The API listens on `127.0.0.1:3000` and sends mail through local Postfix.

## VPS Mail Setup

Run the privileged server steps as a sudo-capable user.

The repeatable local script for this section is `scripts/provision-mail-server.sh`. Review it first, then copy it to the VPS and run it with sudo:

```bash
sudo DOMAIN=joshuacharrison.com MAIL_HOST=mail.joshuacharrison.com bash scripts/provision-mail-server.sh
```

1. Set host identity.

```bash
sudo hostnamectl set-hostname mail.joshuacharrison.com
echo "127.0.1.1 mail.joshuacharrison.com mail" | sudo tee -a /etc/hosts
```

2. Install packages.

```bash
sudo apt update
sudo DEBIAN_FRONTEND=noninteractive apt install -y \
  postfix dovecot-core dovecot-imapd dovecot-lmtpd opendkim opendkim-tools \
  rspamd certbot ufw mailutils
```

Choose "Internet Site" for Postfix if prompted, with system mail name `joshuacharrison.com`.

3. Open firewall ports.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 25/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 587/tcp
sudo ufw allow 993/tcp
sudo ufw enable
```

4. Create the local mailbox.

```bash
sudo adduser --disabled-password --gecos "" contact
sudo passwd contact
```

5. Get certificates.

```bash
sudo certbot certonly --standalone -d mail.joshuacharrison.com
```

6. Configure Postfix.

Set these values with `sudo postconf -e`:

```bash
sudo postconf -e "myhostname = mail.joshuacharrison.com"
sudo postconf -e "mydomain = joshuacharrison.com"
sudo postconf -e "myorigin = /etc/mailname"
sudo postconf -e "mydestination = $myhostname, localhost.$mydomain, localhost, $mydomain"
sudo postconf -e "home_mailbox = Maildir/"
sudo postconf -e "smtpd_tls_cert_file = /etc/letsencrypt/live/mail.joshuacharrison.com/fullchain.pem"
sudo postconf -e "smtpd_tls_key_file = /etc/letsencrypt/live/mail.joshuacharrison.com/privkey.pem"
sudo postconf -e "smtpd_tls_security_level = may"
sudo postconf -e "smtp_tls_security_level = may"
sudo postconf -e "smtpd_sasl_type = dovecot"
sudo postconf -e "smtpd_sasl_path = private/auth"
sudo postconf -e "smtpd_sasl_auth_enable = yes"
sudo postconf -e "smtpd_recipient_restrictions = permit_mynetworks, permit_sasl_authenticated, reject_unauth_destination"
sudo postconf -e "milter_default_action = accept"
sudo postconf -e "milter_protocol = 6"
sudo postconf -e "smtpd_milters = inet:localhost:8891"
sudo postconf -e "non_smtpd_milters = inet:localhost:8891"
```

Enable submission in `/etc/postfix/master.cf`:

```text
submission inet n       -       y       -       -       smtpd
  -o syslog_name=postfix/submission
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_recipient_restrictions=permit_sasl_authenticated,reject
```

7. Configure Dovecot.

Use Maildir and expose auth to Postfix:

```text
mail_location = maildir:~/Maildir
ssl = required
ssl_cert = </etc/letsencrypt/live/mail.joshuacharrison.com/fullchain.pem
ssl_key = </etc/letsencrypt/live/mail.joshuacharrison.com/privkey.pem

service auth {
  unix_listener /var/spool/postfix/private/auth {
    mode = 0660
    user = postfix
    group = postfix
  }
}
```

8. Configure OpenDKIM.

```bash
sudo mkdir -p /etc/opendkim/keys/joshuacharrison.com
sudo opendkim-genkey -b 2048 -d joshuacharrison.com -s default -D /etc/opendkim/keys/joshuacharrison.com
sudo chown -R opendkim:opendkim /etc/opendkim/keys
```

Configure OpenDKIM to listen on `inet:8891@localhost`, sign `joshuacharrison.com`, and use the generated key. Publish the generated TXT value from:

```bash
sudo cat /etc/opendkim/keys/joshuacharrison.com/default.txt
```

9. Restart services.

```bash
sudo systemctl restart postfix dovecot opendkim rspamd
sudo systemctl enable postfix dovecot opendkim rspamd
```

## DNS at Porkbun

Add or update:

```text
mail.joshuacharrison.com.        A      173.255.225.41
joshuacharrison.com.             MX     10 mail.joshuacharrison.com.
joshuacharrison.com.             TXT    v=spf1 mx -all
_dmarc.joshuacharrison.com.      TXT    v=DMARC1; p=none; rua=mailto:contact@joshuacharrison.com
default._domainkey...            TXT    value from OpenDKIM default.txt
```

Set Linode reverse DNS/PTR for `173.255.225.41` to `mail.joshuacharrison.com`.

## Deploy API

1. Copy `deploy/resume-contact-api.env.example` to `/etc/resume-contact-api.env` and adjust values if needed.
2. Copy `deploy/resume-contact-api.service` to `/etc/systemd/system/resume-contact-api.service`.
3. Install production dependencies and start the service.

```bash
cd /home/josh/resume-site
pnpm install --prod
sudo systemctl daemon-reload
sudo systemctl enable --now resume-contact-api
```

4. Merge `deploy/Caddyfile.contact-api.example` into `/etc/caddy/Caddyfile`, then reload Caddy.

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## Verification

```bash
dig +short MX joshuacharrison.com
dig +short TXT joshuacharrison.com
dig +short TXT _dmarc.joshuacharrison.com
dig +short TXT default._domainkey.joshuacharrison.com
curl -i https://joshuacharrison.com/health
curl -i -X POST https://joshuacharrison.com/api/contact \
  -F name="Test User" \
  -F email="test@example.com" \
  -F message="Testing the contact form"
```

Check Gmail for delivery and inspect `/var/log/mail.log` if delivery fails.
