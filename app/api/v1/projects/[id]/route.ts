import type { NextRequest } from "next/server";
import { ProjectService } from "@/features/projects/services/ProjectService";
import { requireUserId } from "@/lib/auth/session";
import { successResponse, errorResponse } from "@/lib/utils/http";
import { parseRequestBody } from "@/lib/utils/parse-request-body";

const projectService = new ProjectService();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const project = await projectService.get({ userId }, id);
    return successResponse(project);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = await parseRequestBody(request);
    const project = await projectService.update({ userId }, id, body);
    return successResponse(project);
  } catch (error) {
    return errorResponse(error);
  }
}

// Document 8 §9 — "DELETE /:id → Archive project" (soft delete, Document 3
// §8 — there is no hard-delete path anywhere in this system).
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await projectService.archive({ userId }, id);
    return successResponse({ id, archived: true });
  } catch (error) {
    return errorResponse(error);
  }
}
