import { Prisma } from "@/generated/prisma/client";
import type { Note } from "@/generated/prisma/client";
import { prisma, type Db } from "@/lib/db/client";
import { includingArchived, onlyArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 6 §22, Document 13 §3 (Amendment 2) — feature-owned repository.
// Soft-delete exclusion is enforced by `lib/db/soft-delete-extension.ts`
// (Phase 2 hardening review).
//
// Interface `NotesService` depends on (Document 7 §8) — see
// `ProjectRepositoryLike` for why this exists alongside the generic shape.
export interface NoteRepositoryLike extends Repository<
  Note,
  Prisma.NoteCreateInput,
  Prisma.NoteUpdateInput
> {
  findByAuthor(authorId: string, params?: FindManyParams): Promise<PagedResult<Note>>;
  findByIdIncludingArchived(id: string): Promise<Note | null>;
}

// Constructor-injected `client` (Phase 3, transaction boundaries) — see
// `UserRepository` for the pattern this follows.
export class NoteRepository implements NoteRepositoryLike {
  constructor(private readonly client: Db = prisma) {}

  async findById(id: string): Promise<Note | null> {
    return this.client.note.findFirst({ where: { id } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<Note>> {
    const [items, total] = await Promise.all([
      this.client.note.findMany({ ...toPagination(params) }),
      this.client.note.count(),
    ]);
    return { items, total };
  }

  /** NotesService uses this to scope listings to the requesting author (Document 11 §7). */
  async findByAuthor(authorId: string, params?: FindManyParams): Promise<PagedResult<Note>> {
    const where = { authorId };
    const [items, total] = await Promise.all([
      this.client.note.findMany({ where, ...toPagination(params) }),
      this.client.note.count({ where }),
    ]);
    return { items, total };
  }

  async create(input: Prisma.NoteCreateInput): Promise<Note> {
    return this.client.note.create({ data: input });
  }

  async update(id: string, input: Prisma.NoteUpdateInput): Promise<Note> {
    return this.client.note.update({ where: { id }, data: input });
  }

  async archive(id: string): Promise<void> {
    await this.client.note.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  /** Escape hatch — archived rows only. */
  async findArchived(params?: FindManyParams): Promise<PagedResult<Note>> {
    const where = onlyArchived();
    const [items, total] = await Promise.all([
      this.client.note.findMany({ where, ...toPagination(params) }),
      this.client.note.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — both archived and active rows. */
  async findIncludingArchived(params?: FindManyParams): Promise<PagedResult<Note>> {
    const where = includingArchived();
    const [items, total] = await Promise.all([
      this.client.note.findMany({ where, ...toPagination(params) }),
      this.client.note.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — reverses `archive()`. Mutations bypass the extension. */
  async restore(id: string): Promise<void> {
    await this.client.note.update({ where: { id }, data: { archivedAt: null } });
  }

  /** Used by restore-with-authorization flows that must inspect an archived row first. */
  async findByIdIncludingArchived(id: string): Promise<Note | null> {
    return this.client.note.findFirst({ where: { id, ...includingArchived() } });
  }
}
