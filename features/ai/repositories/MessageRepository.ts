import { Prisma } from "@/generated/prisma/client";
import type { Message } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult } from "@/features/shared/types/Repository";

// Document 10 §5.9 / Document 10 §4 — Message is immutable and append-only
// (no `updatedAt`/`archivedAt`), so it deliberately does NOT implement the
// generic `Repository<T, C, U>` shape (Document 10 §4 lists this as an
// explicitly-justified exception, not an oversight) — there is no
// update/archive operation to expose.
export class MessageRepository {
  async findById(id: string): Promise<Message | null> {
    return prisma.message.findUnique({ where: { id } });
  }

  async findByConversation(
    conversationId: string,
    params?: FindManyParams,
  ): Promise<PagedResult<Message>> {
    const where = { conversationId };
    const [items, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: "asc" },
        ...toPagination(params),
      }),
      prisma.message.count({ where }),
    ]);
    return { items, total };
  }

  async create(input: Prisma.MessageCreateInput): Promise<Message> {
    return prisma.message.create({ data: input });
  }
}
