import type { NextRequest } from "next/server";
import { ValidationError } from "@/lib/utils/errors";

// Document 7 §11 — "Reject invalid payloads immediately." A malformed or
// empty JSON body isn't a server error (`request.json()`'s raw
// `SyntaxError` would otherwise surface as an opaque `UnknownError`/500
// via `errorResponse`) — it's a client input problem, same tier as a
// Zod validation failure.
export async function parseRequestBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON.");
  }
}
