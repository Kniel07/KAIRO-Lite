import type { FindManyParams } from "@/features/shared/types/Repository";

// Document 3 §8 — soft delete: default queries exclude archived records.
// Document 10 §4 — `archivedAt` filtering happens in the Repository layer,
// not as Prisma middleware, so the behavior stays explicit and testable
// (Document 10 §4 citing Document 7 §2).
export function notArchived(): { archivedAt: null } {
  return { archivedAt: null };
}

const DEFAULT_PAGE_SIZE = 20;

// Document 8 §16 — pagination standard (`page`/`pageSize`).
export function toPagination(params?: FindManyParams): { skip: number; take: number } {
  const page = params?.page ?? 1;
  const pageSize = params?.pageSize ?? DEFAULT_PAGE_SIZE;
  return { skip: (page - 1) * pageSize, take: pageSize };
}
