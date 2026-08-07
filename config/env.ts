import { z } from "zod";

// Document 7 §13 — "Never access process.env directly throughout the
// application. Centralize environment loading." This is the single place
// process.env is read. Every other module imports `env` from here.
//
// Document 11 §9 — authoritative list of required environment variables.

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  AUTH_URL: z.string().url("AUTH_URL must be a valid URL"),

  RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),

  KAIRO_OWNER_EMAIL: z.string().email("KAIRO_OWNER_EMAIL must be a valid email"),

  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    // Never log secret values (Document 7 §12) — only which keys failed.
    throw new Error(`Invalid environment configuration. Check: ${missing}`);
  }

  return parsed.data;
}

export const env = loadEnv();
