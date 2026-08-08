import type { NextRequest } from "next/server";
import { DocumentService } from "@/features/documents/services/DocumentService";
import { requireUserId } from "@/lib/auth/session";
import { successResponse, errorResponse } from "@/lib/utils/http";
import { documentQuerySchema } from "@/features/documents/schemas/DocumentQuerySchema";
import { parseOrThrow } from "@/lib/validation";
import { toPaginationMeta } from "@/lib/utils/pagination-meta";
import { parseRequestBody } from "@/lib/utils/parse-request-body";

const documentService = new DocumentService();

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { projectId, ...pagination } = parseOrThrow(
      documentQuerySchema,
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await documentService.listByProject({ userId }, projectId, pagination);
    return successResponse(result.items, { meta: toPaginationMeta(result.total, pagination) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await parseRequestBody(request);
    const document = await documentService.create({ userId }, body);
    return successResponse(document, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
