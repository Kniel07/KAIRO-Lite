import type { NextRequest } from "next/server";
import { ProjectService } from "@/features/projects/services/ProjectService";
import { requireUserId } from "@/lib/auth/session";
import { successResponse, errorResponse } from "@/lib/utils/http";
import { paginationQuerySchema } from "@/features/shared/schemas/pagination";
import { parseOrThrow } from "@/lib/validation";
import { toPaginationMeta } from "@/lib/utils/pagination-meta";
import { parseRequestBody } from "@/lib/utils/parse-request-body";

// Document 8 §9, §25 — Route Handler: validate, authenticate, authorize
// (delegated to the Service), call exactly one Service entry point, return
// the standard envelope. No business logic lives here.
const projectService = new ProjectService();

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const query = parseOrThrow(
      paginationQuerySchema,
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await projectService.list({ userId }, query);
    return successResponse(result.items, { meta: toPaginationMeta(result.total, query) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await parseRequestBody(request);
    const project = await projectService.create({ userId }, body);
    return successResponse(project, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
