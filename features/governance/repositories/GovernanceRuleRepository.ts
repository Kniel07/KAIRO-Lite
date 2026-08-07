import type { GovernanceRule, Prisma } from "@/generated/prisma/client";
import { prisma, type Db } from "@/lib/db/client";

// Document 10 §5.12 / Document 13 §4 — a key-value config table, "upserted,
// not lifecycle-tracked" (Document 10 §5.12) — no `createdAt`/`archivedAt`,
// so this deliberately does not implement the generic `Repository<T,C,U>`
// shape.

// Interface `GovernanceService` depends on (Document 7 §8) — lets unit
// tests substitute a fake without touching Prisma.
export interface GovernanceRuleRepositoryLike {
  findByKey(key: string): Promise<GovernanceRule | null>;
  list(): Promise<GovernanceRule[]>;
  upsert(key: string, value: Prisma.InputJsonValue, description?: string): Promise<GovernanceRule>;
}

// Constructor-injected `client` (Phase 3, transaction boundaries) — see
// `UserRepository` for the pattern this follows.
export class GovernanceRuleRepository implements GovernanceRuleRepositoryLike {
  constructor(private readonly client: Db = prisma) {}

  async findByKey(key: string): Promise<GovernanceRule | null> {
    return this.client.governanceRule.findUnique({ where: { key } });
  }

  async list(): Promise<GovernanceRule[]> {
    return this.client.governanceRule.findMany({ orderBy: { key: "asc" } });
  }

  async upsert(
    key: string,
    value: Prisma.InputJsonValue,
    description?: string,
  ): Promise<GovernanceRule> {
    return this.client.governanceRule.upsert({
      where: { key },
      create: { key, value, description },
      update: { value, description },
    });
  }
}
