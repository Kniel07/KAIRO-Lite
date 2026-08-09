import { z } from "zod";

// Document 7 §13 — "Never access process.env directly throughout the
// application. Centralize environment loading." This is the single place
// process.env is read. Every other module imports `env` from here.
//
// Document 11 §9 — authoritative list of required environment variables.

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

    AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
    AUTH_URL: z.string().url("AUTH_URL must be a valid URL"),

    RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
    // Document 15 DEBT (RC Review finding RC1) — optional outside
    // production; `config/app.ts` falls back to Resend's shared onboarding
    // domain when unset. Required in production below, so a deploy can't
    // silently ship that placeholder as the real sending address.
    EMAIL_FROM: z.string().min(1).optional(),

    KAIRO_OWNER_EMAIL: z.string().email("KAIRO_OWNER_EMAIL must be a valid email"),

    OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  })
  // Document 13 (Pre-Deployment Hardening amendment) — Document 15
  // DEBT-007 / RC Review finding RC3: these two checks only apply once
  // NODE_ENV=production, since a real production environment is what they
  // guard.
  .superRefine((value, ctx) => {
    if (value.NODE_ENV !== "production") return;

    // Auth.js derives session-cookie security (the `Secure` flag / the
    // `__Secure-` cookie prefix) from whether the app is running under
    // HTTPS. An accidentally-http AUTH_URL in production wouldn't just
    // "fail in a less obvious way later" — it would specifically mean
    // session cookies aren't sent with `Secure`, a real increase in
    // session-hijacking surface, not just a misconfiguration
    // inconvenience. Failing fast at boot is Document 7 §11's guarantee;
    // this closes the one case that previously slipped past it.
    if (!value.AUTH_URL.startsWith("https://")) {
      ctx.addIssue({
        code: "custom",
        path: ["AUTH_URL"],
        message: "AUTH_URL must use https:// in production.",
      });
    }

    if (!value.EMAIL_FROM) {
      ctx.addIssue({
        code: "custom",
        path: ["EMAIL_FROM"],
        message: "EMAIL_FROM is required in production (a verified Resend sending domain).",
      });
    }
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
