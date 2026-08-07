import type { ActorType, AuditLog, AuditOperation, Prisma } from "@/generated/prisma/client";
import { prisma, type Db } from "@/lib/db/client";
import { toPagination } from "@/lib/db/soft-delete";
import type { FindManyParams, PagedResult } from "@/features/shared/types/Repository";

// Document 3 §4, §9 / Document 10 §5.10 — AuditLog is immutable, so this
// deliberately does NOT implement the generic `Repository<T, C, U>` shape
// (no update/archive — see Document 10 §4's explicit exception list).
//
// This was the "audit infrastructure" deliverable for Phase 2 (Document 9).
// It only knows how to persist and read audit rows — deciding *when* an
// operation is audit-worthy is a Service-layer decision (Document 7 §7).
// Phase 3 is where every Service actually calls `record()`, always inside
// the same `withTransaction()` block as the entity write it's auditing
// (Phase 3 transaction-boundary requirement) — never as a separate write.
export interface RecordAuditEntryInput {
  entity: string;
  entityId: string;
  operation: AuditOperation;
  actorId?: string | null;
  actorType?: ActorType;
  before?: Prisma.InputJsonValue;
  after?: Prisma.InputJsonValue;
}

// Interface Services depend on (Document 7 §8 "use Repository interfaces
// only") — lets unit tests substitute a fake without touching Prisma.
export interface AuditLogRepositoryLike {
  record(input: RecordAuditEntryInput): Promise<AuditLog>;
  findByEntity(
    entity: string,
    entityId: string,
    params?: FindManyParams,
  ): Promise<PagedResult<AuditLog>>;
}

// Constructor-injected `client` (Phase 3, transaction boundaries) — see
// `UserRepository` for the pattern this follows. This is the repository
// most in need of it: every Service write must audit inside the same
// transaction as the entity write, which only works if `AuditLogRepository`
// can be constructed with that transaction's `tx`.
export class AuditLogRepository implements AuditLogRepositoryLike {
  constructor(private readonly client: Db = prisma) {}

  async record(input: RecordAuditEntryInput): Promise<AuditLog> {
    return this.client.auditLog.create({
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
      this.client.auditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        ...toPagination(params),
      }),
      this.client.auditLog.count({ where }),
    ]);
    return { items, total };
  }
}
