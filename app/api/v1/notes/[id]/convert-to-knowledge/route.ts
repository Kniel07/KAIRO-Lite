import type { NextRequest } from "next/server";
import { NotesService } from "@/features/notes/services/NotesService";
import { requireUserId } from "@/lib/auth/session";
import { successResponse, errorResponse } from "@/lib/utils/http";
import { parseRequestBody } from "@/lib/utils/parse-request-body";

// Document 8 §11 — Notes API "Convert to Knowledge."
const notesService = new NotesService();

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = await parseRequestBody(request);
    const knowledge = await notesService.convertToKnowledge({ userId }, id, body);
    return successResponse(knowledge, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
