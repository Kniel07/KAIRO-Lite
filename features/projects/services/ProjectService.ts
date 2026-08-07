import type { Project } from "@/types/database";
import { withTransaction } from "@/lib/db/transaction";
import {
  ProjectRepository,
  type ProjectRepositoryLike,
} from "@/features/projects/repositories/ProjectRepository";
import {
  AuditLogRepository,
  type AuditLogRepositoryLike,
} from "@/lib/db/repositories/AuditLogRepository";
import {
  createProjectSchema,
  updateProjectSchema,
} from "@/features/projects/schemas/ProjectSchema";
import { parseOrThrow } from "@/lib/validation";
import { slugify } from "@/lib/utils/slugify";
import { ForbiddenError, NotFoundError, UnknownError } from "@/lib/utils/errors";
import type { FindManyParams, PagedResult } from "@/features/shared/types/Repository";
import type { ServiceContext } from "@/features/shared/types/Service";

// Document 7 §7-8, Document 13 §20 (Phase 3) — ProjectService owns all
// Project business logic: ownership authorization, slug generation, and
// audit-trail creation. It never touches Prisma directly (enforced by the
// `features/*/services/**` ESLint boundary) and depends only on the
// `*RepositoryLike` interfaces, not the concrete repository classes, so
// unit tests can substitute fakes.
//
// Deliberately narrower than the generic `Service<T, C, U>` shape
// (`features/shared/types/Service.ts`): `list` needs pagination and
// `restore` isn't part of that interface, so this class defines its own
// method set rather than a forced (and lossy) `implements`.
//
// Every write method (`create`/`update`/`archive`/`restore`) opens a single
// `withTransaction` and constructs fresh, tx-scoped repository instances
// inside it, so the entity write and its `AuditLog` row commit atomically
// (Phase 3 transaction-boundary requirement). Reads use the constructor's
// default (non-transactional) repositories.
export class ProjectService {
  constructor(
    private readonly projectRepository: ProjectRepositoryLike = new ProjectRepository(),
    private readonly auditLogRepository: AuditLogRepositoryLike = new AuditLogRepository(),
  ) {}

  async get(context: ServiceContext, id: string): Promise<Project> {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new NotFoundError("PROJECT");
    }
    this.assertOwnership(context, project);
    return project;
  }

  async list(context: ServiceContext, params?: FindManyParams): Promise<PagedResult<Project>> {
    return this.projectRepository.findByOwner(context.userId, params);
  }

  async create(context: ServiceContext, rawInput: unknown): Promise<Project> {
    const input = parseOrThrow(createProjectSchema, rawInput);
    const slug = await this.generateUniqueSlug(input.name);

    return withTransaction(async (tx) => {
      const projectRepository = new ProjectRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      const project = await projectRepository.create({
        name: input.name,
        slug,
        description: input.description,
        status: input.status,
        priority: input.priority,
        visibility: input.visibility,
        owner: { connect: { id: context.userId } },
      });

      await auditLogRepository.record({
        entity: "Project",
        entityId: project.id,
        operation: "CREATE",
        actorId: context.userId,
        after: toProjectAuditSnapshot(project),
      });

      return project;
    });
  }

  async update(context: ServiceContext, id: string, rawInput: unknown): Promise<Project> {
    const input = parseOrThrow(updateProjectSchema, rawInput);
    const existing = await this.get(context, id);

    return withTransaction(async (tx) => {
      const projectRepository = new ProjectRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      const project = await projectRepository.update(id, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
      });

      await auditLogRepository.record({
        entity: "Project",
        entityId: id,
        operation: "UPDATE",
        actorId: context.userId,
        before: toProjectAuditSnapshot(existing),
        after: toProjectAuditSnapshot(project),
      });

      return project;
    });
  }

  async archive(context: ServiceContext, id: string): Promise<void> {
    const existing = await this.get(context, id);

    await withTransaction(async (tx) => {
      const projectRepository = new ProjectRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      await projectRepository.archive(id);

      await auditLogRepository.record({
        entity: "Project",
        entityId: id,
        operation: "ARCHIVE",
        actorId: context.userId,
        before: toProjectAuditSnapshot(existing),
      });
    });
  }

  async restore(context: ServiceContext, id: string): Promise<Project> {
    const existing = await this.projectRepository.findByIdIncludingArchived(id);
    if (!existing) {
      throw new NotFoundError("PROJECT");
    }
    this.assertOwnership(context, existing);

    return withTransaction(async (tx) => {
      const projectRepository = new ProjectRepository(tx);
      const auditLogRepository = new AuditLogRepository(tx);

      await projectRepository.restore(id);
      const restored = await projectRepository.findByIdIncludingArchived(id);
      if (!restored) {
        throw new UnknownError("Project restore did not persist.");
      }

      await auditLogRepository.record({
        entity: "Project",
        entityId: id,
        operation: "RESTORE",
        actorId: context.userId,
        before: toProjectAuditSnapshot(existing),
        after: toProjectAuditSnapshot(restored),
      });

      return restored;
    });
  }

  private assertOwnership(context: ServiceContext, project: Project): void {
    if (project.ownerId !== context.userId) {
      throw new ForbiddenError("You do not have access to this project.");
    }
  }

  /**
   * Document 10 §5.2 — `slug` is globally unique, including archived rows
   * (the column has no partial-uniqueness scoping), so collision checks
   * must look past the soft-delete extension's default exclusion via
   * `findBySlugIncludingArchived`. A narrow check-then-insert race is
   * possible under concurrent creation of the same name; acceptable for
   * the single-user MVP (Document 11 §2).
   */
  private async generateUniqueSlug(name: string): Promise<string> {
    const base = slugify(name) || "project";
    let candidate = base;
    let suffix = 2;
    while (await this.projectRepository.findBySlugIncludingArchived(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }
    return candidate;
  }
}

// JSON-safe audit snapshot. `AuditLogRepositoryLike.record()` types
// `before`/`after` as Prisma's `InputJsonValue`, which rejects raw `Date`
// objects and `undefined` — rather than import that type here (Services
// may not import `@/generated/prisma`, Document 7 §8), this returns a
// plain object literal of primitives/strings that TypeScript checks
// structurally against `InputJsonValue` at the `record()` call site.
function toProjectAuditSnapshot(project: Project) {
  return {
    name: project.name,
    slug: project.slug,
    description: project.description ?? null,
    status: project.status,
    priority: project.priority,
    visibility: project.visibility,
    ownerId: project.ownerId,
    archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
  };
}
