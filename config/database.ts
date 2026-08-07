import { env } from "@/config/env";

// Document 5 §13 / Document 10 — database configuration. The Prisma Client
// itself is instantiated once in `lib/db/client.ts`; this module only holds
// typed, non-secret-adjacent connection settings referenced elsewhere.

export const databaseConfig = {
  url: env.DATABASE_URL,
} as const;
