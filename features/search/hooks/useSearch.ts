"use client";

import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils/api-client";
import type { KnowledgeSearchResult } from "@/lib/db/repositories/SearchRepository";
import type { SearchQueryInput } from "@/features/search/schemas/SearchSchema";
import type { ApiMeta } from "@/types/api";

// Document 8 §13 — search is modeled as an explicit action (submit a
// query, get a result set), not a continuously-cached `useQuery` — a
// `useMutation` fits that shape: the caller triggers it, gets back
// `data`/`isPending`/`error` for the loading/empty/error states the user's
// Phase 4 usability criteria require.
export function useSearchKnowledge() {
  return useMutation({
    mutationFn: async (input: SearchQueryInput) => {
      const { data, meta } = await apiFetch<KnowledgeSearchResult[]>("/api/v1/search", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return { items: data, meta: meta as ApiMeta | undefined };
    },
  });
}
