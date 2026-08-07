import { Prisma } from "@/generated/prisma/client";
import type { Tag } from "@/generated/prisma/client";
import { prisma, type Db } from "@/lib/db/client";
import { includingArchived, onlyArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 13 §3 (Amendment 2) — cross-cutting repository; Tag is shared
// across Project/Knowledge/Note/Document (Document 10 §5.7), not owned by
// any single feature. Soft-delete exclusion is enforced by
// `lib/db/soft-delete-extension.ts` (Phase 2 hardening review).
//
// Constructor-injected `client` (Phase 3, transaction boundaries) — see
// `UserRepository` for the pattern this follows.
export class TagRepository implements Repository<
  Tag,
  Prisma.TagCreateInput,
  Prisma.TagUpdateInput
> {
  constructor(private readonly client: Db = prisma) {}

  async findById(id: string): Promise<Tag | null> {
    return this.client.tag.findFirst({ where: { id } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<Tag>> {
    const [items, total] = await Promise.all([
      this.client.tag.findMany({ ...toPagination(params) }),
      this.client.tag.count(),
    ]);
    return { items, total };
  }

  async create(input: Prisma.TagCreateInput): Promise<Tag> {
    return this.client.tag.create({ data: input });
  }

  async update(id: string, input: Prisma.TagUpdateInput): Promise<Tag> {
    return this.client.tag.update({ where: { id }, data: input });
  }

  async archive(id: string): Promise<void> {
    await this.client.tag.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  /** Escape hatch — archived rows only. */
  async findArchived(params?: FindManyParams): Promise<PagedResult<Tag>> {
    const where = onlyArchived();
    const [items, total] = await Promise.all([
      this.client.tag.findMany({ where, ...toPagination(params) }),
      this.client.tag.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — both archived and active rows. */
  async findIncludingArchived(params?: FindManyParams): Promise<PagedResult<Tag>> {
    const where = includingArchived();
    const [items, total] = await Promise.all([
      this.client.tag.findMany({ where, ...toPagination(params) }),
      this.client.tag.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — reverses `archive()`. Mutations bypass the extension. */
  async restore(id: string): Promise<void> {
    await this.client.tag.update({ where: { id }, data: { archivedAt: null } });
  }
}
