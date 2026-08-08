"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiFetchJson } from "@/lib/utils/api-client";
import type { KairoDocument, Knowledge, Note } from "@/types/database";
import type {
  ConvertNoteToDocumentInput,
  ConvertNoteToKnowledgeInput,
  CreateNoteInput,
  UpdateNoteInput,
} from "@/features/notes/schemas/NoteSchema";

const NOTES_KEY = ["notes"] as const;

export function useNotes() {
  return useQuery({
    queryKey: NOTES_KEY,
    queryFn: async () => {
      const { data, meta } = await apiFetch<Note[]>("/api/v1/notes?pageSize=100");
      return { items: data, meta };
    },
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateNoteInput) => apiFetchJson<Note>("/api/v1/notes", "POST", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  });
}

export function useUpdateNote(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateNoteInput) =>
      apiFetchJson<Note>(`/api/v1/notes/${id}`, "PATCH", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  });
}

export function useArchiveNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetchJson<{ id: string; archived: true }>(`/api/v1/notes/${id}`, "DELETE"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: NOTES_KEY }),
  });
}

// Document 8 §11 — Notes API "Convert to Knowledge" / "Convert to Document."
export function useConvertNoteToKnowledge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConvertNoteToKnowledgeInput }) =>
      apiFetchJson<Knowledge>(`/api/v1/notes/${id}/convert-to-knowledge`, "POST", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTES_KEY });
      void queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    },
  });
}

export function useConvertNoteToDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ConvertNoteToDocumentInput }) =>
      apiFetchJson<KairoDocument>(`/api/v1/notes/${id}/convert-to-document`, "POST", input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: NOTES_KEY });
      void queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}
