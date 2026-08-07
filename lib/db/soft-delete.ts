import type { FindManyParams } from "@/features/shared/types/Repository";

// Document 3 §8 — soft delete: default queries exclude archived records.
//
// As of the Phase 2 review, the actual enforcement lives in
// `lib/db/soft-delete-extension.ts` (a Prisma Client Extension applied once
// in `lib/db/client.ts`) — every read on a soft-deletable model gets
// `archivedAt: null` injected automatically, so a repository forgetting
// this helper is no longer a correctness bug. These helpers remain for two
// reasons: (1) explicitness/readability at the call site (Document 7 §2),
// and (2) `onlyArchived()`/`includingArchived()` are the escape hatch the
// extension looks for — passing a `where` that already mentions
// `archivedAt` is exactly what makes the extension step aside.
export function notArchived(): { archivedAt: null } {
  return { archivedAt: null };
}

// Escape hatch: `archivedAt: { not: null }` — the extension sees the
// `archivedAt` key already present and does not touch this query.
export function onlyArchived(): { archivedAt: { not: null } } {
  return { archivedAt: { not: null } };
}

// Escape hatch: `archivedAt: undefined` — the key is present (so the
// extension steps aside) but Prisma drops `undefined`-valued filter keys
// before building the query, so no restriction is actually applied and
// both archived and active rows are returned.
export function includingArchived(): { archivedAt: undefined } {
  return { archivedAt: undefined };
}

const DEFAULT_PAGE_SIZE = 20;

// Document 8 §16 — pagination standard (`page`/`pageSize`).
export function toPagination(params?: FindManyParams): { skip: number; take: number } {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? DEFAULT_PAGE_SIZE;
  return { skip: (page - 1) * pageSize, take: pageSize };
}
