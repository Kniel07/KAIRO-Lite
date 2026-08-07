import { NextResponse } from "next/server";
import type { ApiErrorBody, ApiMeta, ApiSuccessBody } from "@/types/api";
import { AppError, UnknownError } from "@/lib/utils/errors";
import { logger } from "@/lib/logger";

// Document 8 §3 — every Route Handler returns this envelope shape.

export function successResponse<T>(
  data: T,
  init?: { status?: number; meta?: ApiMeta },
): NextResponse<ApiSuccessBody<T>> {
  const body: ApiSuccessBody<T> = { success: true, data };
  if (init?.meta) {
    body.meta = init.meta;
  }
  return NextResponse.json(body, { status: init?.status ?? 200 });
}

export function errorResponse(error: unknown): NextResponse<ApiErrorBody> {
  const appError = error instanceof AppError ? error : new UnknownError();

  if (!(error instanceof AppError)) {
    // Document 7 §10 — errors are logged with context, never swallowed.
    logger.error("Unhandled error reached the API boundary", { error });
  }

  const body: ApiErrorBody = {
    success: false,
    error: { code: appError.code, message: appError.message },
  };

  return NextResponse.json(body, { status: appError.httpStatus });
}
