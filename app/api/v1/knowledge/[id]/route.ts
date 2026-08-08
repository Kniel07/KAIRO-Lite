import type { NextRequest } from "next/server";
import { KnowledgeService } from "@/features/knowledge/services/KnowledgeService";
import { requireUserId } from "@/lib/auth/session";
import { successResponse, errorResponse } from "@/lib/utils/http";
import { parseRequestBody } from "@/lib/utils/parse-request-body";

const knowledgeService = new KnowledgeService();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const knowledge = await knowledgeService.get({ userId }, id);
    return successResponse(knowledge);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = await parseRequestBody(request);
    const knowledge = await knowledgeService.update({ userId }, id, body);
    return successResponse(knowledge);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await knowledgeService.archive({ userId }, id);
    return successResponse({ id, archived: true });
  } catch (error) {
    return errorResponse(error);
  }
}
