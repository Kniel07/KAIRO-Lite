import type { Knowledge, Message, Project, Settings } from "@/generated/prisma/client";
import {
  ProjectRepository,
  type ProjectRepositoryLike,
} from "@/features/projects/repositories/ProjectRepository";
import {
  KnowledgeRepository,
  type KnowledgeRepositoryLike,
} from "@/features/knowledge/repositories/KnowledgeRepository";
import {
  ConversationRepository,
  type ConversationRepositoryLike,
} from "@/features/ai/repositories/ConversationRepository";
import {
  MessageRepository,
  type MessageRepositoryLike,
} from "@/features/ai/repositories/MessageRepository";
import {
  SettingsRepository,
  type SettingsRepositoryLike,
} from "@/features/settings/repositories/SettingsRepository";
import {
  SearchRepository,
  type RankedKnowledge,
  type SearchRepositoryLike,
} from "@/lib/db/repositories/SearchRepository";
import { ForbiddenError, NotFoundError } from "@/lib/utils/errors";

// Document 4 §6 — Context Retrieval priority order (Active Project, Active
// Document, Related Knowledge, Previous Conversation, Global Knowledge,
// User Preferences). Document 13 §4 (Amendment 3) — this reads via the
// Repository layer directly, never via Feature Services, keeping `ai/` and
// `features/` dependency siblings (Document 5 §20).

export interface AssembledContext {
  /** Priority 1 — Active Project. */
  project?: Project;
  /** Priority 2 — Active Document: Knowledge explicitly referenced by
   * `knowledgeIds`, included regardless of recency ranking (Doc 12 §4). */
  activeKnowledge: Knowledge[];
  /** Priority 3 — Related Knowledge, ranked via full-text search on the
   * prompt plus Doc 4 §11's Active-Project and Recency signals (Document
   * 13 §27, Amendment 25) — full-text ranked per Document 10 §8's search
   * index (Doc 12 §2). */
  relatedKnowledge: RankedKnowledge[];
  /** Priority 4 — Previous Conversation (last N messages, ascending). */
  conversationHistory: Message[];
  /** Priority 5 — Global Knowledge (project-less entries). */
  globalKnowledge: Knowledge[];
  /** Priority 6 — User Preferences. */
  userPreferences?: Settings;
}

export interface ContextRetrieverParams {
  /** Document 13 §4 — ownership scoping is applied here, independently of
   * a Feature Service's authorization logic. */
  userId: string;
  prompt: string;
  projectId?: string;
  conversationId?: string;
  knowledgeIds?: string[];
}

export interface ContextRetriever {
  retrieve(params: ContextRetrieverParams): Promise<AssembledContext>;
}

const RELATED_KNOWLEDGE_LIMIT = 5;
const CONVERSATION_HISTORY_LIMIT = 10;
const GLOBAL_KNOWLEDGE_LIMIT = 5;

// Document 4 §6 / Document 13 §4 (Amendment 3) — the concrete
// implementation `AIOrchestrator` is constructed with. Reads only; never
// writes (Document 4 §2 "AI layer is NOT responsible for... Writing
// directly to the database").
export class RepositoryContextRetriever implements ContextRetriever {
  constructor(
    private readonly projectRepository: ProjectRepositoryLike = new ProjectRepository(),
    private readonly knowledgeRepository: KnowledgeRepositoryLike = new KnowledgeRepository(),
    private readonly conversationRepository: ConversationRepositoryLike = new ConversationRepository(),
    private readonly messageRepository: MessageRepositoryLike = new MessageRepository(),
    private readonly settingsRepository: SettingsRepositoryLike = new SettingsRepository(),
    private readonly searchRepository: SearchRepositoryLike = new SearchRepository(),
  ) {}

  async retrieve(params: ContextRetrieverParams): Promise<AssembledContext> {
    const [
      project,
      activeKnowledge,
      relatedKnowledge,
      conversationHistory,
      globalKnowledge,
      userPreferences,
    ] = await Promise.all([
      this.loadProject(params),
      this.loadActiveKnowledge(params),
      this.loadRelatedKnowledge(params),
      this.loadConversationHistory(params),
      this.loadGlobalKnowledge(),
      this.loadUserPreferences(params),
    ]);

    // Document 13 §27 (Amendment 25, Phase 6 corrected scope) — Related
    // and Global Knowledge are retrieved independently (in parallel), so
    // a project-less entry that also matches the search query could
    // appear in both; dedupe here rather than send the same Knowledge
    // entry to the model twice (Doc 4 §6 "avoid prompt bloat").
    const globalIds = new Set(globalKnowledge.map((entry) => entry.id));
    const dedupedRelatedKnowledge = relatedKnowledge.filter((entry) => !globalIds.has(entry.id));

    return {
      project,
      activeKnowledge,
      relatedKnowledge: dedupedRelatedKnowledge,
      conversationHistory,
      globalKnowledge,
      userPreferences,
    };
  }

  /** Doc 11 §7 ownership pattern — resource must belong to the caller. */
  private async loadProject(params: ContextRetrieverParams): Promise<Project | undefined> {
    if (!params.projectId) return undefined;
    const project = await this.projectRepository.findById(params.projectId);
    if (!project) {
      throw new NotFoundError("PROJECT");
    }
    if (project.ownerId !== params.userId) {
      throw new ForbiddenError("You do not have access to this project.");
    }
    return project;
  }

  /**
   * Document 13 §26 (Phase 5.5, Amendment 24) — explicit `knowledgeIds` are
   * a caller-supplied point lookup by id, the same shape as
   * `KnowledgeService.get()` (Phase 3), which asserts ownership via
   * `assertProjectOwnership` before returning. This previously skipped
   * that check entirely; it now mirrors `KnowledgeService.assertAccess`'s
   * exact rule (`ai/` cannot import that Service-layer helper directly —
   * Document 5 §20 — so the same two-line rule is reimplemented here
   * against the Repository layer only).
   */
  private async loadActiveKnowledge(params: ContextRetrieverParams): Promise<Knowledge[]> {
    if (!params.knowledgeIds?.length) return [];
    const found = await Promise.all(
      params.knowledgeIds.map((id) => this.knowledgeRepository.findById(id)),
    );
    const resolved = found.filter((entry): entry is Knowledge => entry !== null);
    await Promise.all(resolved.map((entry) => this.assertKnowledgeOwnership(entry, params.userId)));
    return resolved;
  }

  /** Mirrors `KnowledgeService.assertAccess` (Phase 3) — Knowledge has no
   * owner field of its own (Document 10 §5.4); project-scoped entries
   * inherit the project's ownership, project-less ("global") entries are
   * accessible to any caller under single-user MVP (Document 11 §2). */
  private async assertKnowledgeOwnership(knowledge: Knowledge, userId: string): Promise<void> {
    if (!knowledge.projectId) return;
    const project = await this.projectRepository.findByIdIncludingArchived(knowledge.projectId);
    if (!project) {
      throw new NotFoundError("PROJECT");
    }
    if (project.ownerId !== userId) {
      throw new ForbiddenError("You do not have access to this knowledge entry.");
    }
  }

  /**
   * Document 4 §11 / Document 13 §27 (Amendment 25) — full-text ranked,
   * boosted by Active-Project and Recency (see
   * `SearchRepository.searchKnowledgeForContext`'s header comment for the
   * ranking formula), avoiding prompt bloat by capping the result count.
   * Uses the context-specific search method (full `Knowledge` rows in one
   * query) rather than `searchKnowledge` + a `findById` per result — the
   * N+1 pattern the previous version had.
   */
  private async loadRelatedKnowledge(params: ContextRetrieverParams): Promise<RankedKnowledge[]> {
    if (!params.prompt.trim()) return [];
    const results = await this.searchRepository.searchKnowledgeForContext({
      query: params.prompt,
      projectId: params.projectId,
      limit: RELATED_KNOWLEDGE_LIMIT,
    });
    const excludeIds = new Set(params.knowledgeIds ?? []);
    return results.filter((entry) => !excludeIds.has(entry.id));
  }

  /** Doc 11 §7 ownership pattern applies to the conversation too. */
  private async loadConversationHistory(params: ContextRetrieverParams): Promise<Message[]> {
    if (!params.conversationId) return [];
    const conversation = await this.conversationRepository.findById(params.conversationId);
    if (!conversation) {
      return [];
    }
    if (conversation.userId !== params.userId) {
      throw new ForbiddenError("You do not have access to this conversation.");
    }
    const { items } = await this.messageRepository.findByConversation(params.conversationId, {
      pageSize: CONVERSATION_HISTORY_LIMIT,
    });
    return items;
  }

  private async loadGlobalKnowledge(): Promise<Knowledge[]> {
    const { items } = await this.knowledgeRepository.findGlobal({
      pageSize: GLOBAL_KNOWLEDGE_LIMIT,
    });
    return items;
  }

  private async loadUserPreferences(params: ContextRetrieverParams): Promise<Settings | undefined> {
    const settings = await this.settingsRepository.findByUserId(params.userId);
    return settings ?? undefined;
  }
}
