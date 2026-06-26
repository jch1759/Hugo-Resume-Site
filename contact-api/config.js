import "dotenv/config";

const DEFAULTS = {
  port: 3000,
  allowedOrigin: "https://joshuacharrison.com",
  mailFrom: "joshuaharrisonpro@gmail.com",
  mailTo: "joshuaharrisonpro@gmail.com",
  smtpHost: "smtp.gmail.com",
  smtpPort: 587,
  smtpSecure: false,
  smtpRequireTls: true,
  rateLimitWindowMs: 15 * 60 * 1000,
  rateLimitMax: 5,
  maxNameLength: 120,
  maxEmailLength: 254,
  maxMessageLength: 5000
};

function intFromEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }

  return value;
}

function boolFromEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

export function loadConfig(overrides = {}) {
  return {
    port: intFromEnv("PORT", DEFAULTS.port),
    allowedOrigin: process.env.ALLOWED_ORIGIN || DEFAULTS.allowedOrigin,
    mailFrom: process.env.MAIL_FROM || DEFAULTS.mailFrom,
    mailTo: process.env.MAIL_TO || DEFAULTS.mailTo,
    smtpHost: process.env.SMTP_HOST || DEFAULTS.smtpHost,
    smtpPort: intFromEnv("SMTP_PORT", DEFAULTS.smtpPort),
    smtpSecure: boolFromEnv("SMTP_SECURE", DEFAULTS.smtpSecure),
    smtpRequireTls: boolFromEnv("SMTP_REQUIRE_TLS", DEFAULTS.smtpRequireTls),
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    rateLimitWindowMs: intFromEnv("RATE_LIMIT_WINDOW_MS", DEFAULTS.rateLimitWindowMs),
    rateLimitMax: intFromEnv("RATE_LIMIT_MAX", DEFAULTS.rateLimitMax),
    maxNameLength: intFromEnv("MAX_NAME_LENGTH", DEFAULTS.maxNameLength),
    maxEmailLength: intFromEnv("MAX_EMAIL_LENGTH", DEFAULTS.maxEmailLength),
    maxMessageLength: intFromEnv("MAX_MESSAGE_LENGTH", DEFAULTS.maxMessageLength),
    ...overrides
  };
}
