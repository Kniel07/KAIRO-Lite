import { Prisma } from "@/generated/prisma/client";
import type { Tag } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { notArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 13 §3 (Amendment 2) — cross-cutting repository; Tag is shared
// across Project/Knowledge/Note/Document (Document 10 §5.7), not owned by
// any single feature.
export class TagRepository implements Repository<
  Tag,
  Prisma.TagCreateInput,
  Prisma.TagUpdateInput
> {
  async findById(id: string): Promise<Tag | null> {
    return prisma.tag.findFirst({ where: { id, ...notArchived() } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<Tag>> {
    const where = notArchived();
    const [items, total] = await Promise.all([
      prisma.tag.findMany({ where, ...toPagination(params) }),
      prisma.tag.count({ where }),
    ]);
    return { items, total };
  }

  async create(input: Prisma.TagCreateInput): Promise<Tag> {
    return prisma.tag.create({ data: input });
  }

  async update(id: string, input: Prisma.TagUpdateInput): Promise<Tag> {
    return prisma.tag.update({ where: { id }, data: input });
  }

  async archive(id: string): Promise<void> {
    await prisma.tag.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
