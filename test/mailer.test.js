import assert from "node:assert/strict";
import { test } from "node:test";
import { createMailer } from "../contact-api/mailer.js";

test("mailer sends contact notification with visitor reply-to", async () => {
  const messages = [];
  const mailer = createMailer(
    {
      mailFrom: "joshuaharrisonpro@gmail.com",
      mailTo: "joshuaharrisonpro@gmail.com"
    },
    {
      async sendMail(message) {
        messages.push(message);
        return { messageId: "test-message" };
      }
    }
  );

  await mailer.sendContactMessage({
    name: "Ada Lovelace",
    email: "ada@example.com",
    message: "Hello from the website."
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].from, "joshuaharrisonpro@gmail.com");
  assert.equal(messages[0].to, "joshuaharrisonpro@gmail.com");
  assert.equal(messages[0].bcc, undefined);
  assert.deepEqual(messages[0].replyTo, {
    name: "Ada Lovelace",
    address: "ada@example.com"
  });
  assert.equal(messages[0].subject, "New resume website message");
  assert.match(messages[0].text, /Hello from the website\./);
});
