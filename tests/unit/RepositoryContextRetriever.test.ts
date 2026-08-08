import { describe, expect, it, vi } from "vitest";
import type { Knowledge, Message, Project, Settings } from "@/types/database";
import type { ProjectRepositoryLike } from "@/features/projects/repositories/ProjectRepository";
import type { KnowledgeRepositoryLike } from "@/features/knowledge/repositories/KnowledgeRepository";
import type { ConversationRepositoryLike } from "@/features/ai/repositories/ConversationRepository";
import type { MessageRepositoryLike } from "@/features/ai/repositories/MessageRepository";
import type { SettingsRepositoryLike } from "@/features/settings/repositories/SettingsRepository";
import type { SearchRepositoryLike } from "@/lib/db/repositories/SearchRepository";
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
  });

  describe("Related Knowledge (priority 3 — full-text ranked)", () => {
    it("searches by the prompt and excludes ids already covered by activeKnowledge", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.knowledgeRepository.findById).mockImplementation(async (id: string) =>
        makeKnowledge({ id }),
      );
      vi.mocked(repos.searchRepository.searchKnowledge).mockResolvedValue({
        items: [
          { id: "k-1", title: "K1", summary: null, rank: 0.9 },
          { id: "k-2", title: "K2", summary: null, rank: 0.5 },
        ],
        total: 2,
      });
      const retriever = makeRetriever(repos);

      const context = await retriever.retrieve({
        userId: "user-1",
        prompt: "search term",
        knowledgeIds: ["k-1"],
      });

      expect(repos.searchRepository.searchKnowledge).toHaveBeenCalledWith(
        expect.objectContaining({ query: "search term" }),
      );
      expect(context.relatedKnowledge.map((k) => k.id)).toEqual(["k-2"]);
    });

    it("skips the search entirely when the prompt is blank", async () => {
      const repos = makeFakeRepositories();
      const retriever = makeRetriever(repos);

      await retriever.retrieve({ userId: "user-1", prompt: "   " });

      expect(repos.searchRepository.searchKnowledge).not.toHaveBeenCalled();
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
