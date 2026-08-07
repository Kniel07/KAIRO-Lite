import { Prisma } from "@/generated/prisma/client";
import type { Conversation } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { notArchived, toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult, Repository } from "@/features/shared/types/Repository";

// Document 6 §22, Document 13 §3 (Amendment 2) — feature-owned repository
// (AI Workspace / Document 8 §14a).
export class ConversationRepository implements Repository<
  Conversation,
  Prisma.ConversationCreateInput,
  Prisma.ConversationUpdateInput
> {
  async findById(id: string): Promise<Conversation | null> {
    return prisma.conversation.findFirst({ where: { id, ...notArchived() } });
  }

  async findMany(params?: FindManyParams): Promise<PagedResult<Conversation>> {
    const where = notArchived();
    const [items, total] = await Promise.all([
      prisma.conversation.findMany({ where, ...toPagination(params) }),
      prisma.conversation.count({ where }),
    ]);
    return { items, total };
  }

  async create(input: Prisma.ConversationCreateInput): Promise<Conversation> {
    return prisma.conversation.create({ data: input });
  }

  async update(id: string, input: Prisma.ConversationUpdateInput): Promise<Conversation> {
    return prisma.conversation.update({ where: { id }, data: input });
  }

  async archive(id: string): Promise<void> {
    await prisma.conversation.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}
