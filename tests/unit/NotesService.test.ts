import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Note, Project } from "@/types/database";
import type { NoteRepositoryLike } from "@/features/notes/repositories/NoteRepository";
import type { ProjectRepositoryLike } from "@/features/projects/repositories/ProjectRepository";
import type { GovernanceRuleRepositoryLike } from "@/features/governance/repositories/GovernanceRuleRepository";
import type { AuditLogRepositoryLike } from "@/lib/db/repositories/AuditLogRepository";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/utils/errors";
import { NotesService } from "@/features/notes/services/NotesService";

// Document 13 §20 (Phase 3) — same test-strategy split documented in
// `ProjectService.test.ts` / `KnowledgeService.test.ts`.

const mockDb = {
  note: {
    create: vi.fn(),
    update: vi.fn(),
    findFirst: vi.fn(),
  },
  knowledge: {
    create: vi.fn(),
  },
  document: {
    create: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
};

vi.mock("@/lib/db/transaction", () => ({
  withTransaction: (fn: (tx: unknown) => unknown) => fn(mockDb),
}));

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    title: "Test Note",
    content: "Some content",
    projectId: null,
    authorId: "user-1",
    noteType: "IDEA",
    source: "MANUAL",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    archivedAt: null,
    ...overrides,
  } as Note;
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
  const noteRepository: NoteRepositoryLike = {
    findById: vi.fn(),
    findByAuthor: vi.fn(),
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
  const governanceRuleRepository: GovernanceRuleRepositoryLike = {
    findByKey: vi.fn().mockResolvedValue(null),
    list: vi.fn(),
    upsert: vi.fn(),
  };
  const auditLogRepository: AuditLogRepositoryLike = {
    record: vi.fn(),
    findByEntity: vi.fn(),
  };
  return { noteRepository, projectRepository, governanceRuleRepository, auditLogRepository };
}

const context = { userId: "user-1" };

function makeService(repos: ReturnType<typeof makeFakeRepositories>) {
  return new NotesService(
    repos.noteRepository,
    repos.projectRepository,
    repos.governanceRuleRepository,
    repos.auditLogRepository,
  );
}

describe("NotesService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.note.create.mockReset();
    mockDb.note.update.mockReset();
    mockDb.note.findFirst.mockReset();
    mockDb.knowledge.create.mockReset();
    mockDb.document.create.mockReset();
    mockDb.auditLog.create.mockReset();
  });

  describe("get", () => {
    it("throws NotFoundError when the note does not exist", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.noteRepository.findById).mockResolvedValue(null);
      const service = makeService(repos);

      await expect(service.get(context, "missing")).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when the note belongs to another author", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.noteRepository.findById).mockResolvedValue(
        makeNote({ authorId: "someone-else" }),
      );
      const service = makeService(repos);

      await expect(service.get(context, "note-1")).rejects.toThrow(ForbiddenError);
    });
  });

  describe("list", () => {
    it("scopes the listing to the requesting author", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.noteRepository.findByAuthor).mockResolvedValue({ items: [], total: 0 });
      const service = makeService(repos);

      await service.list(context, { page: 1 });

      expect(repos.noteRepository.findByAuthor).toHaveBeenCalledWith("user-1", { page: 1 });
    });
  });

  describe("create", () => {
    it("throws ValidationError before opening a transaction on invalid input", async () => {
      const repos = makeFakeRepositories();
      const service = makeService(repos);

      await expect(service.create(context, { title: "", content: "x" })).rejects.toThrow(
        ValidationError,
      );
      expect(mockDb.note.create).not.toHaveBeenCalled();
    });

    it("throws ForbiddenError when attaching to a project the caller does not own", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.projectRepository.findByIdIncludingArchived).mockResolvedValue(
        makeProject({ ownerId: "someone-else" }),
      );
      const service = makeService(repos);

      await expect(
        service.create(context, {
          title: "Title",
          content: "x",
          projectId: "11111111-1111-4111-8111-111111111111",
        }),
      ).rejects.toThrow(ForbiddenError);
      expect(mockDb.note.create).not.toHaveBeenCalled();
    });

    it("creates the note with the caller as author and records a CREATE audit entry", async () => {
      const repos = makeFakeRepositories();
      const created = makeNote();
      mockDb.note.create.mockResolvedValue(created);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      const result = await service.create(context, { title: "Title", content: "x" });

      expect(result).toEqual(created);
      expect(mockDb.note.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ author: { connect: { id: "user-1" } } }),
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ entity: "Note", operation: "CREATE" }),
      });
    });
  });

  describe("archive/restore", () => {
    it("archives and records an ARCHIVE audit entry", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.noteRepository.findById).mockResolvedValue(makeNote());
      mockDb.note.update.mockResolvedValue(undefined);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      await service.archive(context, "note-1");

      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ operation: "ARCHIVE", entity: "Note" }),
      });
    });

    it("throws NotFoundError on restore when missing even including archived rows", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.noteRepository.findByIdIncludingArchived).mockResolvedValue(null);
      const service = makeService(repos);

      await expect(service.restore(context, "missing")).rejects.toThrow(NotFoundError);
    });
  });

  describe("convertToKnowledge", () => {
    it("rejects a category not present in the configured allow-list", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.noteRepository.findById).mockResolvedValue(makeNote());
      vi.mocked(repos.governanceRuleRepository.findByKey).mockResolvedValue({
        id: "rule-1",
        key: "knowledge.allowedCategories",
        value: ["engineering"],
        description: null,
        updatedAt: new Date(),
      });
      const service = makeService(repos);

      await expect(
        service.convertToKnowledge(context, "note-1", { category: "finance" }),
      ).rejects.toThrow(ValidationError);
      expect(mockDb.knowledge.create).not.toHaveBeenCalled();
    });

    it("creates a Knowledge row from the note and records CREATE + conversion provenance", async () => {
      const repos = makeFakeRepositories();
      const note = makeNote({ title: "Note title", content: "Note body" });
      vi.mocked(repos.noteRepository.findById).mockResolvedValue(note);
      const created = { id: "knowledge-1", title: note.title, category: "engineering" };
      mockDb.knowledge.create.mockResolvedValue(created);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      const result = await service.convertToKnowledge(context, "note-1", {
        category: "engineering",
      });

      expect(result).toEqual(created);
      expect(mockDb.knowledge.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ title: "Note title", markdown: "Note body" }),
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entity: "Knowledge",
          operation: "CREATE",
          after: expect.objectContaining({ convertedFromNoteId: "note-1" }),
        }),
      });
    });
  });

  describe("convertToDocument", () => {
    it("throws ValidationError when neither the note nor the input supplies a projectId", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.noteRepository.findById).mockResolvedValue(makeNote({ projectId: null }));
      const service = makeService(repos);

      await expect(service.convertToDocument(context, "note-1", {})).rejects.toThrow(
        ValidationError,
      );
      expect(mockDb.document.create).not.toHaveBeenCalled();
    });

    it("throws ForbiddenError when the resolved project is not owned by the caller", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.noteRepository.findById).mockResolvedValue(
        makeNote({ projectId: "project-1" }),
      );
      vi.mocked(repos.projectRepository.findByIdIncludingArchived).mockResolvedValue(
        makeProject({ ownerId: "someone-else" }),
      );
      const service = makeService(repos);

      await expect(service.convertToDocument(context, "note-1", {})).rejects.toThrow(
        ForbiddenError,
      );
      expect(mockDb.document.create).not.toHaveBeenCalled();
    });

    it("creates a Document from the note using the note's own project when none is supplied", async () => {
      const repos = makeFakeRepositories();
      const note = makeNote({ projectId: "project-1", title: "Note title", content: "Note body" });
      vi.mocked(repos.noteRepository.findById).mockResolvedValue(note);
      const created = { id: "document-1", title: note.title, projectId: "project-1" };
      mockDb.document.create.mockResolvedValue(created);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      const result = await service.convertToDocument(context, "note-1", {});

      expect(result).toEqual(created);
      expect(mockDb.document.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: "Note title",
          markdown: "Note body",
          project: { connect: { id: "project-1" } },
        }),
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          entity: "Document",
          operation: "CREATE",
          after: expect.objectContaining({ convertedFromNoteId: "note-1" }),
        }),
      });
    });
  });
});
