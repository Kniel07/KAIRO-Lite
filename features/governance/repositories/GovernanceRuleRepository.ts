import type { GovernanceRule, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";

// Document 10 §5.12 / Document 13 §4 — a key-value config table, "upserted,
// not lifecycle-tracked" (Document 10 §5.12) — no `createdAt`/`archivedAt`,
// so this deliberately does not implement the generic `Repository<T,C,U>`
// shape.
export class GovernanceRuleRepository {
  async findByKey(key: string): Promise<GovernanceRule | null> {
    return prisma.governanceRule.findUnique({ where: { key } });
  }

  async list(): Promise<GovernanceRule[]> {
    return prisma.governanceRule.findMany({ orderBy: { key: "asc" } });
  }

  async upsert(
    key: string,
    value: Prisma.InputJsonValue,
    description?: string,
  ): Promise<GovernanceRule> {
    return prisma.governanceRule.upsert({
      where: { key },
      create: { key, value, description },
      update: { value, description },
    });
  }
}
