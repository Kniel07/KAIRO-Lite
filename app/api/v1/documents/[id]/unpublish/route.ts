import type { NextRequest } from "next/server";
import { DocumentService } from "@/features/documents/services/DocumentService";
import { requireUserId } from "@/lib/auth/session";
import { successResponse, errorResponse } from "@/lib/utils/http";

// Document 8 §12 — Documents API "Publishing" (the reverse action).
const documentService = new DocumentService();

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const document = await documentService.unpublish({ userId }, id);
    return successResponse(document);
  } catch (error) {
    return errorResponse(error);
  }
}
