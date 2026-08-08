import type { Conversation, Message } from "@/types/database";
import type { AIMode } from "@/types/ai";
import type { AIOrchestratorResponse } from "@/ai/orchestrator/AIOrchestrator";
import { withTransaction } from "@/lib/db/transaction";
import {
  ConversationRepository,
  type ConversationRepositoryLike,
} from "@/features/ai/repositories/ConversationRepository";
import {
  MessageRepository,
  type MessageRepositoryLike,
} from "@/features/ai/repositories/MessageRepository";
import {
  ProjectRepository,
  type ProjectRepositoryLike,
} from "@/features/projects/repositories/ProjectRepository";
import {
  AuditLogRepository,
  type AuditLogRepositoryLike,
} from "@/lib/db/repositories/AuditLogRepository";
import { ForbiddenError, NotFoundError } from "@/lib/utils/errors";
import { aiConfig } from "@/config/ai";
import type { ServiceContext } from "@/features/shared/types/Service";

export interface RecordTurnInput {
  mode: AIMode;
  prompt: string;
  projectId?: string;
  conversationId?: string;
  response: AIOrchestratorResponse;
}

export interface RecordedTurn {
  conversationId: string;
  userMessage: Message;
  assistantMessage: Message;
}

// Document 4 §2 "AI layer is NOT responsible for... Writing directly to
// the database" / Document 8 §2's AI-specific flow diagram (Route Handler
// → Validation → AI Orchestrator → Provider → Validation → Response, no
// Service node): the Orchestrator returns a validated structured
// response but never persists it. This is an ordinary Service — normal
// Component → Route Handler → Service → Repository → Prisma chain
// (Document 7 §8) — that the AI chat Route Handler calls *after*
// `AIOrchestrator.execute()` succeeds, to persist the resulting
// Conversation/Message rows. "AI-assisted modifications" generate audit
// entries (Document 8 §21).
//
// Ownership is asserted independently here (Document 11 §7's pattern),
// even though `RepositoryContextRetriever` already checked it earlier in
// the same request — a Service should not depend on a specific caller
// having already done its authorization for it.
export class AIChatService {
  constructor(
    private readonly conversationRepository: ConversationRepositoryLike = new ConversationRepository(),
    private readonly messageRepository: MessageRepositoryLike = new MessageRepository(),
    private readonly projectRepository: ProjectRepositoryLike = new ProjectRepository(),
    private readonly auditLogRepository: AuditLogRepositoryLike = new AuditLogRepository(),
  ) {}

  async recordTurn(context: ServiceContext, input: RecordTurnInput): Promise<RecordedTurn> {
    if (input.projectId) {
      const project = await this.projectRepository.findById(input.projectId);
      if (!project) {
        throw new NotFoundError("PROJECT");
      }
      if (project.ownerId !== context.userId) {
        throw new ForbiddenError("You do not have access to this project.");
      }
    }

    if (input.conversationId) {
      const existing = await this.conversationRepository.findById(input.conversationId);
      if (!existing) {
        throw new NotFoundError("CONVERSATION");
      }
      if (existing.userId !== context.userId) {
        throw new ForbiddenError("You do not have access to this conversation.");
      }
    }

    return withTransaction(async (tx) => {
      const conversationRepository = new ConversationRepository(tx);
      const messageRepository = new MessageRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      const conversation = input.conversationId
        ? // Already validated above; `findById` re-read inside the
          // transaction for a consistent snapshot.
          ((await conversationRepository.findById(input.conversationId)) as Conversation)
        : await this.createConversation(conversationRepository, auditLogRepository, context, input);

      const userMessage = await messageRepository.create({
        conversation: { connect: { id: conversation.id } },
        role: "USER",
        content: input.prompt,
        mode: input.mode,
      });

      const assistantMessage = await messageRepository.create({
        conversation: { connect: { id: conversation.id } },
        role: "ASSISTANT",
        content: JSON.stringify(input.response.content),
        mode: input.mode,
        ...(input.response.usage
          ? {
              tokenCount: input.response.usage.promptTokens + input.response.usage.completionTokens,
            }
          : {}),
        ...(input.response.citations.length
          ? { citedKnowledge: { connect: input.response.citations.map((id) => ({ id })) } }
          : {}),
      });

      await auditLogRepository.record({
        entity: "Message",
        entityId: assistantMessage.id,
        operation: "CREATE",
        actorId: context.userId,
        actorType: "AI",
        after: { mode: input.mode, conversationId: conversation.id },
      });

      return { conversationId: conversation.id, userMessage, assistantMessage };
    });
  }

  private async createConversation(
    conversationRepository: ConversationRepositoryLike,
    auditLogRepository: AuditLogRepositoryLike,
    context: ServiceContext,
    input: RecordTurnInput,
  ): Promise<Conversation> {
    const conversation = await conversationRepository.create({
      user: { connect: { id: context.userId } },
      model: aiConfig.defaultModel,
      ...(input.projectId ? { project: { connect: { id: input.projectId } } } : {}),
    });

    await auditLogRepository.record({
      entity: "Conversation",
      entityId: conversation.id,
      operation: "CREATE",
      actorId: context.userId,
    });

    return conversation;
  }
}
