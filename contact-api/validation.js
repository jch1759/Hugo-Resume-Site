import { z } from "zod";

const emailSchema = z.string().trim().email();

export function buildContactSchema(config) {
  return z.object({
    name: z.string().trim().min(1).max(config.maxNameLength),
    email: emailSchema.max(config.maxEmailLength),
    message: z.string().trim().min(1).max(config.maxMessageLength),
    _gotcha: z.string().optional().default("")
  });
}

export function validateContactPayload(body, config) {
  const schema = buildContactSchema(config);
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return {
      ok: false,
      error: "Please provide a valid name, email, and message."
    };
  }

  if (parsed.data._gotcha.trim() !== "") {
    return {
      ok: false,
      spam: true,
      error: "Message could not be sent."
    };
  }

  return {
    ok: true,
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      message: parsed.data.message
    }
  };
}
