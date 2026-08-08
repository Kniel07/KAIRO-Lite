"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiFetchJson } from "@/lib/utils/api-client";
import type { Project } from "@/types/database";
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from "@/features/projects/schemas/ProjectSchema";

// Document 5 §4/§10 — feature-owned hooks, the one place Client Components
// touch data fetching. Talks to `/api/v1/projects` only — never a Service,
// never Prisma (Document 7 §8's chain, enforced by the ESLint boundary a
// hook file has no special exemption from).
const PROJECTS_KEY = ["projects"] as const;

export function useProjects() {
  return useQuery({
    queryKey: PROJECTS_KEY,
    queryFn: async () => {
      const { data, meta } = await apiFetch<Project[]>("/api/v1/projects?pageSize=100");
      return { items: data, meta };
    },
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: [...PROJECTS_KEY, id],
    queryFn: async () => (await apiFetch<Project>(`/api/v1/projects/${id}`)).data,
    enabled: Boolean(id),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) =>
      apiFetchJson<Project>("/api/v1/projects", "POST", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useUpdateProject(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProjectInput) =>
      apiFetchJson<Project>(`/api/v1/projects/${id}`, "PATCH", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}

export function useArchiveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetchJson<{ id: string; archived: true }>(`/api/v1/projects/${id}`, "DELETE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PROJECTS_KEY }),
  });
}
