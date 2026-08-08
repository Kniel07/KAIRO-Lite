import type { NextRequest } from "next/server";
import { KnowledgeService } from "@/features/knowledge/services/KnowledgeService";
import { requireUserId } from "@/lib/auth/session";
import { successResponse, errorResponse } from "@/lib/utils/http";
import { knowledgeQuerySchema } from "@/features/knowledge/schemas/KnowledgeQuerySchema";
import { parseOrThrow } from "@/lib/validation";
import { toPaginationMeta } from "@/lib/utils/pagination-meta";
import { parseRequestBody } from "@/lib/utils/parse-request-body";

const knowledgeService = new KnowledgeService();

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const query = parseOrThrow(
      knowledgeQuerySchema,
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const { projectId, ...pagination } = query;
    const result = projectId
      ? await knowledgeService.listByProject({ userId }, projectId, pagination)
      : await knowledgeService.list({ userId }, pagination);
    return successResponse(result.items, { meta: toPaginationMeta(result.total, pagination) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await parseRequestBody(request);
    const knowledge = await knowledgeService.create({ userId }, body);
    return successResponse(knowledge, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
