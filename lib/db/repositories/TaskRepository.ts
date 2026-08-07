import { Prisma } from "@/generated/prisma/client";
import type { Task } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { notArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 13 §3 (Amendment 2) / §6 (Amendment 5) — Task has no owning
// feature in Document 5's feature list, so this is a cross-cutting
// repository. Included for schema completeness only — no Service, API
// route, or UI may use it yet (Task remains a schema placeholder).
export class TaskRepository implements Repository<
  Task,
  Prisma.TaskCreateInput,
  Prisma.TaskUpdateInput
> {
  async findById(id: string): Promise<Task | null> {
    return prisma.task.findFirst({ where: { id, ...notArchived() } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<Task>> {
    const where = notArchived();
    const [items, total] = await Promise.all([
      prisma.task.findMany({ where, ...toPagination(params) }),
      prisma.task.count({ where }),
    ]);
    return { items, total };
  }

  async create(input: Prisma.TaskCreateInput): Promise<Task> {
    return prisma.task.create({ data: input });
  }

  async update(id: string, input: Prisma.TaskUpdateInput): Promise<Task> {
    return prisma.task.update({ where: { id }, data: input });
  }

  async archive(id: string): Promise<void> {
    await prisma.task.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
