import { env } from "@/config/env";

// Document 5 §13 — application-level configuration, derived from the
// centralized `env` loader. No component or service should read
// `process.env` directly; import typed config from here instead.

export const appConfig = {
  url: env.AUTH_URL,
  name: "KAIRO-Lite",
  ownerEmail: env.KAIRO_OWNER_EMAIL,
  // TODO(Document 11 §4): replace with a verified sending domain before
  // production deployment (Phase 8, Document 9).
  emailFrom: "KAIRO-Lite <onboarding@resend.dev>",
} as const;
