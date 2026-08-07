import { Prisma } from "@/generated/prisma/client";
import type { Project } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { notArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 6 §22 — repository naming. Document 13 §3 (Amendment 2) —
// feature-owned repository, lives in `features/projects/repositories/`.
// Document 7 §8 — pure data access only, no authorization/business logic
// (that belongs to `ProjectService`, Phase 3).
export class ProjectRepository implements Repository<
  Project,
  Prisma.ProjectCreateInput,
  Prisma.ProjectUpdateInput
> {
  async findById(id: string): Promise<Project | null> {
    return prisma.project.findFirst({ where: { id, ...notArchived() } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<Project>> {
    const where = notArchived();
    const [items, total] = await Promise.all([
      prisma.project.findMany({ where, ...toPagination(params) }),
      prisma.project.count({ where }),
    ]);
    return { items, total };
  }

  async create(input: Prisma.ProjectCreateInput): Promise<Project> {
    return prisma.project.create({ data: input });
  }

  async update(id: string, input: Prisma.ProjectUpdateInput): Promise<Project> {
    return prisma.project.update({ where: { id }, data: input });
  }

  async archive(id: string): Promise<void> {
    await prisma.project.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
