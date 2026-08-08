import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation, Message, Project } from "@/types/database";
import type { ConversationRepositoryLike } from "@/features/ai/repositories/ConversationRepository";
import type { MessageRepositoryLike } from "@/features/ai/repositories/MessageRepository";
import type { ProjectRepositoryLike } from "@/features/projects/repositories/ProjectRepository";
import type { AuditLogRepositoryLike } from "@/lib/db/repositories/AuditLogRepository";
import { ForbiddenError, NotFoundError } from "@/lib/utils/errors";
import { AIChatService } from "@/features/ai/services/AIChatService";
import type { AIOrchestratorResponse } from "@/ai/orchestrator/AIOrchestrator";

// Document 13 §20/§24 — same test-strategy split documented in the other
// Service test files: `withTransaction` is mocked to run its callback
// synchronously against a fake Prisma-shaped `mockDb`, so the repositories
// constructed *inside* the transaction (real classes, not fakes) exercise
// real query-shape code against that fake client.

const mockDb = {
  conversation: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  message: {
    create: vi.fn(),
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

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
  return {
    id: "conversation-1",
    projectId: null,
    userId: "user-1",
    title: null,
    model: "gpt-4.1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    archivedAt: null,
    ...overrides,
  } as Conversation;
}

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "message-1",
    conversationId: "conversation-1",
    role: "USER",
    content: "hello",
    mode: "THINK",
    tokenCount: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  } as Message;
}

function makeResponse(overrides: Partial<AIOrchestratorResponse> = {}): AIOrchestratorResponse {
  return {
    content: { ideas: [], openQuestions: [] },
    citations: [],
    ...overrides,
  } as AIOrchestratorResponse;
}

function makeFakeRepositories() {
  const conversationRepository: ConversationRepositoryLike = {
    findById: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
  };
  const messageRepository: MessageRepositoryLike = {
    findById: vi.fn(),
    findByConversation: vi.fn(),
    create: vi.fn(),
  };
  const projectRepository: ProjectRepositoryLike = {
    findById: vi.fn(),
    findBySlug: vi.fn(),
    findBySlugIncludingArchived: vi.fn(),
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
  return { conversationRepository, messageRepository, projectRepository, auditLogRepository };
}

const context = { userId: "user-1" };

function makeService(repos: ReturnType<typeof makeFakeRepositories>) {
  return new AIChatService(
    repos.conversationRepository,
    repos.messageRepository,
    repos.projectRepository,
    repos.auditLogRepository,
  );
}

describe("AIChatService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.conversation.findFirst.mockReset();
    mockDb.conversation.create.mockReset();
    mockDb.message.create.mockReset();
    mockDb.auditLog.create.mockReset();
  });

  describe("ownership checks (pre-transaction)", () => {
    it("throws NotFoundError when projectId does not resolve", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.projectRepository.findById).mockResolvedValue(null);
      const service = makeService(repos);

      await expect(
        service.recordTurn(context, {
          mode: "THINK",
          prompt: "hi",
          projectId: "missing-project",
          response: makeResponse(),
        }),
      ).rejects.toThrow(NotFoundError);
      expect(mockDb.conversation.create).not.toHaveBeenCalled();
    });

    it("throws ForbiddenError when the project belongs to a different user", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.projectRepository.findById).mockResolvedValue(
        makeProject({ ownerId: "someone-else" }),
      );
      const service = makeService(repos);

      await expect(
        service.recordTurn(context, {
          mode: "THINK",
          prompt: "hi",
          projectId: "project-1",
          response: makeResponse(),
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws NotFoundError when conversationId does not resolve", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.conversationRepository.findById).mockResolvedValue(null);
      const service = makeService(repos);

      await expect(
        service.recordTurn(context, {
          mode: "THINK",
          prompt: "hi",
          conversationId: "missing-conversation",
          response: makeResponse(),
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ForbiddenError when the conversation belongs to a different user", async () => {
      const repos = makeFakeRepositories();
      vi.mocked(repos.conversationRepository.findById).mockResolvedValue(
        makeConversation({ userId: "someone-else" }),
      );
      const service = makeService(repos);

      await expect(
        service.recordTurn(context, {
          mode: "THINK",
          prompt: "hi",
          conversationId: "conversation-1",
          response: makeResponse(),
        }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("recordTurn", () => {
    it("creates a new conversation, both messages, and audits the assistant message when no conversationId is given", async () => {
      const repos = makeFakeRepositories();
      const created = makeConversation();
      mockDb.conversation.create.mockResolvedValue(created);
      mockDb.conversation.findFirst.mockResolvedValue(created);
      const userMessage = makeMessage({ id: "message-user", role: "USER" });
      const assistantMessage = makeMessage({
        id: "message-assistant",
        role: "ASSISTANT",
        content: "{}",
      });
      mockDb.message.create
        .mockResolvedValueOnce(userMessage)
        .mockResolvedValueOnce(assistantMessage);
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      const result = await service.recordTurn(context, {
        mode: "THINK",
        prompt: "hi",
        response: makeResponse(),
      });

      expect(result.conversationId).toBe(created.id);
      expect(mockDb.conversation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ user: { connect: { id: "user-1" } } }),
      });
      // One audit entry for the new Conversation, one for the assistant Message.
      expect(mockDb.auditLog.create).toHaveBeenCalledTimes(2);
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ entity: "Conversation", operation: "CREATE" }),
      });
      expect(mockDb.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ entity: "Message", operation: "CREATE", actorType: "AI" }),
      });
    });

    it("reuses an existing conversation instead of creating a new one", async () => {
      const repos = makeFakeRepositories();
      const existing = makeConversation();
      vi.mocked(repos.conversationRepository.findById).mockResolvedValue(existing);
      mockDb.conversation.findFirst.mockResolvedValue(existing);
      mockDb.message.create
        .mockResolvedValueOnce(makeMessage({ role: "USER" }))
        .mockResolvedValueOnce(makeMessage({ role: "ASSISTANT" }));
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      const result = await service.recordTurn(context, {
        mode: "VALIDATE",
        prompt: "review this",
        conversationId: existing.id,
        response: makeResponse(),
      });

      expect(result.conversationId).toBe(existing.id);
      expect(mockDb.conversation.create).not.toHaveBeenCalled();
      // Only the assistant Message is audited when reusing a conversation.
      expect(mockDb.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it("persists the user prompt and the JSON-stringified assistant response as separate messages", async () => {
      const repos = makeFakeRepositories();
      const created = makeConversation();
      mockDb.conversation.create.mockResolvedValue(created);
      mockDb.message.create
        .mockResolvedValueOnce(makeMessage({ role: "USER" }))
        .mockResolvedValueOnce(makeMessage({ role: "ASSISTANT" }));
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      await service.recordTurn(context, {
        mode: "THINK",
        prompt: "brainstorm this",
        response: makeResponse({
          content: {
            ideas: [{ title: "A", description: "d", assumptions: [], tradeoffs: [] }],
            openQuestions: [],
          },
        }),
      });

      expect(mockDb.message.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({ role: "USER", content: "brainstorm this", mode: "THINK" }),
      });
      expect(mockDb.message.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          role: "ASSISTANT",
          mode: "THINK",
          content: JSON.stringify({
            ideas: [{ title: "A", description: "d", assumptions: [], tradeoffs: [] }],
            openQuestions: [],
          }),
        }),
      });
    });

    it("connects cited Knowledge entries on the assistant message when citations are present", async () => {
      const repos = makeFakeRepositories();
      mockDb.conversation.create.mockResolvedValue(makeConversation());
      mockDb.message.create
        .mockResolvedValueOnce(makeMessage({ role: "USER" }))
        .mockResolvedValueOnce(makeMessage({ role: "ASSISTANT" }));
      mockDb.auditLog.create.mockResolvedValue({});
      const service = makeService(repos);

      await service.recordTurn(context, {
        mode: "THINK",
        prompt: "hi",
        response: makeResponse({ citations: ["knowledge-1", "knowledge-2"] }),
      });

      expect(mockDb.message.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          citedKnowledge: { connect: [{ id: "knowledge-1" }, { id: "knowledge-2" }] },
        }),
      });
    });
  });
});
