import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/types/database";
import type { ProjectRepositoryLike } from "@/features/projects/repositories/ProjectRepository";
import type { AuditLogRepositoryLike } from "@/lib/db/repositories/AuditLogRepository";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { ProjectService } from "@/features/projects/services/ProjectService";

// Document 13 §20 (Phase 3) — test strategy split, documented explicitly
// rather than overclaiming "pure unit tests":
//
// `get`/`list`/the auth-check prefix of `update`/`archive`/`restore`, and
// validation/slug-collision logic in `create` all run against the
// constructor-injected `ProjectRepositoryLike`/`AuditLogRepositoryLike`
// fakes below — genuine unit tests, no I/O.
//
// The write path inside every mutating method opens `withTransaction` and
// constructs *fresh* `ProjectRepository(tx)`/`AuditLogRepository(tx)`
// instances from the real classes (by design — see `ProjectService`'s
// header comment), bypassing the constructor-injected fakes entirely. To
// exercise that path without a live Postgres connection, `@/lib/db/transaction`
// is mocked below to hand the callback a stub Prisma client (`mockDb`)
// exposing only the model-delegate methods those two repositories call.
// This proves the Service assembles the correct `create`/`update`/`record`
// calls and audit payloads — it does NOT prove atomicity (that a failed
// audit write rolls back the entity write). That proof requires a real
// transaction against Postgres and is covered separately by the Phase 3
// live-DB verification (Document 9 Phase 3 sign-off), not by this file.

const mockDb = {
  project: {
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
  const projectRepository: ProjectRepositoryLike = {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findBySlugIncludingArchived: vi.fn().mockResolvedValue(null),
    findByOwner: vi.fn(),
    findByIdIncludingArchived: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
  };
  const auditLogRepository: AuditLogRepositoryLike = {
    record: vi.fn(),
    findByEntity: vi.fn(),
  };
  return { projectRepository, auditLogRepository };
}

const context = { userId: "user-1" };

describe("ProjectService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.project.create.mockReset();
    mockDb.project.update.mockReset();
    mockDb.project.findFirst.mockReset();
    mockDb.auditLog.create.mockReset();
  });

  describe("get", () => {
    it("throws NotFoundError when the project does not exist", async () => {
      const { projectRepository, auditLogRepository } = makeFakeRepositories();
      vi.mocked(projectRepository.findById).mockResolvedValue(null);
      const service = new ProjectService(projectRepository, auditLogRepository);

      await expect(service.get(context, "missing")).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when the project belongs to another user", async () => {
      const { projectRepository, auditLogRepository } = makeFakeRepositories();
      vi.mocked(projectRepository.findById).mockResolvedValue(
        makeProject({ ownerId: "someone-else" }),
      );
      const service = new ProjectService(projectRepository, auditLogRepository);

      await expect(service.get(context, "project-1")).rejects.toThrow(ForbiddenError);
    });

    it("returns the project when the caller owns it", async () => {
      const { projectRepository, auditLogRepository } = makeFakeRepositories();
      const project = makeProject();
      vi.mocked(projectRepository.findById).mockResolvedValue(project);
      const service = new ProjectService(projectRepository, auditLogRepository);

      await expect(service.get(context, "project-1")).resolves.toEqual(project);
    });
  });

  describe("list", () => {
    it("scopes the listing to the requesting owner", async () => {
      const { projectRepository, auditLogRepository } = makeFakeRepositories();
      vi.mocked(projectRepository.findByOwner).mockResolvedValue({ items: [], total: 0 });
      const service = new ProjectService(projectRepository, auditLogRepository);

      await service.list(context, { page: 2, pageSize: 10 });

      expect(projectRepository.findByOwner).toHaveBeenCalledWith("user-1", {
        page: 2,
        pageSize: 10,
      });
    });
  });

  describe("create", () => {
    it("throws ValidationError before opening a transaction on invalid input", async () => {
      const { projectRepository, auditLogRepository } = makeFakeRepositories();
      const service = new ProjectService(projectRepository, auditLogRepository);

      await expect(service.create(context, { name: "" })).rejects.toThrow(ValidationError);
      expect(mockDb.project.create).not.toHaveBeenCalled();
    });

    it("derives a slug, creates the project, and records a CREATE audit entry atomically", async () => {
      const { projectRepository, auditLogRepository } = makeFakeRepositories();
      vi.mocked(projectRepository.findBySlugIncludingArchived).mockResolvedValue(null);
      const created = makeProject({ name: "My Project", slug: "my-project" });
      mockDb.project.create.mockResolvedValue(created);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = new ProjectService(projectRepository, auditLogRepository);

      const result = await service.create(context, { name: "My Project" });

      expect(result).toEqual(created);
      expect(mockDb.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: "My Project",
          slug: "my-project",
          owner: { connect: { id: "user-1" } },
        }),
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entity: "Project",
          entityId: created.id,
          operation: "CREATE",
        }),
      });
    });

    it("appends a numeric suffix when the derived slug collides", async () => {
      const { projectRepository, auditLogRepository } = makeFakeRepositories();
      vi.mocked(projectRepository.findBySlugIncludingArchived).mockImplementation(
        async (slug: string) => (slug === "my-project" ? makeProject({ slug }) : null),
      );
      mockDb.project.create.mockResolvedValue(makeProject({ slug: "my-project-2" }));
      mockDb.auditLog.create.mockResolvedValue({});
      const service = new ProjectService(projectRepository, auditLogRepository);

      await service.create(context, { name: "My Project" });

      expect(mockDb.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ slug: "my-project-2" }),
      });
    });
  });

  describe("update", () => {
    it("propagates NotFoundError from the ownership check before opening a transaction", async () => {
      const { projectRepository, auditLogRepository } = makeFakeRepositories();
      vi.mocked(projectRepository.findById).mockResolvedValue(null);
      const service = new ProjectService(projectRepository, auditLogRepository);

      await expect(service.update(context, "missing", { name: "New" })).rejects.toThrow(
        NotFoundError,
      );
      expect(mockDb.project.update).not.toHaveBeenCalled();
    });

    it("updates only the provided fields and records a before/after audit entry", async () => {
      const { projectRepository, auditLogRepository } = makeFakeRepositories();
      const existing = makeProject({ description: "old" });
      vi.mocked(projectRepository.findById).mockResolvedValue(existing);
      const updated = makeProject({ description: "new" });
      mockDb.project.update.mockResolvedValue(updated);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = new ProjectService(projectRepository, auditLogRepository);

      const result = await service.update(context, "project-1", { description: "new" });

      expect(result).toEqual(updated);
      expect(mockDb.project.update).toHaveBeenCalledWith({
        where: { id: "project-1" },
        data: { description: "new" },
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ operation: "UPDATE", entityId: "project-1" }),
      });
    });
  });

  describe("archive", () => {
    it("throws ForbiddenError instead of archiving when the caller does not own the project", async () => {
      const { projectRepository, auditLogRepository } = makeFakeRepositories();
      vi.mocked(projectRepository.findById).mockResolvedValue(
        makeProject({ ownerId: "someone-else" }),
      );
      const service = new ProjectService(projectRepository, auditLogRepository);

      await expect(service.archive(context, "project-1")).rejects.toThrow(ForbiddenError);
      expect(mockDb.project.update).not.toHaveBeenCalled();
    });

    it("archives the project and records an ARCHIVE audit entry", async () => {
      const { projectRepository, auditLogRepository } = makeFakeRepositories();
      vi.mocked(projectRepository.findById).mockResolvedValue(makeProject());
      mockDb.project.update.mockResolvedValue(undefined);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = new ProjectService(projectRepository, auditLogRepository);

      await service.archive(context, "project-1");

      expect(mockDb.project.update).toHaveBeenCalledWith({
        where: { id: "project-1" },
        data: { archivedAt: expect.any(Date) },
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ operation: "ARCHIVE", entityId: "project-1" }),
      });
    });
  });

  describe("restore", () => {
    it("throws NotFoundError when the project does not exist even including archived rows", async () => {
      const { projectRepository, auditLogRepository } = makeFakeRepositories();
      vi.mocked(projectRepository.findByIdIncludingArchived).mockResolvedValue(null);
      const service = new ProjectService(projectRepository, auditLogRepository);

      await expect(service.restore(context, "missing")).rejects.toThrow(NotFoundError);
    });

    it("restores the project and records a RESTORE audit entry with before/after state", async () => {
      const { projectRepository, auditLogRepository } = makeFakeRepositories();
      const archived = makeProject({ archivedAt: new Date("2026-01-02T00:00:00.000Z") });
      vi.mocked(projectRepository.findByIdIncludingArchived).mockResolvedValue(archived);
      mockDb.project.update.mockResolvedValue(undefined);
      const restored = makeProject({ archivedAt: null });
      mockDb.project.findFirst.mockResolvedValue(restored);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = new ProjectService(projectRepository, auditLogRepository);

      const result = await service.restore(context, "project-1");

      expect(result).toEqual(restored);
      expect(mockDb.project.update).toHaveBeenCalledWith({
        where: { id: "project-1" },
        data: { archivedAt: null },
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ operation: "RESTORE", entityId: "project-1" }),
      });
    });
  });
});
