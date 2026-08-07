import { env } from "@/config/env";

// Document 11 — typed Auth.js configuration values. The actual Auth.js
// instance is assembled in `lib/auth/index.ts`; this module only centralizes
// the environment-derived settings it needs.

export const authConfig = {
  secret: env.AUTH_SECRET,
  url: env.AUTH_URL,
  ownerEmail: env.KAIRO_OWNER_EMAIL,
  resendApiKey: env.RESEND_API_KEY,
  // Document 11 §6 — database session strategy, 30 day max age.
  sessionMaxAgeSeconds: 30 * 24 * 60 * 60,
  sessionUpdateAgeSeconds: 24 * 60 * 60,
} as const;
