import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import pinoHttp from "pino-http";
import { loadConfig } from "./config.js";
import { createMailer } from "./mailer.js";
import { validateContactPayload } from "./validation.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fields: 8,
    fieldSize: 8 * 1024
  }
});

export function createApp(options = {}) {
  const config = loadConfig(options.config);
  const mailer = options.mailer || createMailer(config, options.transport);
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", options.trustProxy ?? 1);

  app.use(helmet());
  app.use(
    pinoHttp({
      enabled: options.logger !== false,
      redact: {
        paths: ["req.body", "res.body"],
        remove: true
      }
    })
  );

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post(
    "/api/contact",
    cors({
      origin(origin, callback) {
        if (!origin || origin === config.allowedOrigin) {
          callback(null, true);
          return;
        }

        callback(new Error("Origin not allowed"));
      },
      methods: ["POST"],
      allowedHeaders: ["Content-Type", "Accept"],
      maxAge: 600
    }),
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      limit: config.rateLimitMax,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { ok: false, error: "Too many messages. Please try again later." }
    }),
    upload.none(),
    async (req, res, next) => {
      const validation = validateContactPayload(req.body, config);

      if (!validation.ok) {
        const status = validation.spam ? 204 : 400;
        res.status(status).json(validation.spam ? {} : { ok: false, error: validation.error });
        return;
      }

      try {
        await mailer.sendContactMessage(validation.data);
        res.json({ ok: true });
      } catch (error) {
        req.log.error({ err: error }, "contact email send failed");
        next(error);
      }
    }
  );

  app.use((error, _req, res, _next) => {
    if (error?.message === "Origin not allowed") {
      res.status(403).json({ ok: false, error: "Origin not allowed." });
      return;
    }

    res.status(500).json({ ok: false, error: "Message could not be sent." });
  });

  return app;
}
