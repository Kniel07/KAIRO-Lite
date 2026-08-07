import type { Prisma, Settings } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";

// Document 10 §5.11 — Settings is a 1:1 config row with no `archivedAt`
// (Document 10 §4's explicit exception list), so it deliberately does not
// implement the generic `Repository<T, C, U>` shape — there is no
// meaningful `findMany`/`archive` for a per-user singleton.
export class SettingsRepository {
  async findByUserId(userId: string): Promise<Settings | null> {
    return prisma.settings.findUnique({ where: { userId } });
  }

  async create(input: Prisma.SettingsCreateInput): Promise<Settings> {
    return prisma.settings.create({ data: input });
  }

  async update(userId: string, input: Prisma.SettingsUpdateInput): Promise<Settings> {
    return prisma.settings.update({ where: { userId }, data: input });
  }
}
