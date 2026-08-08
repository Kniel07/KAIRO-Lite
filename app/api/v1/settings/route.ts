import type { NextRequest } from "next/server";
import { SettingsService } from "@/features/settings/services/SettingsService";
import { requireUserId } from "@/lib/auth/session";
import { successResponse, errorResponse } from "@/lib/utils/http";
import { parseRequestBody } from "@/lib/utils/parse-request-body";

const settingsService = new SettingsService();

export async function GET() {
  try {
    const userId = await requireUserId();
    const settings = await settingsService.get({ userId });
    return successResponse(settings);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const body = await parseRequestBody(request);
    const settings = await settingsService.update({ userId }, body);
    return successResponse(settings);
  } catch (error) {
    return errorResponse(error);
  }
}
