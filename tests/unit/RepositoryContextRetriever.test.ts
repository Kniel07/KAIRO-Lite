import { describe, expect, it, vi } from "vitest";
import type { Knowledge, Message, Project, Settings } from "@/types/database";
import type { ProjectRepositoryLike } from "@/features/projects/repositories/ProjectRepository";
import type { KnowledgeRepositoryLike } from "@/features/knowledge/repositories/KnowledgeRepository";
import type { ConversationRepositoryLike } from "@/features/ai/repositories/ConversationRepository";
import type { MessageRepositoryLike } from "@/features/ai/repositories/MessageRepository";
import type { SettingsRepositoryLike } from "@/features/settings/repositories/SettingsRepository";
import type { RankedKnowledge, SearchRepositoryLike } from "@/lib/db/repositories/SearchRepository";
import { ForbiddenError, NotFoundError } from "@/lib/utils/errors";
import { RepositoryContextRetriever } from "@/ai/context/ContextRetriever";

// Document 4 §6 — Context Retrieval priority order under test: Active
// Project, Active Document (explicit knowledgeIds), Related Knowledge
// (full-text ranked), Previous Conversation, Global Knowledge, User
// Preferences. Document 13 §4 (Amendment 3) — ownership scoping is
// applied here independently, so those checks are covered too.

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "project-1",
    name: "Project One",
    slug: "project-one",
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

function makeKnowledge(overrides: Partial<Knowledge> = {}): Knowledge {
  return {
    id: "knowledge-1",
    title: "K",
    summary: "s",
    markdown: "m",
    projectId: null,
    category: "general",
    confidence: 0.5,
    status: "DRAFT",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    archivedAt: null,
    ...overrides,
  } as Knowledge;
}

function makeRanked(overrides: Partial<RankedKnowledge> = {}): RankedKnowledge {
  return { ...makeKnowledge(), rank: 0.5, ...overrides };
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "message-1",
    conversationId: "conversation-1",
    role: "USER",
    content: "hi",
    mode: null,
    tokenCount: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as Message;
}

function makeSettings(overrides: Partial<Settings> = {}): Settings {
  return {
    id: "settings-1",
    userId: "user-1",
    theme: "SYSTEM",
    defaultModel: "gpt-4.1",
    aiTemperature: 0.7,
    language: "en",
    timezone: "UTC",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as Settings;
}

function makeFakeRepositories() {
  const projectRepository: ProjectRepositoryLike = {
    findById: vi.fn().mockResolvedValue(null),
    findBySlug: vi.fn(),
    findBySlugIncludingArchived: vi.fn(),
    findByOwner: vi.fn(),
    findByIdIncludingArchived: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
  };
  const knowledgeRepository: KnowledgeRepositoryLike = {
    findById: vi.fn().mockResolvedValue(null),
    findByProject: vi.fn(),
    findByIdIncludingArchived: vi.fn(),
    findGlobal: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
  };
  const conversationRepository: ConversationRepositoryLike = {
    findById: vi.fn().mockResolvedValue(null),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
  };
  const messageRepository: MessageRepositoryLike = {
    findById: vi.fn(),
    findByConversation: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    create: vi.fn(),
  };
  const settingsRepository: SettingsRepositoryLike = {
    findByUserId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };
  const searchRepository: SearchRepositoryLike = {
    searchKnowledge: vi.fn().mockResolvedValue({ items: [], total: 0 }),
    searchKnowledgeForContext: vi.fn().mockResolvedValue([]),
  };
  return {
    projectRepository,
    knowledgeRepository,
    conversationRepository,
    messageRepository,
    settingsRepository,
    searchRepository,
  };
}

function makeRetriever(repos: ReturnType<typeof makeFakeRepositories>) {
  return new RepositoryContextRetriever(
    repos.projectRepository,
    repos.knowledgeRepository,
    repos.conversationRepository,
    repos.messageRepository,
    repos.settingsRepository,
    repos.searchRepository,
  );
}

describe("RepositoryContextRetriever", () => {
  it("returns an empty-ish context when no optional params are given", async () => {
    const repos = makeFakeRepositories();
    const retriever = makeRetriever(repos);

    const context = await retriever.retrieve({ userId: "user-1", prompt: "" });

    expect(context).toEqual({
      project: undefined,
      activeKnowledge: [],
      relatedKnowledge: [],
      conversationHistory: [],
      globalKnowledge: [],
      userPreferences: undefined,
    });
  });

  describe("Active Project (priority 1)", () => {
    it("loads the project when owned by the caller", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.projectRepository.findById).mockResolvedValue(makeProject());
      const retriever = makeRetriever(repos);

      const context = await retriever.retrieve({
        userId: "user-1",
        prompt: "",
        projectId: "project-1",
      });

      expect(context.project?.id).toBe("project-1");
    });

    it("throws NotFoundError when the project does not exist", async () => {
      const repos = makeFakeRepositories();
      const retriever = makeRetriever(repos);

      await expect(
        retriever.retrieve({ userId: "user-1", prompt: "", projectId: "missing" }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when the project belongs to a different user", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.projectRepository.findById).mockResolvedValue(
        makeProject({ ownerId: "someone-else" }),
      );
      const retriever = makeRetriever(repos);

      await expect(
        retriever.retrieve({ userId: "user-1", prompt: "", projectId: "project-1" }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("Active Document (priority 2 — explicit knowledgeIds)", () => {
    it("loads every explicitly-referenced Knowledge entry, dropping any that don't resolve", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.knowledgeRepository.findById).mockImplementation(async (id: string) =>
        id === "k-1" ? makeKnowledge({ id: "k-1" }) : null,
      );
      const retriever = makeRetriever(repos);

      const context = await retriever.retrieve({
        userId: "user-1",
        prompt: "",
        knowledgeIds: ["k-1", "k-missing"],
      });

      expect(context.activeKnowledge.map((k) => k.id)).toEqual(["k-1"]);
    });

    it("allows project-less (global) Knowledge with no ownership check", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.knowledgeRepository.findById).mockResolvedValue(
        makeKnowledge({ id: "k-global", projectId: null }),
      );
      const retriever = makeRetriever(repos);

      const context = await retriever.retrieve({
        userId: "user-1",
        prompt: "",
        knowledgeIds: ["k-global"],
      });

      expect(context.activeKnowledge.map((k) => k.id)).toEqual(["k-global"]);
      expect(repos.projectRepository.findByIdIncludingArchived).not.toHaveBeenCalled();
    });

    it("includes project-scoped Knowledge when the caller owns the project", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.knowledgeRepository.findById).mockResolvedValue(
        makeKnowledge({ id: "k-owned", projectId: "project-1" }),
      );
      vi.mocked(repos.projectRepository.findByIdIncludingArchived).mockResolvedValue(makeProject());
      const retriever = makeRetriever(repos);

      const context = await retriever.retrieve({
        userId: "user-1",
        prompt: "",
        knowledgeIds: ["k-owned"],
      });

      expect(context.activeKnowledge.map((k) => k.id)).toEqual(["k-owned"]);
    });

    it("throws ForbiddenError for project-scoped Knowledge the caller does not own (Phase 5.5, Amendment 24)", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.knowledgeRepository.findById).mockResolvedValue(
        makeKnowledge({ id: "k-not-mine", projectId: "project-1" }),
      );
      vi.mocked(repos.projectRepository.findByIdIncludingArchived).mockResolvedValue(
        makeProject({ ownerId: "someone-else" }),
      );
      const retriever = makeRetriever(repos);

      await expect(
        retriever.retrieve({ userId: "user-1", prompt: "", knowledgeIds: ["k-not-mine"] }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws NotFoundError for project-scoped Knowledge whose project no longer exists", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.knowledgeRepository.findById).mockResolvedValue(
        makeKnowledge({ id: "k-orphaned", projectId: "deleted-project" }),
      );
      vi.mocked(repos.projectRepository.findByIdIncludingArchived).mockResolvedValue(null);
      const retriever = makeRetriever(repos);

      await expect(
        retriever.retrieve({ userId: "user-1", prompt: "", knowledgeIds: ["k-orphaned"] }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("Related Knowledge (priority 3 — full-text + Active-Project/Recency ranked)", () => {
    it("searches by the prompt (and projectId, for the ranking boost) and excludes ids already covered by activeKnowledge", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.projectRepository.findById).mockResolvedValue(makeProject());
      vi.mocked(repos.knowledgeRepository.findById).mockImplementation(async (id: string) =>
        makeKnowledge({ id }),
      );
      vi.mocked(repos.searchRepository.searchKnowledgeForContext).mockResolvedValue([
        makeRanked({ id: "k-1", rank: 0.9 }),
        makeRanked({ id: "k-2", rank: 0.5 }),
      ]);
      const retriever = makeRetriever(repos);

      const context = await retriever.retrieve({
        userId: "user-1",
        prompt: "search term",
        projectId: "project-1",
        knowledgeIds: ["k-1"],
      });

      expect(repos.searchRepository.searchKnowledgeForContext).toHaveBeenCalledWith(
        expect.objectContaining({ query: "search term", projectId: "project-1" }),
      );
      expect(context.relatedKnowledge.map((k) => k.id)).toEqual(["k-2"]);
    });

    it("skips the search entirely when the prompt is blank", async () => {
      const repos = makeFakeRepositories();
      const retriever = makeRetriever(repos);

      await retriever.retrieve({ userId: "user-1", prompt: "   " });

      expect(repos.searchRepository.searchKnowledgeForContext).not.toHaveBeenCalled();
    });

    it("carries the rank score through to the assembled context (Document 13 §28, Amendment 25)", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.searchRepository.searchKnowledgeForContext).mockResolvedValue([
        makeRanked({ id: "k-1", rank: 0.73 }),
      ]);
      const retriever = makeRetriever(repos);

      const context = await retriever.retrieve({ userId: "user-1", prompt: "search term" });

      expect(context.relatedKnowledge[0]?.rank).toBe(0.73);
    });

    it("dedupes against Global Knowledge — a project-less entry matched by search isn't sent to the model twice", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.searchRepository.searchKnowledgeForContext).mockResolvedValue([
        makeRanked({ id: "k-shared", rank: 0.8 }),
        makeRanked({ id: "k-only-related", rank: 0.4 }),
      ]);
      vi.mocked(repos.knowledgeRepository.findGlobal).mockResolvedValue({
        items: [makeKnowledge({ id: "k-shared" })],
        total: 1,
      });
      const retriever = makeRetriever(repos);

      const context = await retriever.retrieve({ userId: "user-1", prompt: "search term" });

      expect(context.relatedKnowledge.map((k) => k.id)).toEqual(["k-only-related"]);
      expect(context.globalKnowledge.map((k) => k.id)).toEqual(["k-shared"]);
    });
  });

  describe("Previous Conversation (priority 4)", () => {
    it("loads the message history when the conversation belongs to the caller", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.conversationRepository.findById).mockResolvedValue({
        id: "conversation-1",
        userId: "user-1",
        projectId: null,
        title: null,
        model: "gpt-4.1",
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
      });
      vi.mocked(repos.messageRepository.findByConversation).mockResolvedValue({
        items: [makeMessage()],
        total: 1,
      });
      const retriever = makeRetriever(repos);

      const context = await retriever.retrieve({
        userId: "user-1",
        prompt: "",
        conversationId: "conversation-1",
      });

      expect(context.conversationHistory).toHaveLength(1);
    });

    it("throws ForbiddenError when the conversation belongs to a different user", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.conversationRepository.findById).mockResolvedValue({
        id: "conversation-1",
        userId: "someone-else",
        projectId: null,
        title: null,
        model: "gpt-4.1",
        createdAt: new Date(),
        updatedAt: new Date(),
        archivedAt: null,
      });
      const retriever = makeRetriever(repos);

      await expect(
        retriever.retrieve({ userId: "user-1", prompt: "", conversationId: "conversation-1" }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("silently returns no history when the conversationId doesn't resolve (rather than failing the whole request)", async () => {
      const repos = makeFakeRepositories();
      const retriever = makeRetriever(repos);

      const context = await retriever.retrieve({
        userId: "user-1",
        prompt: "",
        conversationId: "missing",
      });

      expect(context.conversationHistory).toEqual([]);
    });
  });

  describe("Global Knowledge (priority 5)", () => {
    it("loads project-less Knowledge entries", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.knowledgeRepository.findGlobal).mockResolvedValue({
        items: [makeKnowledge({ id: "global-1", projectId: null })],
        total: 1,
      });
      const retriever = makeRetriever(repos);

      const context = await retriever.retrieve({ userId: "user-1", prompt: "" });

      expect(context.globalKnowledge.map((k) => k.id)).toEqual(["global-1"]);
    });
  });

  describe("User Preferences (priority 6)", () => {
    it("loads the caller's Settings row", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.settingsRepository.findByUserId).mockResolvedValue(makeSettings());
      const retriever = makeRetriever(repos);

      const context = await retriever.retrieve({ userId: "user-1", prompt: "" });

      expect(context.userPreferences?.language).toBe("en");
    });
  });
});
