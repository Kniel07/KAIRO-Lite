import { Prisma } from "@/generated/prisma/client";
import type { Knowledge } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { includingArchived, onlyArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 6 §22, Document 13 §3 (Amendment 2) — feature-owned repository.
// Full-text search (Document 10 §8's GIN index) is deliberately NOT
// exposed here — it is read via `$queryRaw` by a future SearchRepository
// (Phase 6), not this entity repository. Raw queries bypass the Prisma
// Client Extension in `lib/db/soft-delete-extension.ts`, so that future
// SearchRepository must filter `archivedAt` itself.
//
// Soft-delete exclusion here is enforced by that extension — `findById`/
// `findMany` below pass no `archivedAt` filter themselves.
export class KnowledgeRepository implements Repository<
  Knowledge,
  Prisma.KnowledgeCreateInput,
  Prisma.KnowledgeUpdateInput
> {
  async findById(id: string): Promise<Knowledge | null> {
    return prisma.knowledge.findFirst({ where: { id } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<Knowledge>> {
    const [items, total] = await Promise.all([
      prisma.knowledge.findMany({ ...toPagination(params) }),
      prisma.knowledge.count(),
    ]);
    return { items, total };
  }

  async create(input: Prisma.KnowledgeCreateInput): Promise<Knowledge> {
    return prisma.knowledge.create({ data: input });
  }

  async update(id: string, input: Prisma.KnowledgeUpdateInput): Promise<Knowledge> {
    return prisma.knowledge.update({ where: { id }, data: input });
  }

  async archive(id: string): Promise<void> {
    await prisma.knowledge.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  /** Escape hatch — archived rows only. */
  async findArchived(params?: FindManyParams): Promise<PagedResult<Knowledge>> {
    const where = onlyArchived();
    const [items, total] = await Promise.all([
      prisma.knowledge.findMany({ where, ...toPagination(params) }),
      prisma.knowledge.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — both archived and active rows. */
  async findIncludingArchived(params?: FindManyParams): Promise<PagedResult<Knowledge>> {
    const where = includingArchived();
    const [items, total] = await Promise.all([
      prisma.knowledge.findMany({ where, ...toPagination(params) }),
      prisma.knowledge.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — reverses `archive()`. Mutations bypass the extension. */
  async restore(id: string): Promise<void> {
    await prisma.knowledge.update({ where: { id }, data: { archivedAt: null } });
  }
}
