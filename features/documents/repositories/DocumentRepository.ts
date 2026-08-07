import { Prisma } from "@/generated/prisma/client";
import type { KairoDocument } from "@/types/database";
import { prisma } from "@/lib/db/client";
import { includingArchived, onlyArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 6 §22, Document 13 §3 (Amendment 2) — feature-owned repository.
// Uses the `KairoDocument` alias (`@/types/database`) since `Document` is
// also the global DOM type. Soft-delete exclusion is enforced by
// `lib/db/soft-delete-extension.ts` (Phase 2 hardening review).
export class DocumentRepository implements Repository<
  KairoDocument,
  Prisma.DocumentCreateInput,
  Prisma.DocumentUpdateInput
> {
  async findById(id: string): Promise<KairoDocument | null> {
    return prisma.document.findFirst({ where: { id } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<KairoDocument>> {
    const [items, total] = await Promise.all([
      prisma.document.findMany({ ...toPagination(params) }),
      prisma.document.count(),
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

  /** Escape hatch — archived rows only. */
  async findArchived(params?: FindManyParams): Promise<PagedResult<KairoDocument>> {
    const where = onlyArchived();
    const [items, total] = await Promise.all([
      prisma.document.findMany({ where, ...toPagination(params) }),
      prisma.document.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — both archived and active rows. */
  async findIncludingArchived(params?: FindManyParams): Promise<PagedResult<KairoDocument>> {
    const where = includingArchived();
    const [items, total] = await Promise.all([
      prisma.document.findMany({ where, ...toPagination(params) }),
      prisma.document.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — reverses `archive()`. Mutations bypass the extension. */
  async restore(id: string): Promise<void> {
    await prisma.document.update({ where: { id }, data: { archivedAt: null } });
  }
}
