import { Prisma } from "@/generated/prisma/client";
import type { Conversation } from "@/generated/prisma/client";
import { prisma, type Db } from "@/lib/db/client";
import { includingArchived, onlyArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 6 §22, Document 13 §3 (Amendment 2) — feature-owned repository
// (AI Workspace / Document 8 §14a). Soft-delete exclusion is enforced by
// `lib/db/soft-delete-extension.ts` (Phase 2 hardening review).
//
// Interface `AIChatService`/`RepositoryContextRetriever` depend on
// (Document 7 §8) — see `ProjectRepositoryLike` for why this exists
// alongside the generic shape. Added in Phase 5 when the first real
// consumers arrived; the concrete class already matched this shape. A
// type alias, not an `interface extends {}` (which ESLint's
// `no-empty-object-type` correctly flags as pointless when the shape
// doesn't add anything beyond the generic `Repository`).
export type ConversationRepositoryLike = Repository<
  Conversation,
  Prisma.ConversationCreateInput,
  Prisma.ConversationUpdateInput
>;

// Constructor-injected `client` (Phase 3, transaction boundaries) — see
// `UserRepository` for the pattern this follows. Not used by any Phase 3
// Service (AI Workspace is Phase 5) — refactored now for consistency so
// every repository follows one pattern.
export class ConversationRepository implements ConversationRepositoryLike {
  constructor(private readonly client: Db = prisma) {}

  async findById(id: string): Promise<Conversation | null> {
    return this.client.conversation.findFirst({ where: { id } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<Conversation>> {
    const [items, total] = await Promise.all([
      this.client.conversation.findMany({ ...toPagination(params) }),
      this.client.conversation.count(),
    ]);
    return { items, total };
  }

  async create(input: Prisma.ConversationCreateInput): Promise<Conversation> {
    return this.client.conversation.create({ data: input });
  }

  async update(id: string, input: Prisma.ConversationUpdateInput): Promise<Conversation> {
    return this.client.conversation.update({ where: { id }, data: input });
  }

  async archive(id: string): Promise<void> {
    await this.client.conversation.update({ where: { id }, data: { archivedAt: new Date() } });
  }

  /** Escape hatch — archived rows only. */
  async findArchived(params?: FindManyParams): Promise<PagedResult<Conversation>> {
    const where = onlyArchived();
    const [items, total] = await Promise.all([
      this.client.conversation.findMany({ where, ...toPagination(params) }),
      this.client.conversation.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — both archived and active rows. */
  async findIncludingArchived(params?: FindManyParams): Promise<PagedResult<Conversation>> {
    const where = includingArchived();
    const [items, total] = await Promise.all([
      this.client.conversation.findMany({ where, ...toPagination(params) }),
      this.client.conversation.count({ where }),
    ]);
    return { items, total };
  }

  /** Escape hatch — reverses `archive()`. Mutations bypass the extension. */
  async restore(id: string): Promise<void> {
    await this.client.conversation.update({ where: { id }, data: { archivedAt: null } });
  }
}
