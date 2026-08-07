// Document 7 §8 — "Component → Route → Service → Repository → Prisma. No
// shortcuts." Document 6 §22 — every concrete Repository (ProjectRepository,
// KnowledgeRepository, ...) implements this shape once Phase 2/3 introduce
// the domain models this repo will query. Document 13 §3 (Amendment 2) —
// feature-owned repositories live in `features/<feature>/repositories/`;
// cross-cutting ones in `lib/db/repositories/`. Both implement this same
// interface.

export interface FindManyParams {
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
}

export interface Repository<T, CreateInput, UpdateInput> {
  findById(id: string): Promise<T | null>;
  findMany(params?: FindManyParams): Promise<PagedResult<T>>;
  create(input: CreateInput): Promise<T>;
  update(id: string, input: UpdateInput): Promise<T>;
  /** Document 3 §8 — soft delete only; no `delete()` in this contract. */
  archive(id: string): Promise<void>;
}
