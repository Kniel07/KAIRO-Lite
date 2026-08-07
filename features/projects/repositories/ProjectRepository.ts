import { Prisma } from "@/generated/prisma/client";
import type { Project } from "@/generated/prisma/client";
import { prisma, type Db } from "@/lib/db/client";
import { includingArchived, onlyArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 6 §22 — repository naming. Document 13 §3 (Amendment 2) —
// feature-owned repository, lives in `features/projects/repositories/`.
// Document 7 §8 — pure data access only, no authorization/business logic
// (that belongs to `ProjectService`, Phase 3).
//
// Soft-delete exclusion is enforced by `lib/db/soft-delete-extension.ts`
// (Phase 2 hardening review) — `findById`/`findMany` below pass no
// `archivedAt` filter themselves and still exclude archived rows.
//
// Interface `ProjectService` depends on (Document 7 §8) — lets unit tests
// substitute a fake without touching Prisma. Extends the generic shape
// with the extra finder methods `ProjectService` actually needs; a plain
// object literal can satisfy this (no private fields), unlike the
// concrete class itself.
export interface ProjectRepositoryLike extends Repository<
  Project,
  Prisma.ProjectCreateInput,
  Prisma.ProjectUpdateInput
> {
  findBySlug(slug: string): Promise<Project | null>;
  findBySlugIncludingArchived(slug: string): Promise<Project | null>;
  findByOwner(ownerId: string, params?: FindManyParams): Promise<PagedResult<Project>>;
  findByIdIncludingArchived(id: string): Promise<Project | null>;
}

// Constructor-injected `client` (Phase 3, transaction boundaries) — see
// `UserRepository` for the pattern this follows.
export class ProjectRepository implements ProjectRepositoryLike {
  constructor(private readonly client: Db = prisma) {}

  async findById(id: string): Promise<Project | null> {
    return this.client.project.findFirst({ where: { id } });
  }

  async findBySlug(slug: string): Promise<Project | null> {
    return this.client.project.findFirst({ where: { slug } });
  }

  /**
   * `slug` (Document 10 §5.2) is globally unique at the DB level, including
   * archived rows, so `ProjectService.generateUniqueSlug` must check past
   * the soft-delete extension's default exclusion rather than use
   * `findBySlug` alone.
   */
  async findBySlugIncludingArchived(slug: string): Promise<Project | null> {
    return this.client.project.findFirst({ where: { slug, ...includingArchived() } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<Project>> {
    const [items, total] = await Promise.all([
      this.client.project.findMany({ ...toPagination(params) }),
      this.client.project.count(),
    ]);
    return { items, total };
  }

  /** ProjectService uses this to scope listings to the requesting owner (Document 11 §7). */
  async findByOwner(ownerId: string, params?: FindManyParams): Promise<PagedResult<Project>> {
    const where = { ownerId };
    const [items, total] = await Promise.all([
      this.client.project.findMany({ where, ...toPagination(params) }),
      this.client.project.count({ where }),
    ]);
    return { items, total };
  }

  async create(input: Prisma.ProjectCreateInput): Promise<Project> {
    return this.client.project.create({ data: input });
  }

  async update(id: string, input: Prisma.ProjectUpdateInput): Promise<Project> {
    return this.client.project.update({ where: { id }, data: input });
  }

  async archive(id: string): Promise<void> {
    await this.client.project.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  /** Escape hatch — archived rows only. */
  async findArchived(params?: FindManyParams): Promise<PagedResult<Project>> {
    const where = onlyArchived();
    const [items, total] = await Promise.all([
      this.client.project.findMany({ where, ...toPagination(params) }),
      this.client.project.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — both archived and active rows. */
  async findIncludingArchived(params?: FindManyParams): Promise<PagedResult<Project>> {
    const where = includingArchived();
    const [items, total] = await Promise.all([
      this.client.project.findMany({ where, ...toPagination(params) }),
      this.client.project.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — reverses `archive()`. Mutations bypass the extension. */
  async restore(id: string): Promise<void> {
    await this.client.project.update({ where: { id }, data: { archivedAt: null } });
  }

  /** Used by restore-with-authorization flows that must inspect an archived row's owner first. */
  async findByIdIncludingArchived(id: string): Promise<Project | null> {
    return this.client.project.findFirst({ where: { id, ...includingArchived() } });
  }
}
