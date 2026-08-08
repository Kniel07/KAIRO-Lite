import type { ApiMeta, ApiResponse } from "@/types/api";
import type { ErrorCode } from "@/lib/utils/errors";

// Document 8 §3 — the client-side counterpart to `lib/utils/http.ts`'s
// `successResponse`/`errorResponse`: every fetch to `/api/v1/**` returns
// the same envelope, so this is the one place that unwraps it. Client
// Components use this (via `fetch`, always relative URLs — this file is
// browser-only, no server-side absolute-URL construction) rather than
// importing a Service directly, per the Component → Route → Service chain
// (Document 7 §8) the `features/*/services/**` and `components/**`/`app/**`
// ESLint boundaries both enforce.

export class ApiRequestError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
  }
}

export interface ApiFetchResult<T> {
  data: T;
  meta?: ApiMeta;
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<ApiFetchResult<T>> {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  const body = (await response.json()) as ApiResponse<T>;

  if (!body.success) {
    throw new ApiRequestError(body.error.code, body.error.message, response.status);
  }

  return { data: body.data, meta: body.meta };
}

export async function apiFetchJson<T>(url: string, method: string, payload?: unknown): Promise<T> {
  const { data } = await apiFetch<T>(url, {
    method,
    ...(payload !== undefined ? { body: JSON.stringify(payload) } : {}),
  });
  return data;
}
