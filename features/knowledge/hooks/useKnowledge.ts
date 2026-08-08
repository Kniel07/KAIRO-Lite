"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiFetchJson } from "@/lib/utils/api-client";
import type { Knowledge } from "@/types/database";
import type {
  CreateKnowledgeInput,
  UpdateKnowledgeInput,
} from "@/features/knowledge/schemas/KnowledgeSchema";

const KNOWLEDGE_KEY = ["knowledge"] as const;

export function useKnowledgeList(projectId?: string) {
  return useQuery({
    queryKey: [...KNOWLEDGE_KEY, { projectId }],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "100" });
      if (projectId) params.set("projectId", projectId);
      const { data, meta } = await apiFetch<Knowledge[]>(`/api/v1/knowledge?${params.toString()}`);
      return { items: data, meta };
    },
  });
}

export function useCreateKnowledge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateKnowledgeInput) =>
      apiFetchJson<Knowledge>("/api/v1/knowledge", "POST", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEY }),
  });
}

export function useUpdateKnowledge(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateKnowledgeInput) =>
      apiFetchJson<Knowledge>(`/api/v1/knowledge/${id}`, "PATCH", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEY }),
  });
}

export function useArchiveKnowledge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetchJson<{ id: string; archived: true }>(`/api/v1/knowledge/${id}`, "DELETE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEY }),
  });
}
