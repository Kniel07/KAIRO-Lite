import type { KairoDocument, Knowledge, Note } from "@/types/database";
import { withTransaction } from "@/lib/db/transaction";
import {
  NoteRepository,
  type NoteRepositoryLike,
} from "@/features/notes/repositories/NoteRepository";
import {
  ProjectRepository,
  type ProjectRepositoryLike,
} from "@/features/projects/repositories/ProjectRepository";
import { KnowledgeRepository } from "@/features/knowledge/repositories/KnowledgeRepository";
import { DocumentRepository } from "@/features/documents/repositories/DocumentRepository";
import {
  GovernanceRuleRepository,
  type GovernanceRuleRepositoryLike,
} from "@/features/governance/repositories/GovernanceRuleRepository";
import {
  AuditLogRepository,
  type AuditLogRepositoryLike,
} from "@/lib/db/repositories/AuditLogRepository";
import {
  convertNoteToDocumentSchema,
  convertNoteToKnowledgeSchema,
  createNoteSchema,
  updateNoteSchema,
} from "@/features/notes/schemas/NoteSchema";
import { parseOrThrow } from "@/lib/validation";
import { ForbiddenError, NotFoundError, UnknownError, ValidationError } from "@/lib/utils/errors";
import type { FindManyParams, PagedResult } from "@/features/shared/types/Repository";
import type { ServiceContext } from "@/features/shared/types/Service";
import { assertProjectOwnership } from "@/features/shared/services/assertProjectOwnership";

// Same config-table key `KnowledgeService` reads (Document 13 §4 Amendment
// 4). `convertToKnowledge` produces a `Knowledge` row and must honor the
// same category taxonomy a direct `KnowledgeService.create()` call would —
// see that Service's identical constant/comment for why this is read
// directly via `GovernanceRuleRepositoryLike` rather than a Service call.
const ALLOWED_CATEGORIES_KEY = "knowledge.allowedCategories";

// Document 7 §7-8, Document 8 §11, Document 13 §20 (Phase 3) — NotesService
// owns Note business logic: author-scoped authorization, and the two
// conversion operations the Notes API exposes ("Convert to Knowledge",
// "Convert to Document" — Document 8 §11).
//
// Both conversions write directly via `KnowledgeRepository` /
// `DocumentRepository` (constructed fresh, tx-scoped, inside
// `withTransaction` — same as every other write below — never as a
// constructor-injected default instance, since nothing here ever reads
// Knowledge/Document outside of a conversion transaction) rather than
// calling `KnowledgeService` / `DocumentService`. The constitution requires
// the *capability*
// (Document 8 §11 lists it as a Notes API operation) but names no
// particular call path, and the Phase 3 authorization says not to add a
// Service-to-Service call unless the constitution requires one — so this
// keeps the dependency graph to Repositories only, and also sidesteps the
// build-order dependency a Service call would force (`DocumentService` is
// built after `NotesService` in the specified order). The cost is that the
// category-governance check (`assertAllowedCategory`, duplicated from
// `KnowledgeService`) and the project-ownership check (shared via
// `assertProjectOwnership`) have to be applied here too, at the point of
// conversion, so the same invariants hold regardless of entry point.
//
// Every write method opens a single `withTransaction` and constructs
// fresh, tx-scoped repository instances inside it, so the entity write and
// its `AuditLog` row commit atomically (Phase 3 transaction-boundary
// requirement).
export class NotesService {
  constructor(
    private readonly noteRepository: NoteRepositoryLike = new NoteRepository(),
    private readonly projectRepository: ProjectRepositoryLike = new ProjectRepository(),
    private readonly governanceRuleRepository: GovernanceRuleRepositoryLike = new GovernanceRuleRepository(),
    private readonly auditLogRepository: AuditLogRepositoryLike = new AuditLogRepository(),
  ) {}

  async get(context: ServiceContext, id: string): Promise<Note> {
    const note = await this.noteRepository.findById(id);
    if (!note) {
      throw new NotFoundError("NOTE");
    }
    this.assertAuthor(context, note);
    return note;
  }

  /** Document 10 §5.3 — `Note.authorId` is required, so listings are
   * scoped to it directly (no Project indirection needed, unlike
   * `KnowledgeService.list`). */
  async list(context: ServiceContext, params?: FindManyParams): Promise<PagedResult<Note>> {
    return this.noteRepository.findByAuthor(context.userId, params);
  }

  async create(context: ServiceContext, rawInput: unknown): Promise<Note> {
    const input = parseOrThrow(createNoteSchema, rawInput);
    if (input.projectId) {
      await assertProjectOwnership(this.projectRepository, context, input.projectId);
    }

    return withTransaction(async (tx) => {
      const noteRepository = new NoteRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      const note = await noteRepository.create({
        title: input.title,
        content: input.content,
        noteType: input.noteType,
        source: input.source,
        author: { connect: { id: context.userId } },
        project: input.projectId ? { connect: { id: input.projectId } } : undefined,
      });

      await auditLogRepository.record({
        entity: "Note",
        entityId: note.id,
        operation: "CREATE",
        actorId: context.userId,
        after: toNoteAuditSnapshot(note),
      });

      return note;
    });
  }

  async update(context: ServiceContext, id: string, rawInput: unknown): Promise<Note> {
    const input = parseOrThrow(updateNoteSchema, rawInput);
    const existing = await this.get(context, id);
    if (input.projectId !== undefined) {
      await assertProjectOwnership(this.projectRepository, context, input.projectId);
    }

    return withTransaction(async (tx) => {
      const noteRepository = new NoteRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      const note = await noteRepository.update(id, {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.noteType !== undefined ? { noteType: input.noteType } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        ...(input.projectId !== undefined ? { project: { connect: { id: input.projectId } } } : {}),
      });

      await auditLogRepository.record({
        entity: "Note",
        entityId: id,
        operation: "UPDATE",
        actorId: context.userId,
        before: toNoteAuditSnapshot(existing),
        after: toNoteAuditSnapshot(note),
      });

      return note;
    });
  }

  async archive(context: ServiceContext, id: string): Promise<void> {
    const existing = await this.get(context, id);

    await withTransaction(async (tx) => {
      const noteRepository = new NoteRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      await noteRepository.archive(id);

      await auditLogRepository.record({
        entity: "Note",
        entityId: id,
        operation: "ARCHIVE",
        actorId: context.userId,
        before: toNoteAuditSnapshot(existing),
      });
    });
  }

  async restore(context: ServiceContext, id: string): Promise<Note> {
    const existing = await this.noteRepository.findByIdIncludingArchived(id);
    if (!existing) {
      throw new NotFoundError("NOTE");
    }
    this.assertAuthor(context, existing);

    return withTransaction(async (tx) => {
      const noteRepository = new NoteRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      await noteRepository.restore(id);
      const restored = await noteRepository.findByIdIncludingArchived(id);
      if (!restored) {
        throw new UnknownError("Note restore did not persist.");
      }

      await auditLogRepository.record({
        entity: "Note",
        entityId: id,
        operation: "RESTORE",
        actorId: context.userId,
        before: toNoteAuditSnapshot(existing),
        after: toNoteAuditSnapshot(restored),
      });

      return restored;
    });
  }

  /**
   * Document 8 §11 — "Convert to Knowledge." Produces a new `Knowledge`
   * row from the Note's `title`/`content`; the source Note is left
   * unarchived (the constitution specifies no post-conversion Note
   * lifecycle, so the conversion is non-destructive and reversible by
   * design, not by omission).
   */
  async convertToKnowledge(
    context: ServiceContext,
    noteId: string,
    rawInput: unknown,
  ): Promise<Knowledge> {
    const note = await this.get(context, noteId);
    const input = parseOrThrow(convertNoteToKnowledgeSchema, rawInput);
    await this.assertAllowedCategory(input.category);

    return withTransaction(async (tx) => {
      const knowledgeRepository = new KnowledgeRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      const knowledge = await knowledgeRepository.create({
        title: note.title,
        markdown: note.content,
        category: input.category,
        confidence: input.confidence,
        project: note.projectId ? { connect: { id: note.projectId } } : undefined,
      });

      await auditLogRepository.record({
        entity: "Knowledge",
        entityId: knowledge.id,
        operation: "CREATE",
        actorId: context.userId,
        after: { ...toKnowledgeAuditSnapshot(knowledge), convertedFromNoteId: note.id },
      });

      return knowledge;
    });
  }

  /**
   * Document 8 §11 — "Convert to Document." `Document.projectId` is
   * required (Document 10 §5.5), unlike `Note.projectId`, so a source Note
   * with no project requires the caller to supply one explicitly (Document
   * 7 §11 shape validation is in `convertNoteToDocumentSchema`; the
   * "required unless the Note already has one" business rule is enforced
   * here).
   */
  async convertToDocument(
    context: ServiceContext,
    noteId: string,
    rawInput: unknown,
  ): Promise<KairoDocument> {
    const note = await this.get(context, noteId);
    const input = parseOrThrow(convertNoteToDocumentSchema, rawInput);
    const projectId = input.projectId ?? note.projectId;
    if (!projectId) {
      throw new ValidationError(
        "projectId is required: the source Note has no project, so one must be supplied.",
      );
    }
    await assertProjectOwnership(this.projectRepository, context, projectId);

    return withTransaction(async (tx) => {
      const documentRepository = new DocumentRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      const document = await documentRepository.create({
        title: note.title,
        markdown: note.content,
        type: input.type,
        project: { connect: { id: projectId } },
      });

      await auditLogRepository.record({
        entity: "Document",
        entityId: document.id,
        operation: "CREATE",
        actorId: context.userId,
        after: { ...toDocumentAuditSnapshot(document), convertedFromNoteId: note.id },
      });

      return document;
    });
  }

  private assertAuthor(context: ServiceContext, note: Note): void {
    if (note.authorId !== context.userId) {
      throw new ForbiddenError("You do not have access to this note.");
    }
  }

  /** Duplicated from `KnowledgeService.assertAllowedCategory` by design —
   * see this file's header comment. */
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

// JSON-safe audit snapshots — see `ProjectService`'s equivalent for why
// these avoid importing Prisma's `InputJsonValue` type directly.
function toNoteAuditSnapshot(note: Note) {
  return {
    title: note.title,
    noteType: note.noteType,
    source: note.source,
    projectId: note.projectId ?? null,
    archivedAt: note.archivedAt ? note.archivedAt.toISOString() : null,
  };
}

function toKnowledgeAuditSnapshot(knowledge: Knowledge) {
  return {
    title: knowledge.title,
    category: knowledge.category,
    confidence: knowledge.confidence,
    status: knowledge.status,
    projectId: knowledge.projectId ?? null,
  };
}

function toDocumentAuditSnapshot(document: KairoDocument) {
  return {
    title: document.title,
    type: document.type,
    projectId: document.projectId,
    version: document.version,
    published: document.published,
  };
}
