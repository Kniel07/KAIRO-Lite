import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseConfig } from "@/config/database";
import { softDeleteExtension } from "@/lib/db/soft-delete-extension";

// Standard Next.js pattern — avoids exhausting database connections from a
// new PrismaClient being created on every hot-reload in development.
// Document 3 §1 — "The database is the single source of truth." This is the
// only place a PrismaClient is instantiated; everything else imports it
// from here, never from `@/generated/prisma` directly.
//
// Prisma's current major version requires an explicit driver adapter
// (rather than reading `DATABASE_URL` implicitly) — `@prisma/adapter-pg`
// is the Postgres adapter (Document 1 §8 pins PostgreSQL).
//
// `.$extends(softDeleteExtension)` applies soft-delete enforcement at the
// infrastructure layer (see `lib/db/soft-delete-extension.ts`) — every
// caller of `prisma`, present and future, gets it automatically.

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: databaseConfig.url });
  return new PrismaClient({ adapter }).$extends(softDeleteExtension);
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
