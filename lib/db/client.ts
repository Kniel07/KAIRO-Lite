import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseConfig } from "@/config/database";

// Standard Next.js pattern — avoids exhausting database connections from a
// new PrismaClient being created on every hot-reload in development.
// Document 3 §1 — "The database is the single source of truth." This is the
// only place a PrismaClient is instantiated; everything else imports it
// from here, never from `@/generated/prisma` directly.
//
// Prisma's current major version requires an explicit driver adapter
// (rather than reading `DATABASE_URL` implicitly) — `@prisma/adapter-pg`
// is the Postgres adapter (Document 1 §8 pins PostgreSQL).

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: databaseConfig.url });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
