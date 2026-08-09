import { env } from "@/config/env";

// Document 5 §13 — application-level configuration, derived from the
// centralized `env` loader. No component or service should read
// `process.env` directly; import typed config from here instead.

export const appConfig = {
  url: env.AUTH_URL,
  name: "KAIRO-Lite",
  ownerEmail: env.KAIRO_OWNER_EMAIL,
  // Document 11 §4 / RC Review finding RC1 — `EMAIL_FROM` is deployment
  // config (a verified Resend sending domain), not something to hardcode.
  // `config/env.ts` requires it once `NODE_ENV=production`, so a deploy
  // can't silently ship this placeholder as the real sending address; the
  // placeholder remains the default for development/test only.
  emailFrom: env.EMAIL_FROM ?? "KAIRO-Lite <onboarding@resend.dev>",
} as const;
