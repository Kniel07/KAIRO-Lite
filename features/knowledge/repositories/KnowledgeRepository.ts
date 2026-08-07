import { Prisma } from "@/generated/prisma/client";
import type { Knowledge } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { notArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 6 §22, Document 13 §3 (Amendment 2) — feature-owned repository.
// Full-text search (Document 10 §8's GIN index) is deliberately NOT
// exposed here — it is read via `$queryRaw` by a future SearchRepository
// (Phase 6), not this entity repository.
export class KnowledgeRepository implements Repository<
  Knowledge,
  Prisma.KnowledgeCreateInput,
  Prisma.KnowledgeUpdateInput
> {
  async findById(id: string): Promise<Knowledge | null> {
    return prisma.knowledge.findFirst({ where: { id, ...notArchived() } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<Knowledge>> {
    const where = notArchived();
    const [items, total] = await Promise.all([
      prisma.knowledge.findMany({ where, ...toPagination(params) }),
      prisma.knowledge.count({ where }),
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
}
