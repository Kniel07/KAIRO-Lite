import { Prisma } from "@/generated/prisma/client";
import type { KairoDocument } from "@/types/database";
import { prisma, type Db } from "@/lib/db/client";
import { includingArchived, onlyArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 6 §22, Document 13 §3 (Amendment 2) — feature-owned repository.
// Uses the `KairoDocument` alias (`@/types/database`) since `Document` is
// also the global DOM type. Soft-delete exclusion is enforced by
// `lib/db/soft-delete-extension.ts` (Phase 2 hardening review).
//
// Interface `DocumentService` depends on (Document 7 §8) — see
// `ProjectRepositoryLike` for why this exists alongside the generic shape.
export interface DocumentRepositoryLike extends Repository<
  KairoDocument,
  Prisma.DocumentCreateInput,
  Prisma.DocumentUpdateInput
> {
  findByProject(projectId: string, params?: FindManyParams): Promise<PagedResult<KairoDocument>>;
  findByIdIncludingArchived(id: string): Promise<KairoDocument | null>;
}

// Constructor-injected `client` (Phase 3, transaction boundaries) — see
// `UserRepository` for the pattern this follows.
export class DocumentRepository implements DocumentRepositoryLike {
  constructor(private readonly client: Db = prisma) {}

  async findById(id: string): Promise<KairoDocument | null> {
    return this.client.document.findFirst({ where: { id } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<KairoDocument>> {
    const [items, total] = await Promise.all([
      this.client.document.findMany({ ...toPagination(params) }),
      this.client.document.count(),
    ]);
    return { items, total };
  }

  /** DocumentService uses this for project-scoped listings. */
  async findByProject(
    projectId: string,
    params?: FindManyParams,
  ): Promise<PagedResult<KairoDocument>> {
    const where = { projectId };
    const [items, total] = await Promise.all([
      this.client.document.findMany({ where, ...toPagination(params) }),
      this.client.document.count({ where }),
    ]);
    return { items, total };
  }

  async create(input: Prisma.DocumentCreateInput): Promise<KairoDocument> {
    return this.client.document.create({ data: input });
  }

  async update(id: string, input: Prisma.DocumentUpdateInput): Promise<KairoDocument> {
    return this.client.document.update({ where: { id }, data: input });
  }

  async archive(id: string): Promise<void> {
    await this.client.document.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  /** Escape hatch — archived rows only. */
  async findArchived(params?: FindManyParams): Promise<PagedResult<KairoDocument>> {
    const where = onlyArchived();
    const [items, total] = await Promise.all([
      this.client.document.findMany({ where, ...toPagination(params) }),
      this.client.document.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — both archived and active rows. */
  async findIncludingArchived(params?: FindManyParams): Promise<PagedResult<KairoDocument>> {
    const where = includingArchived();
    const [items, total] = await Promise.all([
      this.client.document.findMany({ where, ...toPagination(params) }),
      this.client.document.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — reverses `archive()`. Mutations bypass the extension. */
  async restore(id: string): Promise<void> {
    await this.client.document.update({ where: { id }, data: { archivedAt: null } });
  }

  /** Used by restore-with-authorization flows that must inspect an archived row first. */
  async findByIdIncludingArchived(id: string): Promise<KairoDocument | null> {
    return this.client.document.findFirst({ where: { id, ...includingArchived() } });
  }
}
