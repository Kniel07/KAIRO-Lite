import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GovernanceRule } from "@/types/database";
import type { GovernanceRuleRepositoryLike } from "@/features/governance/repositories/GovernanceRuleRepository";
import type { AuditLogRepositoryLike } from "@/lib/db/repositories/AuditLogRepository";
import { ValidationError } from "@/lib/utils/errors";
import { GovernanceService } from "@/features/governance/services/GovernanceService";

// Document 13 §20 (Phase 3) — same test-strategy split documented in the
// other Phase 3 Service test files.

const mockDb = {
  governanceRule: {
    upsert: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/db/transaction", () => ({
  withTransaction: (fn: (tx: unknown) => unknown) => fn(mockDb),
}));

function makeRule(overrides: Partial<GovernanceRule> = {}): GovernanceRule {
  return {
    id: "rule-1",
    key: "knowledge.allowedCategories",
    value: ["engineering"],
    description: null,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as GovernanceRule;
}

function makeFakeRepositories() {
  const governanceRuleRepository: GovernanceRuleRepositoryLike = {
    findByKey: vi.fn(),
    list: vi.fn(),
    upsert: vi.fn(),
  };
  const auditLogRepository: AuditLogRepositoryLike = {
    record: vi.fn(),
    findByEntity: vi.fn(),
  };
  return { governanceRuleRepository, auditLogRepository };
}

const context = { userId: "user-1" };

function makeService(repos: ReturnType<typeof makeFakeRepositories>) {
  return new GovernanceService(repos.governanceRuleRepository, repos.auditLogRepository);
}

describe("GovernanceService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.governanceRule.upsert.mockReset();
    mockDb.auditLog.create.mockReset();
  });

  describe("get", () => {
    it("returns null when the rule is not configured", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.governanceRuleRepository.findByKey).mockResolvedValue(null);
      const service = makeService(repos);

      await expect(service.get("missing.key")).resolves.toBeNull();
    });

    it("returns the rule when configured", async () => {
      const repos = makeFakeRepositories();
      const rule = makeRule();
      vi.mocked(repos.governanceRuleRepository.findByKey).mockResolvedValue(rule);
      const service = makeService(repos);

      await expect(service.get("knowledge.allowedCategories")).resolves.toEqual(rule);
    });
  });

  describe("list", () => {
    it("delegates to the repository", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.governanceRuleRepository.list).mockResolvedValue([makeRule()]);
      const service = makeService(repos);

      const result = await service.list();

      expect(result).toHaveLength(1);
      expect(repos.governanceRuleRepository.list).toHaveBeenCalled();
    });
  });

  describe("set", () => {
    it("throws ValidationError before opening a transaction on invalid input", async () => {
      const repos = makeFakeRepositories();
      const service = makeService(repos);

      await expect(service.set(context, { key: "", value: "x" })).rejects.toThrow(ValidationError);
      expect(mockDb.governanceRule.upsert).not.toHaveBeenCalled();
    });

    it("upserts a new rule and records a GOVERNANCE_CHANGE audit entry with no 'before'", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.governanceRuleRepository.findByKey).mockResolvedValue(null);
      const created = makeRule({ value: ["engineering", "design"] });
      mockDb.governanceRule.upsert.mockResolvedValue(created);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      const result = await service.set(context, {
        key: "knowledge.allowedCategories",
        value: ["engineering", "design"],
      });

      expect(result).toEqual(created);
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ entity: "GovernanceRule", operation: "GOVERNANCE_CHANGE" }),
      });
      const dataArg = mockDb.auditLog.create.mock.calls[0]?.[0]?.data;
      expect(dataArg.before).toBeUndefined();
    });

    it("upserts an existing rule and records before/after in the audit entry", async () => {
      const repos = makeFakeRepositories();
      const existing = makeRule({ value: ["engineering"] });
      vi.mocked(repos.governanceRuleRepository.findByKey).mockResolvedValue(existing);
      const updated = makeRule({ value: ["engineering", "design"] });
      mockDb.governanceRule.upsert.mockResolvedValue(updated);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      await service.set(context, {
        key: "knowledge.allowedCategories",
        value: ["engineering", "design"],
      });

      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entity: "GovernanceRule",
          operation: "GOVERNANCE_CHANGE",
          before: expect.objectContaining({ value: ["engineering"] }),
          after: expect.objectContaining({ value: ["engineering", "design"] }),
        }),
      });
    });
  });
});
