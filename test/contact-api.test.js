import assert from "node:assert/strict";
import { test } from "node:test";
import request from "supertest";
import { createApp } from "../contact-api/app.js";

const config = {
  allowedOrigin: "https://joshuacharrison.com",
  mailFrom: "contact@joshuacharrison.com",
  mailTo: "joshuaharrisonpro@gmail.com",
  smtpHost: "localhost",
  smtpPort: 25,
  smtpSecure: false,
  rateLimitWindowMs: 60_000,
  rateLimitMax: 10,
  maxNameLength: 120,
  maxEmailLength: 254,
  maxMessageLength: 5000
};

function createTestApp() {
  const sent = [];
  const app = createApp({
    config,
    logger: false,
    trustProxy: false,
    mailer: {
      async sendContactMessage(payload) {
        sent.push(payload);
      }
    }
  });

  return { app, sent };
}

test("POST /api/contact sends a valid contact message", async () => {
  const { app, sent } = createTestApp();

  const response = await request(app)
    .post("/api/contact")
    .set("Origin", "https://joshuacharrison.com")
    .field("name", "Ada Lovelace")
    .field("email", "ada@example.com")
    .field("message", "Hello from the test suite.");

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true });
  assert.deepEqual(sent, [
    {
      name: "Ada Lovelace",
      email: "ada@example.com",
      message: "Hello from the test suite."
    }
  ]);
});

test("POST /api/contact rejects invalid fields", async () => {
  const { app, sent } = createTestApp();

  const response = await request(app)
    .post("/api/contact")
    .set("Origin", "https://joshuacharrison.com")
    .field("name", "")
    .field("email", "not-an-email")
    .field("message", "");

  assert.equal(response.status, 400);
  assert.equal(response.body.ok, false);
  assert.equal(sent.length, 0);
});

test("POST /api/contact silently drops honeypot submissions", async () => {
  const { app, sent } = createTestApp();

  const response = await request(app)
    .post("/api/contact")
    .set("Origin", "https://joshuacharrison.com")
    .field("name", "Spam Bot")
    .field("email", "spam@example.com")
    .field("message", "Buy now")
    .field("_gotcha", "filled");

  assert.equal(response.status, 204);
  assert.equal(sent.length, 0);
});

test("POST /api/contact rejects untrusted origins", async () => {
  const { app, sent } = createTestApp();

  const response = await request(app)
    .post("/api/contact")
    .set("Origin", "https://evil.example")
    .field("name", "Ada Lovelace")
    .field("email", "ada@example.com")
    .field("message", "Hello.");

  assert.equal(response.status, 403);
  assert.equal(response.body.ok, false);
  assert.equal(sent.length, 0);
});
