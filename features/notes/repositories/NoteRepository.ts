import { Prisma } from "@/generated/prisma/client";
import type { Note } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { notArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 6 §22, Document 13 §3 (Amendment 2) — feature-owned repository.
export class NoteRepository implements Repository<
  Note,
  Prisma.NoteCreateInput,
  Prisma.NoteUpdateInput
> {
  async findById(id: string): Promise<Note | null> {
    return prisma.note.findFirst({ where: { id, ...notArchived() } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<Note>> {
    const where = notArchived();
    const [items, total] = await Promise.all([
      prisma.note.findMany({ where, ...toPagination(params) }),
      prisma.note.count({ where }),
    ]);
    return { items, total };
  }

  async create(input: Prisma.NoteCreateInput): Promise<Note> {
    return prisma.note.create({ data: input });
  }

  async update(id: string, input: Prisma.NoteUpdateInput): Promise<Note> {
    return prisma.note.update({ where: { id }, data: input });
  }

  async archive(id: string): Promise<void> {
    await prisma.note.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
