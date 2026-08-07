import type { Prisma, Settings } from "@/generated/prisma/client";
import { prisma, type Db } from "@/lib/db/client";

// Document 10 §5.11 — Settings is a 1:1 config row with no `archivedAt`
// (Document 10 §4's explicit exception list), so it deliberately does not
// implement the generic `Repository<T, C, U>` shape — there is no
// meaningful `findMany`/`archive` for a per-user singleton.
//
// Constructor-injected `client` (Phase 3, transaction boundaries) — see
// `UserRepository` for the pattern this follows. Not used by any Phase 3
// Service — refactored now for consistency.
export class SettingsRepository {
  constructor(private readonly client: Db = prisma) {}

  async findByUserId(userId: string): Promise<Settings | null> {
    return this.client.settings.findUnique({ where: { userId } });
  }

  async create(input: Prisma.SettingsCreateInput): Promise<Settings> {
    return this.client.settings.create({ data: input });
  }

  async update(userId: string, input: Prisma.SettingsUpdateInput): Promise<Settings> {
    return this.client.settings.update({ where: { userId }, data: input });
  }
}
