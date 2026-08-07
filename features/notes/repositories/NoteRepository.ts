import { Prisma } from "@/generated/prisma/client";
import type { Note } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { includingArchived, onlyArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 6 §22, Document 13 §3 (Amendment 2) — feature-owned repository.
// Soft-delete exclusion is enforced by `lib/db/soft-delete-extension.ts`
// (Phase 2 hardening review).
export class NoteRepository implements Repository<
  Note,
  Prisma.NoteCreateInput,
  Prisma.NoteUpdateInput
> {
  async findById(id: string): Promise<Note | null> {
    return prisma.note.findFirst({ where: { id } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<Note>> {
    const [items, total] = await Promise.all([
      prisma.note.findMany({ ...toPagination(params) }),
      prisma.note.count(),
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

  /** Escape hatch — archived rows only. */
  async findArchived(params?: FindManyParams): Promise<PagedResult<Note>> {
    const where = onlyArchived();
    const [items, total] = await Promise.all([
      prisma.note.findMany({ where, ...toPagination(params) }),
      prisma.note.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — both archived and active rows. */
  async findIncludingArchived(params?: FindManyParams): Promise<PagedResult<Note>> {
    const where = includingArchived();
    const [items, total] = await Promise.all([
      prisma.note.findMany({ where, ...toPagination(params) }),
      prisma.note.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — reverses `archive()`. Mutations bypass the extension. */
  async restore(id: string): Promise<void> {
    await prisma.note.update({ where: { id }, data: { archivedAt: null } });
  }
}
