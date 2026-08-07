import type { GovernanceRule } from "@/types/database";
import { withTransaction } from "@/lib/db/transaction";
import {
  GovernanceRuleRepository,
  type GovernanceRuleRepositoryLike,
} from "@/features/governance/repositories/GovernanceRuleRepository";
import {
  AuditLogRepository,
  type AuditLogRepositoryLike,
} from "@/lib/db/repositories/AuditLogRepository";
import { setGovernanceRuleSchema } from "@/features/governance/schemas/GovernanceRuleSchema";
import { parseOrThrow } from "@/lib/validation";
import type { ServiceContext } from "@/features/shared/types/Service";

// Document 7 §7-8, Document 13 §4 (Amendment 4), Document 13 §20 (Phase 3)
// — GovernanceService is the sole writer of `GovernanceRule` (Document 10
// §5.12): "a new minimal table... read and written by GovernanceService."
// `KnowledgeService`/`NotesService` read the same table directly via
// `GovernanceRuleRepositoryLike` for their category-taxonomy check — see
// their identical header comments for why that's a Repository read, not a
// call into this Service. This Service owns the other half: validating
// and persisting rule changes, with a dedicated `GOVERNANCE_CHANGE` audit
// operation (Document 3 §9's `AuditOperation` enum — distinct from
// `UPDATE`, since a governance-config change is a different kind of event
// than an entity edit).
//
// No table has an owner/author field (`GovernanceRule` is global config,
// Document 10 §5.12) and Document 11 §2's single-user MVP means every
// authenticated `context` already is the sole owner — so, like
// `KnowledgeService.list`, there is no per-user scoping to enforce here.
//
// `set` opens a single `withTransaction` and constructs fresh, tx-scoped
// repository instances inside it, so the upsert and its `AuditLog` row
// commit atomically (Phase 3 transaction-boundary requirement).
export class GovernanceService {
  constructor(
    private readonly governanceRuleRepository: GovernanceRuleRepositoryLike = new GovernanceRuleRepository(),
    private readonly auditLogRepository: AuditLogRepositoryLike = new AuditLogRepository(),
  ) {}

  async get(key: string): Promise<GovernanceRule | null> {
    return this.governanceRuleRepository.findByKey(key);
  }

  async list(): Promise<GovernanceRule[]> {
    return this.governanceRuleRepository.list();
  }

  async set(context: ServiceContext, rawInput: unknown): Promise<GovernanceRule> {
    const input = parseOrThrow(setGovernanceRuleSchema, rawInput);
    const existing = await this.governanceRuleRepository.findByKey(input.key);

    return withTransaction(async (tx) => {
      const governanceRuleRepository = new GovernanceRuleRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      const rule = await governanceRuleRepository.upsert(input.key, input.value, input.description);

      await auditLogRepository.record({
        entity: "GovernanceRule",
        entityId: rule.id,
        operation: "GOVERNANCE_CHANGE",
        actorId: context.userId,
        ...(existing ? { before: toGovernanceRuleAuditSnapshot(existing) } : {}),
        after: toGovernanceRuleAuditSnapshot(rule),
      });

      return rule;
    });
  }
}

// JSON-safe audit snapshot — see `ProjectService`'s equivalent for why
// this avoids importing Prisma's `InputJsonValue` type directly. `value`
// is itself already JSON (the column's own type), so it passes through
// unchanged rather than being narrowed field-by-field like an entity
// snapshot.
function toGovernanceRuleAuditSnapshot(rule: GovernanceRule) {
  return {
    key: rule.key,
    value: rule.value,
    description: rule.description ?? null,
  };
}
