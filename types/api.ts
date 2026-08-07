import type { ErrorCode } from "@/lib/utils/errors";

// Document 8 §3 — Response Standard.

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  hasNext?: boolean;
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
  };
}

export type ApiResponse<T> = ApiSuccessBody<T> | ApiErrorBody;
