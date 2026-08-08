"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, apiFetchJson } from "@/lib/utils/api-client";
import type { Settings } from "@/types/database";
import type { UpdateSettingsInput } from "@/features/settings/schemas/SettingsSchema";

const SETTINGS_KEY = ["settings"] as const;

export function useSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: async () => (await apiFetch<Settings>("/api/v1/settings")).data,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSettingsInput) =>
      apiFetchJson<Settings>("/api/v1/settings", "PATCH", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  });
}
