import type { NextRequest } from "next/server";
import { SearchService } from "@/features/search/services/SearchService";
import { searchQuerySchema } from "@/features/search/schemas/SearchSchema";
import { requireUserId } from "@/lib/auth/session";
import { successResponse, errorResponse } from "@/lib/utils/http";
import { parseOrThrow } from "@/lib/validation";
import { toPaginationMeta } from "@/lib/utils/pagination-meta";
import { parseRequestBody } from "@/lib/utils/parse-request-body";

// Document 8 §13 — Search API. Request shown as a JSON body in Document 8
// (`{"query": "..."}), not query-string params, so this is POST, not GET.
// Validated here (not only inside the Service) so the route has a
// trustworthy `page`/`pageSize` to compute `meta` from — the raw body
// could carry a string, a missing field, or an out-of-range value.
const searchService = new SearchService();

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const rawBody = await parseRequestBody(request);
    const input = parseOrThrow(searchQuerySchema, rawBody);
    const result = await searchService.searchKnowledge({ userId }, input);
    return successResponse(result.items, { meta: toPaginationMeta(result.total, input) });
  } catch (error) {
    return errorResponse(error);
  }
}
