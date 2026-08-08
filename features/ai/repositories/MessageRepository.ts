import { Prisma } from "@/generated/prisma/client";
import type { Message } from "@/generated/prisma/client";
import { prisma, type Db } from "@/lib/db/client";
import { toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult } from "@/features/shared/types/Repository";

// Document 10 §5.9 / Document 10 §4 — Message is immutable and append-only
// (no `updatedAt`/`archivedAt`), so it deliberately does NOT implement the
// generic `Repository<T, C, U>` shape (Document 10 §4 lists this as an
// explicitly-justified exception, not an oversight) — there is no
// update/archive operation to expose.
//
// Interface `AIChatService`/`RepositoryContextRetriever` depend on
// (Document 7 §8) — see `ProjectRepositoryLike` for why this exists
// alongside the concrete class. Added in Phase 5 when the first real
// consumers arrived.
export interface MessageRepositoryLike {
  findById(id: string): Promise<Message | null>;
  findByConversation(
    conversationId: string,
    params?: FindManyParams,
  ): Promise<PagedResult<Message>>;
  create(input: Prisma.MessageCreateInput): Promise<Message>;
}

// Constructor-injected `client` (Phase 3, transaction boundaries) — see
// `UserRepository` for the pattern this follows. Not used by any Phase 3
// Service (AI Workspace is Phase 5) — refactored now for consistency.
export class MessageRepository implements MessageRepositoryLike {
  constructor(private readonly client: Db = prisma) {}

  async findById(id: string): Promise<Message | null> {
    return this.client.message.findUnique({ where: { id } });
  }

  async findByConversation(
    conversationId: string,
    params?: FindManyParams,
  ): Promise<PagedResult<Message>> {
    const where = { conversationId };
    const [items, total] = await Promise.all([
      this.client.message.findMany({
        where,
        orderBy: { createdAt: "asc" },
        ...toPagination(params),
      }),
      this.client.message.count({ where }),
    ]);
    return { items, total };
  }

  async create(input: Prisma.MessageCreateInput): Promise<Message> {
    return this.client.message.create({ data: input });
  }
}
