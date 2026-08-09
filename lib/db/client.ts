import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseConfig } from "@/config/database";
import { env } from "@/config/env";
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

// Document 15 DEBT-008 / RC Review finding DB2 — previously a bare
// `{ connectionString }` with no explicit pool size, meaning Vercel's
// per-invocation connection behavior was whatever `pg.Pool`'s defaults
// happened to do under serverless concurrency, untested. Now that Vercel +
// Neon is the confirmed production target (Pre-Deployment Hardening pass):
// Neon's own pooled connection endpoint (the `-pooler` hostname suffix,
// PgBouncer-backed) is what actually absorbs concurrent serverless
// invocations — `DATABASE_URL` should point at that endpoint in production
// (documented in Document 17). This `max` is a second, smaller safety
// margin *within* a single running instance (a warm Vercel function
// reusing this module-level client across invocations, or a persistent
// `next start` process in development) — kept low deliberately so this
// process alone can never open enough connections to matter, regardless of
// how many instances Vercel runs concurrently.
const POOL_MAX_CONNECTIONS = 5;

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: databaseConfig.url,
    max: POOL_MAX_CONNECTIONS,
  });
  return new PrismaClient({ adapter }).$extends(softDeleteExtension);
}

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Document 13 §20 (Phase 3, transaction boundaries) — the type every
// repository is constructed with: either the global extended client, or an
// interactive-transaction client handed to it by `withTransaction()`
// (`lib/db/transaction.ts`). Verified live that `.$extends(softDeleteExtension)`
// propagates into `$transaction` callbacks — a repository given a `Db` inside
// a transaction still gets soft-delete filtering automatically.
export type Db = typeof prisma;
