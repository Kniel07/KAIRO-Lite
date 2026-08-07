import { Prisma } from "@/generated/prisma/client";

// Document 3 §8 / Document 10 §4 — models that carry `archivedAt`
// (Document 10 §4's Standard Fields section), i.e. genuinely
// soft-deletable. Built from the same criterion Document 10 §4 already
// uses to list the *exceptions* (Message, AuditLog, Settings, the Auth.js
// adapter models) — every model NOT on that exception list and NOT
// RESERVED belongs here.
//
// `Task` is deliberately excluded even though it has `archivedAt`: it is
// RESERVED, schema only (Document 10 §5.6, Document 13 §6) — no
// application code, including this list, may reference it by name until
// it is explicitly greenlit.
const SOFT_DELETE_MODELS = new Set<string>([
  "User",
  "Project",
  "Note",
  "Knowledge",
  "Document",
  "Tag",
  "Conversation",
]);

// Only reads are auto-filtered. Mutations (`update`, `delete`, `upsert`, …)
// are deliberately left alone — see the module doc comment below for why.
const READ_OPERATIONS = new Set<string>([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
]);

function hasExplicitArchivedAtFilter(where: unknown): boolean {
  return (
    typeof where === "object" &&
    where !== null &&
    Object.prototype.hasOwnProperty.call(where, "archivedAt")
  );
}

/**
 * Document 3 §8 / Document 10 §4 — soft-delete enforcement, moved from
 * per-repository convention (`notArchived()` in `lib/db/soft-delete.ts`)
 * into the Prisma Client itself, so no repository — present or future —
 * can forget to exclude archived rows on a read.
 *
 * Behavior: on a read operation against a soft-deletable model, `archivedAt:
 * null` is injected into `where` automatically UNLESS the caller's `where`
 * already mentions `archivedAt` explicitly. That's the escape hatch: a
 * repository method that wants archived rows (e.g. `findArchived`,
 * `restore`) passes its own `archivedAt` condition and this extension steps
 * aside entirely for that call.
 *
 * Scope is intentionally reads-only. Mutations are NOT intercepted:
 * `restore()` must be able to `update()` an already-archived row by id, and
 * an auto-filtered `update` would make that impossible. The invariant this
 * extension enforces is "archived rows are invisible by default when
 * listing/finding" — not "archived rows can never be touched," which is a
 * different (and here, undesired) guarantee.
 *
 * Limitation: this only intercepts Prisma Client's model query methods. It
 * does NOT intercept `$queryRaw`/`$executeRaw` — a future SearchRepository
 * (Phase 6) reading `searchVector` via raw SQL must filter `archivedAt`
 * itself.
 */
export const softDeleteExtension = Prisma.defineExtension({
  name: "soft-delete",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!SOFT_DELETE_MODELS.has(model) || !READ_OPERATIONS.has(operation)) {
          return query(args);
        }

        const where = (args as { where?: unknown }).where;

        if (hasExplicitArchivedAtFilter(where)) {
          return query(args);
        }

        return query({
          ...args,
          where: { ...((where as Record<string, unknown> | undefined) ?? {}), archivedAt: null },
        });
      },
    },
  },
});
