import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KairoDocument, Project } from "@/types/database";
import type { DocumentRepositoryLike } from "@/features/documents/repositories/DocumentRepository";
import type { ProjectRepositoryLike } from "@/features/projects/repositories/ProjectRepository";
import type { AuditLogRepositoryLike } from "@/lib/db/repositories/AuditLogRepository";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { DocumentService } from "@/features/documents/services/DocumentService";

// Document 13 §20 (Phase 3) — same test-strategy split documented in
// `ProjectService.test.ts` / `KnowledgeService.test.ts` / `NotesService.test.ts`.

const mockDb = {
  document: {
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

function makeDocument(overrides: Partial<KairoDocument> = {}): KairoDocument {
  return {
    id: "document-1",
    title: "Test Document",
    type: "GUIDE",
    projectId: "project-1",
    markdown: "# Content",
    version: 1,
    published: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    archivedAt: null,
    ...overrides,
  } as KairoDocument;
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
  const documentRepository: DocumentRepositoryLike = {
    findById: vi.fn(),
    findByProject: vi.fn(),
    findByIdIncludingArchived: vi.fn(),
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
  const auditLogRepository: AuditLogRepositoryLike = {
    record: vi.fn(),
    findByEntity: vi.fn(),
  };
  return { documentRepository, projectRepository, auditLogRepository };
}

const context = { userId: "user-1" };

function makeService(repos: ReturnType<typeof makeFakeRepositories>) {
  return new DocumentService(
    repos.documentRepository,
    repos.projectRepository,
    repos.auditLogRepository,
  );
}

describe("DocumentService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.document.create.mockReset();
    mockDb.document.update.mockReset();
    mockDb.document.findFirst.mockReset();
    mockDb.auditLog.create.mockReset();
  });

  describe("get", () => {
    it("throws NotFoundError when the document does not exist", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.documentRepository.findById).mockResolvedValue(null);
      const service = makeService(repos);

      await expect(service.get(context, "missing")).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when the owning project belongs to another user", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.documentRepository.findById).mockResolvedValue(makeDocument());
      vi.mocked(repos.projectRepository.findByIdIncludingArchived).mockResolvedValue(
        makeProject({ ownerId: "someone-else" }),
      );
      const service = makeService(repos);

      await expect(service.get(context, "document-1")).rejects.toThrow(ForbiddenError);
    });
  });

  describe("create", () => {
    it("throws ValidationError before opening a transaction on invalid input", async () => {
      const repos = makeFakeRepositories();
      const service = makeService(repos);

      await expect(
        service.create(context, { title: "", projectId: "not-a-uuid", markdown: "x" }),
      ).rejects.toThrow(ValidationError);
      expect(mockDb.document.create).not.toHaveBeenCalled();
    });

    it("throws ForbiddenError when the target project is not owned by the caller", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.projectRepository.findByIdIncludingArchived).mockResolvedValue(
        makeProject({ ownerId: "someone-else" }),
      );
      const service = makeService(repos);

      await expect(
        service.create(context, {
          title: "Title",
          projectId: "11111111-1111-4111-8111-111111111111",
          markdown: "x",
        }),
      ).rejects.toThrow(ForbiddenError);
      expect(mockDb.document.create).not.toHaveBeenCalled();
    });

    it("creates the document and records a CREATE audit entry", async () => {
      const repos = makeFakeRepositories();
      const created = makeDocument();
      mockDb.document.create.mockResolvedValue(created);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      const result = await service.create(context, {
        title: "Test Document",
        projectId: "11111111-1111-4111-8111-111111111111",
        markdown: "# Content",
      });

      expect(result).toEqual(created);
      expect(mockDb.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          project: { connect: { id: "11111111-1111-4111-8111-111111111111" } },
        }),
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ entity: "Document", operation: "CREATE" }),
      });
    });

    // Document 13 §28 (Amendment 26, Phase 7.5) — Phase 7 Security Report
    // finding S3: `sanitizeMarkdown()` existed but was never actually
    // called by this Service. This proves it now runs before persistence.
    it("strips raw HTML from markdown before persisting", async () => {
      const repos = makeFakeRepositories();
      mockDb.document.create.mockResolvedValue(makeDocument());
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      await service.create(context, {
        title: "Title",
        projectId: "11111111-1111-4111-8111-111111111111",
        markdown: "Safe text <script>alert(1)</script> more text",
      });

      const persisted = mockDb.document.create.mock.calls[0]![0].data.markdown as string;
      expect(persisted).not.toContain("<script");
      expect(persisted).not.toContain("alert(1)");
    });
  });

  describe("update", () => {
    it("bumps version when markdown content actually changes", async () => {
      const repos = makeFakeRepositories();
      const existing = makeDocument({ markdown: "old", version: 1 });
      vi.mocked(repos.documentRepository.findById).mockResolvedValue(existing);
      mockDb.document.update.mockResolvedValue(makeDocument({ markdown: "new", version: 2 }));
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      await service.update(context, "document-1", { markdown: "new" });

      expect(mockDb.document.update).toHaveBeenCalledWith({
        where: { id: "document-1" },
        data: expect.objectContaining({ markdown: "new", version: 2 }),
      });
    });

    it("does not bump version when markdown is unchanged", async () => {
      const repos = makeFakeRepositories();
      const existing = makeDocument({ markdown: "same", version: 1 });
      vi.mocked(repos.documentRepository.findById).mockResolvedValue(existing);
      mockDb.document.update.mockResolvedValue(makeDocument({ title: "Renamed", version: 1 }));
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      await service.update(context, "document-1", { title: "Renamed" });

      expect(mockDb.document.update).toHaveBeenCalledWith({
        where: { id: "document-1" },
        data: { title: "Renamed" },
      });
    });

    // Document 13 §28 (Amendment 26, Phase 7.5) — same finding as the
    // `create` test above, exercised on the update path. Also proves the
    // version-bump comparison uses the sanitized value (Document 13 §28's
    // comment in `DocumentService.update` explains why that matters).
    it("strips raw HTML from markdown before persisting and before the version-bump comparison", async () => {
      const repos = makeFakeRepositories();
      const existing = makeDocument({ markdown: "old", version: 1 });
      vi.mocked(repos.documentRepository.findById).mockResolvedValue(existing);
      mockDb.document.update.mockResolvedValue(makeDocument({ version: 2 }));
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      await service.update(context, "document-1", {
        markdown: "Safe text <script>alert(1)</script> more text",
      });

      const persisted = mockDb.document.update.mock.calls[0]![0].data.markdown as string;
      expect(persisted).not.toContain("<script");
      expect(persisted).not.toContain("alert(1)");
      expect(mockDb.document.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ version: 2 }) }),
      );
    });
  });

  describe("publish/unpublish", () => {
    it("publish sets published to true and records an UPDATE audit entry", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.documentRepository.findById).mockResolvedValue(
        makeDocument({ published: false }),
      );
      mockDb.document.update.mockResolvedValue(makeDocument({ published: true }));
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      const result = await service.publish(context, "document-1");

      expect(result.published).toBe(true);
      expect(mockDb.document.update).toHaveBeenCalledWith({
        where: { id: "document-1" },
        data: { published: true },
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ operation: "UPDATE", entity: "Document" }),
      });
    });

    it("unpublish sets published to false", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.documentRepository.findById).mockResolvedValue(
        makeDocument({ published: true }),
      );
      mockDb.document.update.mockResolvedValue(makeDocument({ published: false }));
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      const result = await service.unpublish(context, "document-1");

      expect(result.published).toBe(false);
      expect(mockDb.document.update).toHaveBeenCalledWith({
        where: { id: "document-1" },
        data: { published: false },
      });
    });
  });

  describe("archive/restore", () => {
    it("archives and records an ARCHIVE audit entry", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.documentRepository.findById).mockResolvedValue(makeDocument());
      mockDb.document.update.mockResolvedValue(undefined);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      await service.archive(context, "document-1");

      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ operation: "ARCHIVE", entity: "Document" }),
      });
    });

    it("throws NotFoundError on restore when missing even including archived rows", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.documentRepository.findByIdIncludingArchived).mockResolvedValue(null);
      const service = makeService(repos);

      await expect(service.restore(context, "missing")).rejects.toThrow(NotFoundError);
    });

    it("restores and records a RESTORE audit entry", async () => {
      const repos = makeFakeRepositories();
      const archived = makeDocument({ archivedAt: new Date() });
      vi.mocked(repos.documentRepository.findByIdIncludingArchived).mockResolvedValue(archived);
      mockDb.document.update.mockResolvedValue(undefined);
      const restored = makeDocument({ archivedAt: null });
      mockDb.document.findFirst.mockResolvedValue(restored);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      const result = await service.restore(context, "document-1");

      expect(result).toEqual(restored);
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ operation: "RESTORE", entity: "Document" }),
      });
    });
  });
});
