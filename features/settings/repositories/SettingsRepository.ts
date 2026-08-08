import type { Prisma, Settings } from "@/generated/prisma/client";
import { prisma, type Db } from "@/lib/db/client";

// Document 10 §5.11 — Settings is a 1:1 config row with no `archivedAt`
// (Document 10 §4's explicit exception list), so it deliberately does not
// implement the generic `Repository<T, C, U>` shape — there is no
// meaningful `findMany`/`archive` for a per-user singleton.
//
// Interface `SettingsService` depends on (Document 7 §8) — see
// `ProjectRepositoryLike` for why this exists alongside the concrete class.
export interface SettingsRepositoryLike {
  findByUserId(userId: string): Promise<Settings | null>;
  create(input: Prisma.SettingsCreateInput): Promise<Settings>;
  update(userId: string, input: Prisma.SettingsUpdateInput): Promise<Settings>;
}

// Constructor-injected `client` (Phase 3, transaction boundaries) — see
// `UserRepository` for the pattern this follows. Used by `SettingsService`
// (Phase 4 — see that file's header comment for why Phase 3's module list
// didn't include it but Phase 4 needs it).
export class SettingsRepository implements SettingsRepositoryLike {
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
