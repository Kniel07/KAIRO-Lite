import type { KairoDocument } from "@/types/database";
import { withTransaction } from "@/lib/db/transaction";
import {
  DocumentRepository,
  type DocumentRepositoryLike,
} from "@/features/documents/repositories/DocumentRepository";
import {
  ProjectRepository,
  type ProjectRepositoryLike,
} from "@/features/projects/repositories/ProjectRepository";
import {
  AuditLogRepository,
  type AuditLogRepositoryLike,
} from "@/lib/db/repositories/AuditLogRepository";
import {
  createDocumentSchema,
  updateDocumentSchema,
} from "@/features/documents/schemas/DocumentSchema";
import { parseOrThrow } from "@/lib/validation";
import { NotFoundError, UnknownError } from "@/lib/utils/errors";
import type { FindManyParams, PagedResult } from "@/features/shared/types/Repository";
import type { ServiceContext } from "@/features/shared/types/Service";
import { assertProjectOwnership } from "@/features/shared/services/assertProjectOwnership";
import { sanitizeMarkdown } from "@/lib/markdown";

// Document 7 §7-8, Document 8 §12, Document 13 §20 (Phase 3) —
// DocumentService owns Document business logic: project-scoped
// authorization (`Document.projectId` is required, unlike Knowledge's/
// Note's optional one — Document 10 §5.5 — so, unlike those two Services,
// this one has no unscoped `list`: every Document's authorization scope is
// its Project, so listing must always go through `listByProject`), a
// minimal "version history" rule (`version` increments whenever `markdown`
// content actually changes), and the "Publishing" capability Document 8
// §12 lists (`publish`/`unpublish` — not part of generic `update`, since
// `published` was never a creatable field in `createDocumentSchema`).
//
// Every write method opens a single `withTransaction` and constructs
// fresh, tx-scoped repository instances inside it, so the entity write and
// its `AuditLog` row commit atomically (Phase 3 transaction-boundary
// requirement).
export class DocumentService {
  constructor(
    private readonly documentRepository: DocumentRepositoryLike = new DocumentRepository(),
    private readonly projectRepository: ProjectRepositoryLike = new ProjectRepository(),
    private readonly auditLogRepository: AuditLogRepositoryLike = new AuditLogRepository(),
  ) {}

  async get(context: ServiceContext, id: string): Promise<KairoDocument> {
    const document = await this.documentRepository.findById(id);
    if (!document) {
      throw new NotFoundError("DOCUMENT");
    }
    await assertProjectOwnership(this.projectRepository, context, document.projectId);
    return document;
  }

  async listByProject(
    context: ServiceContext,
    projectId: string,
    params?: FindManyParams,
  ): Promise<PagedResult<KairoDocument>> {
    await assertProjectOwnership(this.projectRepository, context, projectId);
    return this.documentRepository.findByProject(projectId, params);
  }

  async create(context: ServiceContext, rawInput: unknown): Promise<KairoDocument> {
    const input = parseOrThrow(createDocumentSchema, rawInput);
    await assertProjectOwnership(this.projectRepository, context, input.projectId);

    return withTransaction(async (tx) => {
      const documentRepository = new DocumentRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      const document = await documentRepository.create({
        title: input.title,
        // Document 7 §21 / Document 13 §28 (Amendment 26, Phase 7.5) —
        // write-time sanitization (Phase 7 Security Report finding S3);
        // see `KnowledgeService.create`'s identical comment for why this is
        // one of two independent layers, not a replacement for
        // `renderMarkdown()`'s read-time one.
        markdown: sanitizeMarkdown(input.markdown),
        type: input.type,
        project: { connect: { id: input.projectId } },
      });

      await auditLogRepository.record({
        entity: "Document",
        entityId: document.id,
        operation: "CREATE",
        actorId: context.userId,
        after: toDocumentAuditSnapshot(document),
      });

      return document;
    });
  }

  async update(context: ServiceContext, id: string, rawInput: unknown): Promise<KairoDocument> {
    const input = parseOrThrow(updateDocumentSchema, rawInput);
    const existing = await this.get(context, id);
    // Sanitize once, up front, so the version-bump comparison below checks
    // the same value that actually gets persisted (Document 13 §28,
    // Amendment 26) — comparing the raw input against `existing.markdown`
    // (already-sanitized, from a prior write) could otherwise bump the
    // version on a change that sanitization reduces to a no-op.
    const sanitizedMarkdown =
      input.markdown !== undefined ? sanitizeMarkdown(input.markdown) : undefined;
    const contentChanged =
      sanitizedMarkdown !== undefined && sanitizedMarkdown !== existing.markdown;

    return withTransaction(async (tx) => {
      const documentRepository = new DocumentRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      const document = await documentRepository.update(id, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(sanitizedMarkdown !== undefined ? { markdown: sanitizedMarkdown } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        // Document 8 §12 "Version history" — bump on actual content change,
        // not on every update (a title-only rename isn't a new version).
        ...(contentChanged ? { version: existing.version + 1 } : {}),
      });

      await auditLogRepository.record({
        entity: "Document",
        entityId: id,
        operation: "UPDATE",
        actorId: context.userId,
        before: toDocumentAuditSnapshot(existing),
        after: toDocumentAuditSnapshot(document),
      });

      return document;
    });
  }

  /** Document 8 §12 "Publishing." Not part of generic `update` — `published`
   * is a lifecycle field, never part of `createDocumentSchema`/
   * `updateDocumentSchema`'s input shape. */
  async publish(context: ServiceContext, id: string): Promise<KairoDocument> {
    return this.setPublished(context, id, true);
  }

  async unpublish(context: ServiceContext, id: string): Promise<KairoDocument> {
    return this.setPublished(context, id, false);
  }

  async archive(context: ServiceContext, id: string): Promise<void> {
    const existing = await this.get(context, id);

    await withTransaction(async (tx) => {
      const documentRepository = new DocumentRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      await documentRepository.archive(id);

      await auditLogRepository.record({
        entity: "Document",
        entityId: id,
        operation: "ARCHIVE",
        actorId: context.userId,
        before: toDocumentAuditSnapshot(existing),
      });
    });
  }

  async restore(context: ServiceContext, id: string): Promise<KairoDocument> {
    const existing = await this.documentRepository.findByIdIncludingArchived(id);
    if (!existing) {
      throw new NotFoundError("DOCUMENT");
    }
    await assertProjectOwnership(this.projectRepository, context, existing.projectId);

    return withTransaction(async (tx) => {
      const documentRepository = new DocumentRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      await documentRepository.restore(id);
      const restored = await documentRepository.findByIdIncludingArchived(id);
      if (!restored) {
        throw new UnknownError("Document restore did not persist.");
      }

      await auditLogRepository.record({
        entity: "Document",
        entityId: id,
        operation: "RESTORE",
        actorId: context.userId,
        before: toDocumentAuditSnapshot(existing),
        after: toDocumentAuditSnapshot(restored),
      });

      return restored;
    });
  }

  private async setPublished(
    context: ServiceContext,
    id: string,
    published: boolean,
  ): Promise<KairoDocument> {
    const existing = await this.get(context, id);

    return withTransaction(async (tx) => {
      const documentRepository = new DocumentRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      const document = await documentRepository.update(id, { published });

      await auditLogRepository.record({
        entity: "Document",
        entityId: id,
        operation: "UPDATE",
        actorId: context.userId,
        before: toDocumentAuditSnapshot(existing),
        after: toDocumentAuditSnapshot(document),
      });

      return document;
    });
  }
}

// JSON-safe audit snapshot — see `ProjectService`'s equivalent for why
// this avoids importing Prisma's `InputJsonValue` type directly.
function toDocumentAuditSnapshot(document: KairoDocument) {
  return {
    title: document.title,
    type: document.type,
    projectId: document.projectId,
    version: document.version,
    published: document.published,
    archivedAt: document.archivedAt ? document.archivedAt.toISOString() : null,
  };
}
