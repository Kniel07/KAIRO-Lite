import { Prisma } from "@/generated/prisma/client";
import type { KairoDocument } from "@/types/database";
import { prisma } from "@/lib/db/client";
import { notArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 6 §22, Document 13 §3 (Amendment 2) — feature-owned repository.
// Uses the `KairoDocument` alias (`@/types/database`) since `Document` is
// also the global DOM type.
export class DocumentRepository implements Repository<
  KairoDocument,
  Prisma.DocumentCreateInput,
  Prisma.DocumentUpdateInput
> {
  async findById(id: string): Promise<KairoDocument | null> {
    return prisma.document.findFirst({ where: { id, ...notArchived() } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<KairoDocument>> {
    const where = notArchived();
    const [items, total] = await Promise.all([
      prisma.document.findMany({ where, ...toPagination(params) }),
      prisma.document.count({ where }),
    ]);
    return { items, total };
  }

  async create(input: Prisma.DocumentCreateInput): Promise<KairoDocument> {
    return prisma.document.create({ data: input });
  }

  async update(id: string, input: Prisma.DocumentUpdateInput): Promise<KairoDocument> {
    return prisma.document.update({ where: { id }, data: input });
  }

  async archive(id: string): Promise<void> {
    await prisma.document.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
