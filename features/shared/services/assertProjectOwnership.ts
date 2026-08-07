import type { ProjectRepositoryLike } from "@/features/projects/repositories/ProjectRepository";
import { ForbiddenError, NotFoundError } from "@/lib/utils/errors";
import type { ServiceContext } from "@/features/shared/types/Service";

// Document 7 §7-8 — shared by every Service whose entity references a
// `Project` (Knowledge, Note, Document — Document 10 §5.3-5.5): each needs
// the identical "does this Project belong to the caller" check, so it
// lives here once rather than as three near-duplicate private methods.
//
// Checked via `findByIdIncludingArchived`, not `findById` — archiving a
// Project is a visibility/lifecycle state, not an ownership change, and
// must not strip access to records already attached to it.
export async function assertProjectOwnership(
  projectRepository: ProjectRepositoryLike,
  context: ServiceContext,
  projectId: string,
): Promise<void> {
  const project = await projectRepository.findByIdIncludingArchived(projectId);
  if (!project) {
    throw new NotFoundError("PROJECT");
  }
  if (project.ownerId !== context.userId) {
    throw new ForbiddenError("You do not have access to this project.");
  }
}
