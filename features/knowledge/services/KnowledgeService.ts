import type { Knowledge } from "@/types/database";
import { withTransaction } from "@/lib/db/transaction";
import {
  KnowledgeRepository,
  type KnowledgeRepositoryLike,
} from "@/features/knowledge/repositories/KnowledgeRepository";
import {
  ProjectRepository,
  type ProjectRepositoryLike,
} from "@/features/projects/repositories/ProjectRepository";
import {
  GovernanceRuleRepository,
  type GovernanceRuleRepositoryLike,
} from "@/features/governance/repositories/GovernanceRuleRepository";
import {
  AuditLogRepository,
  type AuditLogRepositoryLike,
} from "@/lib/db/repositories/AuditLogRepository";
import {
  createKnowledgeSchema,
  updateKnowledgeSchema,
} from "@/features/knowledge/schemas/KnowledgeSchema";
import { parseOrThrow } from "@/lib/validation";
import { NotFoundError, UnknownError, ValidationError } from "@/lib/utils/errors";
import type { FindManyParams, PagedResult } from "@/features/shared/types/Repository";
import type { ServiceContext } from "@/features/shared/types/Service";
import { assertProjectOwnership } from "@/features/shared/services/assertProjectOwnership";
import { sanitizeMarkdown } from "@/lib/markdown";

// Document 10 §5.12 config-table key this Service reads to police the
// open-ended `Knowledge.category` taxonomy (Document 13 §4 Amendment 4,
// §8 Amendment 7). `GovernanceService` (Phase 3, implemented after this
// Service per the specified build order) owns *writing* this key; nothing
// here writes it. See the `assertAllowedCategory` docstring for why this
// Service reads the rule via `GovernanceRuleRepositoryLike` directly
// instead of depending on `GovernanceService` (a Service-to-Service call
// the Phase 3 authorization explicitly says to avoid unless required).
const ALLOWED_CATEGORIES_KEY = "knowledge.allowedCategories";

// Document 7 §7-8, Document 13 §4/§8/§20 (Phase 3) — KnowledgeService owns
// Knowledge business logic: category-taxonomy governance, project-scoped
// authorization (`Knowledge.projectId` is optional — see
// `assertProjectOwnership`), and audit-trail creation. Depends only on
// `*RepositoryLike` interfaces — never Prisma, never another Service.
//
// Every write method opens a single `withTransaction` and constructs
// fresh, tx-scoped repository instances inside it, so the entity write and
// its `AuditLog` row commit atomically (Phase 3 transaction-boundary
// requirement).
export class KnowledgeService {
  constructor(
    private readonly knowledgeRepository: KnowledgeRepositoryLike = new KnowledgeRepository(),
    private readonly projectRepository: ProjectRepositoryLike = new ProjectRepository(),
    private readonly governanceRuleRepository: GovernanceRuleRepositoryLike = new GovernanceRuleRepository(),
    private readonly auditLogRepository: AuditLogRepositoryLike = new AuditLogRepository(),
  ) {}

  async get(context: ServiceContext, id: string): Promise<Knowledge> {
    const knowledge = await this.knowledgeRepository.findById(id);
    if (!knowledge) {
      throw new NotFoundError("KNOWLEDGE");
    }
    await this.assertAccess(context, knowledge);
    return knowledge;
  }

  /** Document 11 §2 — single-user MVP; `Knowledge` has no owner field of
   * its own (Document 10 §5.4), so an unscoped list is exactly "mine." */
  async list(context: ServiceContext, params?: FindManyParams): Promise<PagedResult<Knowledge>> {
    void context;
    return this.knowledgeRepository.findMany(params);
  }

  async listByProject(
    context: ServiceContext,
    projectId: string,
    params?: FindManyParams,
  ): Promise<PagedResult<Knowledge>> {
    await assertProjectOwnership(this.projectRepository, context, projectId);
    return this.knowledgeRepository.findByProject(projectId, params);
  }

  async create(context: ServiceContext, rawInput: unknown): Promise<Knowledge> {
    const input = parseOrThrow(createKnowledgeSchema, rawInput);
    await this.assertAllowedCategory(input.category);
    if (input.projectId) {
      await assertProjectOwnership(this.projectRepository, context, input.projectId);
    }

    return withTransaction(async (tx) => {
      const knowledgeRepository = new KnowledgeRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      const knowledge = await knowledgeRepository.create({
        title: input.title,
        summary: input.summary,
        // Document 7 §21 / Document 13 §28 (Amendment 26, Phase 7.5) —
        // write-time sanitization (Phase 7 Security Report finding S3):
        // strips raw HTML pass-through in the Markdown *source* before it
        // is persisted, independent of and in addition to
        // `renderMarkdown()`'s read-time sanitization in the Preview tab —
        // either layer failing alone still leaves the other in place.
        markdown: sanitizeMarkdown(input.markdown),
        category: input.category,
        confidence: input.confidence,
        status: input.status,
        project: input.projectId ? { connect: { id: input.projectId } } : undefined,
      });

      await auditLogRepository.record({
        entity: "Knowledge",
        entityId: knowledge.id,
        operation: "CREATE",
        actorId: context.userId,
        after: toKnowledgeAuditSnapshot(knowledge),
      });

      return knowledge;
    });
  }

  async update(context: ServiceContext, id: string, rawInput: unknown): Promise<Knowledge> {
    const input = parseOrThrow(updateKnowledgeSchema, rawInput);
    const existing = await this.get(context, id);
    if (input.category !== undefined) {
      await this.assertAllowedCategory(input.category);
    }
    // `projectId` is `optional()`, not `nullable()` (Document 7 §11 shape
    // validation) — `undefined` is the only "no change" signal the schema
    // can express, so re-parenting is supported but clearing `projectId`
    // back to `null` is not, on the current schema.
    if (input.projectId !== undefined) {
      await assertProjectOwnership(this.projectRepository, context, input.projectId);
    }

    return withTransaction(async (tx) => {
      const knowledgeRepository = new KnowledgeRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      const knowledge = await knowledgeRepository.update(id, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.summary !== undefined ? { summary: input.summary } : {}),
        ...(input.markdown !== undefined ? { markdown: sanitizeMarkdown(input.markdown) } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.projectId !== undefined ? { project: { connect: { id: input.projectId } } } : {}),
      });

      await auditLogRepository.record({
        entity: "Knowledge",
        entityId: id,
        operation: "UPDATE",
        actorId: context.userId,
        before: toKnowledgeAuditSnapshot(existing),
        after: toKnowledgeAuditSnapshot(knowledge),
      });

      return knowledge;
    });
  }

  async archive(context: ServiceContext, id: string): Promise<void> {
    const existing = await this.get(context, id);

    await withTransaction(async (tx) => {
      const knowledgeRepository = new KnowledgeRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      await knowledgeRepository.archive(id);

      await auditLogRepository.record({
        entity: "Knowledge",
        entityId: id,
        operation: "ARCHIVE",
        actorId: context.userId,
        before: toKnowledgeAuditSnapshot(existing),
      });
    });
  }

  async restore(context: ServiceContext, id: string): Promise<Knowledge> {
    const existing = await this.knowledgeRepository.findByIdIncludingArchived(id);
    if (!existing) {
      throw new NotFoundError("KNOWLEDGE");
    }
    await this.assertAccess(context, existing);

    return withTransaction(async (tx) => {
      const knowledgeRepository = new KnowledgeRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      await knowledgeRepository.restore(id);
      const restored = await knowledgeRepository.findByIdIncludingArchived(id);
      if (!restored) {
        throw new UnknownError("Knowledge restore did not persist.");
      }

      await auditLogRepository.record({
        entity: "Knowledge",
        entityId: id,
        operation: "RESTORE",
        actorId: context.userId,
        before: toKnowledgeAuditSnapshot(existing),
        after: toKnowledgeAuditSnapshot(restored),
      });

      return restored;
    });
  }

  /** Knowledge has no owner field (Document 10 §5.4); access follows the
   * parent Project's owner when one is attached, and is otherwise open to
   * any authenticated context — correct under the single-user MVP model
   * (Document 11 §2), where "authenticated" and "the owner" are the same
   * fact. */
  private async assertAccess(context: ServiceContext, knowledge: Knowledge): Promise<void> {
    if (knowledge.projectId) {
      await assertProjectOwnership(this.projectRepository, context, knowledge.projectId);
    }
  }

  /**
   * Document 13 §4 Amendment 4 — the `Knowledge.category` taxonomy is the
   * one genuinely dynamic governance concern, backed by `GovernanceRule`.
   * Reads the rule directly via `GovernanceRuleRepositoryLike` rather than
   * calling a `GovernanceService.isAllowedCategory()` method: Document 7
   * §8 permits Services to depend on Repository interfaces generally (not
   * only their own feature's repository), and the Phase 3 authorization
   * says not to add a Service-to-Service call unless the constitution
   * requires one — it requires the *governance policy*, not a particular
   * call path. `GovernanceRule.value` is untyped JSON, so the shape is
   * checked defensively; an absent rule or a malformed value means no
   * restriction is configured yet, and any category is allowed.
   */
  private async assertAllowedCategory(category: string): Promise<void> {
    const rule = await this.governanceRuleRepository.findByKey(ALLOWED_CATEGORIES_KEY);
    if (!rule) {
      return;
    }
    const allowed = rule.value;
    if (!Array.isArray(allowed) || allowed.length === 0) {
      return;
    }
    if (!allowed.every((entry) => typeof entry === "string")) {
      return;
    }
    if (!allowed.includes(category)) {
      throw new ValidationError(`category must be one of: ${allowed.join(", ")}`);
    }
  }
}

// JSON-safe audit snapshot — see `ProjectService`'s equivalent for why
// this avoids importing Prisma's `InputJsonValue` type directly.
function toKnowledgeAuditSnapshot(knowledge: Knowledge) {
  return {
    title: knowledge.title,
    summary: knowledge.summary ?? null,
    category: knowledge.category,
    confidence: knowledge.confidence,
    status: knowledge.status,
    projectId: knowledge.projectId ?? null,
    archivedAt: knowledge.archivedAt ? knowledge.archivedAt.toISOString() : null,
  };
}
