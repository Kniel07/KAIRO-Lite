import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Knowledge, Project } from "@/types/database";
import type { KnowledgeRepositoryLike } from "@/features/knowledge/repositories/KnowledgeRepository";
import type { ProjectRepositoryLike } from "@/features/projects/repositories/ProjectRepository";
import type { GovernanceRuleRepositoryLike } from "@/features/governance/repositories/GovernanceRuleRepository";
import type { AuditLogRepositoryLike } from "@/lib/db/repositories/AuditLogRepository";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { KnowledgeService } from "@/features/knowledge/services/KnowledgeService";

// Document 13 §20 (Phase 3) — same test-strategy split documented in
// `ProjectService.test.ts`: constructor-injected fakes give genuine unit
// coverage of authorization/validation/governance/read-path logic; the
// transactional write path is exercised against a stub Prisma client via
// the `@/lib/db/transaction` mock below, proving the Service assembles the
// right calls and payloads — not atomicity, which needs live Postgres.

const mockDb = {
  knowledge: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/db/transaction", () => ({
  withTransaction: (fn: (tx: unknown) => unknown) => fn(mockDb),
}));

function makeKnowledge(overrides: Partial<Knowledge> = {}): Knowledge {
  return {
    id: "knowledge-1",
    title: "Test Knowledge",
    summary: null,
    markdown: "# Content",
    projectId: null,
    category: "engineering",
    confidence: 0.5,
    status: "DRAFT",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    archivedAt: null,
    ...overrides,
  } as Knowledge;
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    name: "Test Project",
    slug: "test-project",
    description: null,
    status: "ACTIVE",
    priority: "MEDIUM",
    visibility: "PRIVATE",
    ownerId: "user-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    archivedAt: null,
    ...overrides,
  } as Project;
}

function makeFakeRepositories() {
  const knowledgeRepository: KnowledgeRepositoryLike = {
    findById: vi.fn(),
    findByProject: vi.fn(),
    findByIdIncludingArchived: vi.fn(),
    findGlobal: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
  };
  const projectRepository: ProjectRepositoryLike = {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findBySlugIncludingArchived: vi.fn(),
    findByOwner: vi.fn(),
    findByIdIncludingArchived: vi.fn().mockResolvedValue(makeProject()),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
  };
  const governanceRuleRepository: GovernanceRuleRepositoryLike = {
    findByKey: vi.fn().mockResolvedValue(null),
    list: vi.fn(),
    upsert: vi.fn(),
  };
  const auditLogRepository: AuditLogRepositoryLike = {
    record: vi.fn(),
    findByEntity: vi.fn(),
  };
  return { knowledgeRepository, projectRepository, governanceRuleRepository, auditLogRepository };
}

const context = { userId: "user-1" };

describe("KnowledgeService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.knowledge.create.mockReset();
    mockDb.knowledge.update.mockReset();
    mockDb.knowledge.findFirst.mockReset();
    mockDb.auditLog.create.mockReset();
  });

  describe("get", () => {
    it("throws NotFoundError when the knowledge item does not exist", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.knowledgeRepository.findById).mockResolvedValue(null);
      const service = new KnowledgeService(
        repos.knowledgeRepository,
        repos.projectRepository,
        repos.governanceRuleRepository,
        repos.auditLogRepository,
      );

      await expect(service.get(context, "missing")).rejects.toThrow(NotFoundError);
    });

    it("allows access to project-less knowledge for any authenticated context", async () => {
      const repos = makeFakeRepositories();
      const knowledge = makeKnowledge({ projectId: null });
      vi.mocked(repos.knowledgeRepository.findById).mockResolvedValue(knowledge);
      const service = new KnowledgeService(
        repos.knowledgeRepository,
        repos.projectRepository,
        repos.governanceRuleRepository,
        repos.auditLogRepository,
      );

      await expect(service.get(context, "knowledge-1")).resolves.toEqual(knowledge);
      expect(repos.projectRepository.findByIdIncludingArchived).not.toHaveBeenCalled();
    });

    it("throws ForbiddenError when the attached project belongs to another user", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.knowledgeRepository.findById).mockResolvedValue(
        makeKnowledge({ projectId: "project-1" }),
      );
      vi.mocked(repos.projectRepository.findByIdIncludingArchived).mockResolvedValue(
        makeProject({ ownerId: "someone-else" }),
      );
      const service = new KnowledgeService(
        repos.knowledgeRepository,
        repos.projectRepository,
        repos.governanceRuleRepository,
        repos.auditLogRepository,
      );

      await expect(service.get(context, "knowledge-1")).rejects.toThrow(ForbiddenError);
    });

    it("checks project ownership including archived projects", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.knowledgeRepository.findById).mockResolvedValue(
        makeKnowledge({ projectId: "project-1" }),
      );
      vi.mocked(repos.projectRepository.findByIdIncludingArchived).mockResolvedValue(
        makeProject({ archivedAt: new Date() }),
      );
      const service = new KnowledgeService(
        repos.knowledgeRepository,
        repos.projectRepository,
        repos.governanceRuleRepository,
        repos.auditLogRepository,
      );

      await expect(service.get(context, "knowledge-1")).resolves.toBeDefined();
    });
  });

  describe("create", () => {
    it("throws ValidationError on invalid input before any repository call", async () => {
      const repos = makeFakeRepositories();
      const service = new KnowledgeService(
        repos.knowledgeRepository,
        repos.projectRepository,
        repos.governanceRuleRepository,
        repos.auditLogRepository,
      );

      await expect(
        service.create(context, { title: "", markdown: "x", category: "engineering" }),
      ).rejects.toThrow(ValidationError);
      expect(mockDb.knowledge.create).not.toHaveBeenCalled();
    });

    it("rejects a category not present in the configured allow-list", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.governanceRuleRepository.findByKey).mockResolvedValue({
        id: "rule-1",
        key: "knowledge.allowedCategories",
        value: ["engineering", "design"],
        description: null,
        updatedAt: new Date(),
      });
      const service = new KnowledgeService(
        repos.knowledgeRepository,
        repos.projectRepository,
        repos.governanceRuleRepository,
        repos.auditLogRepository,
      );

      await expect(
        service.create(context, { title: "Title", markdown: "x", category: "finance" }),
      ).rejects.toThrow(ValidationError);
      expect(mockDb.knowledge.create).not.toHaveBeenCalled();
    });

    it("allows any category when no governance rule is configured", async () => {
      const repos = makeFakeRepositories();
      const created = makeKnowledge({ category: "anything" });
      mockDb.knowledge.create.mockResolvedValue(created);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = new KnowledgeService(
        repos.knowledgeRepository,
        repos.projectRepository,
        repos.governanceRuleRepository,
        repos.auditLogRepository,
      );

      const result = await service.create(context, {
        title: "Title",
        markdown: "x",
        category: "anything",
      });

      expect(result).toEqual(created);
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ entity: "Knowledge", operation: "CREATE" }),
      });
    });

    it("throws ForbiddenError when attaching to a project the caller does not own", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.projectRepository.findByIdIncludingArchived).mockResolvedValue(
        makeProject({ ownerId: "someone-else" }),
      );
      const service = new KnowledgeService(
        repos.knowledgeRepository,
        repos.projectRepository,
        repos.governanceRuleRepository,
        repos.auditLogRepository,
      );

      await expect(
        service.create(context, {
          title: "Title",
          markdown: "x",
          category: "engineering",
          projectId: "11111111-1111-4111-8111-111111111111",
        }),
      ).rejects.toThrow(ForbiddenError);
      expect(mockDb.knowledge.create).not.toHaveBeenCalled();
    });

    // Document 13 §28 (Amendment 26, Phase 7.5) — Phase 7 Security Report
    // finding S3: `sanitizeMarkdown()` existed but was never actually
    // called by this Service. This proves it now runs before persistence.
    it("strips raw HTML from markdown before persisting", async () => {
      const repos = makeFakeRepositories();
      mockDb.knowledge.create.mockResolvedValue(makeKnowledge());
      mockDb.auditLog.create.mockResolvedValue({});
      const service = new KnowledgeService(
        repos.knowledgeRepository,
        repos.projectRepository,
        repos.governanceRuleRepository,
        repos.auditLogRepository,
      );

      await service.create(context, {
        title: "Title",
        markdown: "Safe text <script>alert(1)</script> more text",
        category: "engineering",
      });

      const persisted = mockDb.knowledge.create.mock.calls[0]![0].data.markdown as string;
      expect(persisted).not.toContain("<script");
      expect(persisted).not.toContain("alert(1)");
      expect(persisted).toContain("Safe text");
      expect(persisted).toContain("more text");
    });
  });

  describe("update", () => {
    // Document 13 §28 (Amendment 26, Phase 7.5) — same finding as the
    // `create` test above, exercised on the update path.
    it("strips raw HTML from markdown before persisting", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.knowledgeRepository.findById).mockResolvedValue(makeKnowledge());
      mockDb.knowledge.update.mockResolvedValue(makeKnowledge());
      mockDb.auditLog.create.mockResolvedValue({});
      const service = new KnowledgeService(
        repos.knowledgeRepository,
        repos.projectRepository,
        repos.governanceRuleRepository,
        repos.auditLogRepository,
      );

      await service.update(context, "knowledge-1", {
        markdown: "Safe text <script>alert(1)</script> more text",
      });

      const persisted = mockDb.knowledge.update.mock.calls[0]![0].data.markdown as string;
      expect(persisted).not.toContain("<script");
      expect(persisted).not.toContain("alert(1)");
    });
  });

  describe("archive", () => {
    it("archives and records an ARCHIVE audit entry", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.knowledgeRepository.findById).mockResolvedValue(makeKnowledge());
      mockDb.knowledge.update.mockResolvedValue(undefined);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = new KnowledgeService(
        repos.knowledgeRepository,
        repos.projectRepository,
        repos.governanceRuleRepository,
        repos.auditLogRepository,
      );

      await service.archive(context, "knowledge-1");

      expect(mockDb.knowledge.update).toHaveBeenCalledWith({
        where: { id: "knowledge-1" },
        data: { archivedAt: expect.any(Date) },
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ operation: "ARCHIVE", entity: "Knowledge" }),
      });
    });
  });

  describe("restore", () => {
    it("throws NotFoundError when missing even including archived rows", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.knowledgeRepository.findByIdIncludingArchived).mockResolvedValue(null);
      const service = new KnowledgeService(
        repos.knowledgeRepository,
        repos.projectRepository,
        repos.governanceRuleRepository,
        repos.auditLogRepository,
      );

      await expect(service.restore(context, "missing")).rejects.toThrow(NotFoundError);
    });

    it("restores and records a RESTORE audit entry", async () => {
      const repos = makeFakeRepositories();
      const archived = makeKnowledge({ archivedAt: new Date() });
      vi.mocked(repos.knowledgeRepository.findByIdIncludingArchived).mockResolvedValue(archived);
      mockDb.knowledge.update.mockResolvedValue(undefined);
      const restored = makeKnowledge({ archivedAt: null });
      mockDb.knowledge.findFirst.mockResolvedValue(restored);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = new KnowledgeService(
        repos.knowledgeRepository,
        repos.projectRepository,
        repos.governanceRuleRepository,
        repos.auditLogRepository,
      );

      const result = await service.restore(context, "knowledge-1");

      expect(result).toEqual(restored);
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ operation: "RESTORE", entity: "Knowledge" }),
      });
    });
  });
});
