import { Prisma } from "@/generated/prisma/client";
import type { User } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { includingArchived, onlyArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 13 §3 (Amendment 2) — cross-cutting repository (used outside any
// single feature — e.g. by AuditLog actor lookups), lives in
// `lib/db/repositories/`. Document 7 §8 — pure data access; User row
// creation for sign-in itself is owned by the Auth.js Prisma Adapter
// (Document 11 §2), not this repository.
//
// Soft-delete exclusion is enforced by `lib/db/soft-delete-extension.ts`
// (Phase 2 hardening review) — this also means an archived User cannot be
// resolved by the Auth.js adapter's own internal lookups, since the
// adapter shares this same extended `prisma` client instance.
export class UserRepository implements Repository<
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput
> {
  async findById(id: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findFirst({ where: { email } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<User>> {
    const [items, total] = await Promise.all([
      prisma.user.findMany({ ...toPagination(params) }),
      prisma.user.count(),
    ]);
    return { items, total };
  }

  async create(input: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data: input });
  }

  async update(id: string, input: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({ where: { id }, data: input });
  }

  async archive(id: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  /** Escape hatch — archived rows only. */
  async findArchived(params?: FindManyParams): Promise<PagedResult<User>> {
    const where = onlyArchived();
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, ...toPagination(params) }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — both archived and active rows. */
  async findIncludingArchived(params?: FindManyParams): Promise<PagedResult<User>> {
    const where = includingArchived();
    const [items, total] = await Promise.all([
      prisma.user.findMany({ where, ...toPagination(params) }),
      prisma.user.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — reverses `archive()`. Mutations bypass the extension. */
  async restore(id: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { archivedAt: null } });
  }
}
