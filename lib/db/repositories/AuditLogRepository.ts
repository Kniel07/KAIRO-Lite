import type { ActorType, AuditLog, AuditOperation, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult } from "@/features/shared/types/Repository";

// Document 3 §4, §9 / Document 10 §5.10 — AuditLog is immutable, so this
// deliberately does NOT implement the generic `Repository<T, C, U>` shape
// (no update/archive — see Document 10 §4's explicit exception list).
//
// This is the "audit infrastructure" deliverable for Phase 2 (Document 9).
// It only knows how to persist and read audit rows — deciding *when* an
// operation is audit-worthy is a Service-layer decision (Document 7 §7),
// made in Phase 3, not here.
export interface RecordAuditEntryInput {
  entity: string;
  entityId: string;
  operation: AuditOperation;
  actorId?: string | null;
  actorType?: ActorType;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

export class AuditLogRepository {
  async record(input: RecordAuditEntryInput): Promise<AuditLog> {
    return prisma.auditLog.create({
      data: {
        entity: input.entity,
        entityId: input.entityId,
        operation: input.operation,
        actorType: input.actorType ?? "USER",
        ...(input.actorId ? { actor: { connect: { id: input.actorId } } } : {}),
        ...(input.before !== undefined ? { before: input.before } : {}),
        ...(input.after !== undefined ? { after: input.after } : {}),
      },
    });
  }

  async findByEntity(
    entity: string,
    entityId: string,
    params?: FindManyParams,
  ): Promise<PagedResult<AuditLog>> {
    const where = { entity, entityId };
    const [items, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        ...toPagination(params),
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
