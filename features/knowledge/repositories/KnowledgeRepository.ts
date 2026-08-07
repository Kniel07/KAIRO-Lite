import { Prisma } from "@/generated/prisma/client";
import type { Knowledge } from "@/generated/prisma/client";
import { prisma, type Db } from "@/lib/db/client";
import { includingArchived, onlyArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 6 §22, Document 13 §3 (Amendment 2) — feature-owned repository.
// Full-text search (Document 10 §8's GIN index) is deliberately NOT
// exposed here — it is read via `$queryRaw` by `SearchRepository`
// (`lib/db/repositories/SearchRepository.ts`), not this entity repository.
// Raw queries bypass the Prisma Client Extension in
// `lib/db/soft-delete-extension.ts`, which is why `SearchRepository`
// filters `archivedAt` manually (Document 7 §8).
//
// Soft-delete exclusion here is enforced by that extension — `findById`/
// `findMany` below pass no `archivedAt` filter themselves.
//
// Interface `KnowledgeService` depends on (Document 7 §8) — see
// `ProjectRepositoryLike` for why this exists alongside the generic shape.
export interface KnowledgeRepositoryLike extends Repository<
  Knowledge,
  Prisma.KnowledgeCreateInput,
  Prisma.KnowledgeUpdateInput
> {
  findByProject(projectId: string, params?: FindManyParams): Promise<PagedResult<Knowledge>>;
  findByIdIncludingArchived(id: string): Promise<Knowledge | null>;
}

// Constructor-injected `client` (Phase 3, transaction boundaries) — see
// `UserRepository` for the pattern this follows.
export class KnowledgeRepository implements KnowledgeRepositoryLike {
  constructor(private readonly client: Db = prisma) {}

  async findById(id: string): Promise<Knowledge | null> {
    return this.client.knowledge.findFirst({ where: { id } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<Knowledge>> {
    const [items, total] = await Promise.all([
      this.client.knowledge.findMany({ ...toPagination(params) }),
      this.client.knowledge.count(),
    ]);
    return { items, total };
  }

  /** KnowledgeService uses this for project-scoped listings. */
  async findByProject(projectId: string, params?: FindManyParams): Promise<PagedResult<Knowledge>> {
    const where = { projectId };
    const [items, total] = await Promise.all([
      this.client.knowledge.findMany({ where, ...toPagination(params) }),
      this.client.knowledge.count({ where }),
    ]);
    return { items, total };
  }

  async create(input: Prisma.KnowledgeCreateInput): Promise<Knowledge> {
    return this.client.knowledge.create({ data: input });
  }

  async update(id: string, input: Prisma.KnowledgeUpdateInput): Promise<Knowledge> {
    return this.client.knowledge.update({ where: { id }, data: input });
  }

  async archive(id: string): Promise<void> {
    await this.client.knowledge.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  /** Escape hatch — archived rows only. */
  async findArchived(params?: FindManyParams): Promise<PagedResult<Knowledge>> {
    const where = onlyArchived();
    const [items, total] = await Promise.all([
      this.client.knowledge.findMany({ where, ...toPagination(params) }),
      this.client.knowledge.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — both archived and active rows. */
  async findIncludingArchived(params?: FindManyParams): Promise<PagedResult<Knowledge>> {
    const where = includingArchived();
    const [items, total] = await Promise.all([
      this.client.knowledge.findMany({ where, ...toPagination(params) }),
      this.client.knowledge.count({ where }),
    ]);
    return { items, total };
  }

  /** Used by restore-with-authorization flows that must inspect an archived row first. */
  async findByIdIncludingArchived(id: string): Promise<Knowledge | null> {
    return this.client.knowledge.findFirst({ where: { id, ...includingArchived() } });
  }

  /** Escape hatch — reverses `archive()`. Mutations bypass the extension. */
  async restore(id: string): Promise<void> {
    await this.client.knowledge.update({ where: { id }, data: { archivedAt: null } });
  }
}
