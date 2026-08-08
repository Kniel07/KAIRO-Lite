"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiFetchJson } from "@/lib/utils/api-client";
import type { KairoDocument } from "@/types/database";
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
} from "@/features/documents/schemas/DocumentSchema";

const DOCUMENTS_KEY = ["documents"] as const;

// `Document.projectId` is required (Document 10 §5.5) and `DocumentService`
// has no unscoped `list` — so, unlike Knowledge, this hook always requires
// a `projectId` and is only meaningful once one is selected.
export function useDocuments(projectId: string | undefined) {
  return useQuery({
    queryKey: [...DOCUMENTS_KEY, { projectId }],
    queryFn: async () => {
      const { data, meta } = await apiFetch<KairoDocument[]>(
        `/api/v1/documents?projectId=${projectId}&pageSize=100`,
      );
      return { items: data, meta };
    },
    enabled: Boolean(projectId),
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDocumentInput) =>
      apiFetchJson<KairoDocument>("/api/v1/documents", "POST", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY }),
  });
}

export function useUpdateDocument(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDocumentInput) =>
      apiFetchJson<KairoDocument>(`/api/v1/documents/${id}`, "PATCH", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY }),
  });
}

export function useArchiveDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetchJson<{ id: string; archived: true }>(`/api/v1/documents/${id}`, "DELETE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY }),
  });
}

export function useSetDocumentPublished() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      apiFetchJson<KairoDocument>(
        `/api/v1/documents/${id}/${published ? "publish" : "unpublish"}`,
        "POST",
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOCUMENTS_KEY }),
  });
}
