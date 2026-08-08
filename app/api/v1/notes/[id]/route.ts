import type { NextRequest } from "next/server";
import { NotesService } from "@/features/notes/services/NotesService";
import { requireUserId } from "@/lib/auth/session";
import { successResponse, errorResponse } from "@/lib/utils/http";
import { parseRequestBody } from "@/lib/utils/parse-request-body";

const notesService = new NotesService();

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const note = await notesService.get({ userId }, id);
    return successResponse(note);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = await parseRequestBody(request);
    const note = await notesService.update({ userId }, id, body);
    return successResponse(note);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await notesService.archive({ userId }, id);
    return successResponse({ id, archived: true });
  } catch (error) {
    return errorResponse(error);
  }
}
