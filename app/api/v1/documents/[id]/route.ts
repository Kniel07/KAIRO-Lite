import type { NextRequest } from "next/server";
import { DocumentService } from "@/features/documents/services/DocumentService";
import { requireUserId } from "@/lib/auth/session";
import { successResponse, errorResponse } from "@/lib/utils/http";
import { parseRequestBody } from "@/lib/utils/parse-request-body";

const documentService = new DocumentService();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const document = await documentService.get({ userId }, id);
    return successResponse(document);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = await parseRequestBody(request);
    const document = await documentService.update({ userId }, id, body);
    return successResponse(document);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await documentService.archive({ userId }, id);
    return successResponse({ id, archived: true });
  } catch (error) {
    return errorResponse(error);
  }
}
