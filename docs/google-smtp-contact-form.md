# Google SMTP Contact Form Setup

This setup keeps the custom Node/Express form handler and sends contact-form notifications through Gmail SMTP instead of a self-hosted mail server.

## Why This Replaces the Mail Server Plan

With Google SMTP, you do not need to run Postfix, Dovecot, OpenDKIM, Rspamd, mail DNS, MX records, or reverse DNS for this contact form.

Keep your existing domain email/DNS setup unless you separately decide to host domain mail later.

## Google Account Requirement

Use `joshuaharrisonpro@gmail.com` as the authenticated SMTP account.

Google requires a Google Account app password for SMTP clients that cannot use "Sign in with Google". App passwords require 2-Step Verification.

References:

- Google SMTP settings: https://support.google.com/mail/answer/7104828
- Google app passwords: https://support.google.com/accounts/answer/185833

1. Turn on 2-Step Verification for `joshuaharrisonpro@gmail.com`.
2. Go to Google App Passwords: `https://myaccount.google.com/apppasswords`.
3. Create an app password for this server/contact form.
4. Store the generated 16-character password in `/etc/resume-contact-api.env` as `SMTP_PASS`.

Do not commit the app password.

## Environment

Copy `deploy/resume-contact-api.env.example` to `/etc/resume-contact-api.env` on the VPS and replace `SMTP_PASS`.

```env
PORT=3000
ALLOWED_ORIGIN=https://joshuacharrison.com
MAIL_FROM=joshuaharrisonpro@gmail.com
MAIL_TO=joshuaharrisonpro@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=joshuaharrisonpro@gmail.com
SMTP_PASS=replace-with-google-app-password
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=5
```

The contact email uses:

- `From: joshuaharrisonpro@gmail.com`
- `To: joshuaharrisonpro@gmail.com`
- `Reply-To: visitor-provided-email`

## Deploy API

```bash
cd /home/josh/resume-site
git pull origin main
pnpm install --prod

sudo cp deploy/resume-contact-api.env.example /etc/resume-contact-api.env
sudo nano /etc/resume-contact-api.env

sudo cp deploy/resume-contact-api.service /etc/systemd/system/resume-contact-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now resume-contact-api
sudo systemctl status resume-contact-api
```

Merge `deploy/Caddyfile.contact-api.example` into `/etc/caddy/Caddyfile`, then reload Caddy:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## Verification

```bash
curl -i https://joshuacharrison.com/health

curl -i -X POST https://joshuacharrison.com/api/contact \
  -F name="Test User" \
  -F email="test@example.com" \
  -F message="Testing the contact form"
```

Then check `joshuaharrisonpro@gmail.com`.

If delivery fails, inspect:

```bash
sudo journalctl -u resume-contact-api -n 100 --no-pager
```
