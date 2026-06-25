import nodemailer from "nodemailer";

function escapeHeaderValue(value) {
  return String(value).replace(/[\r\n]+/g, " ").trim();
}

function buildMessageText({ name, email, message }) {
  return [
    "New resume website message",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    "",
    "Message:",
    message
  ].join("\n");
}

export function createMailer(config, transport = null) {
  const mailTransport =
    transport ||
    nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure
    });

  return {
    async sendContactMessage(payload) {
      const safeName = escapeHeaderValue(payload.name);
      const safeEmail = escapeHeaderValue(payload.email);

      return mailTransport.sendMail({
        from: config.mailFrom,
        to: config.mailTo,
        bcc: config.mailFrom,
        replyTo: {
          name: safeName,
          address: safeEmail
        },
        subject: "New resume website message",
        text: buildMessageText(payload)
      });
    }
  };
}
