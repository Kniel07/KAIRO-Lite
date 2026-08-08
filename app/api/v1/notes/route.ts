import type { NextRequest } from "next/server";
import { NotesService } from "@/features/notes/services/NotesService";
import { requireUserId } from "@/lib/auth/session";
import { successResponse, errorResponse } from "@/lib/utils/http";
import { paginationQuerySchema } from "@/features/shared/schemas/pagination";
import { parseOrThrow } from "@/lib/validation";
import { toPaginationMeta } from "@/lib/utils/pagination-meta";
import { parseRequestBody } from "@/lib/utils/parse-request-body";

const notesService = new NotesService();

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const query = parseOrThrow(
      paginationQuerySchema,
      Object.fromEntries(request.nextUrl.searchParams),
    );
    const result = await notesService.list({ userId }, query);
    return successResponse(result.items, { meta: toPaginationMeta(result.total, query) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await parseRequestBody(request);
    const note = await notesService.create({ userId }, body);
    return successResponse(note, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
