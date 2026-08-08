"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTheme } from "next-themes";
import { THEMES } from "@/constants/themes";
import { useSettings, useUpdateSettings } from "@/features/settings/hooks/useSettings";
import {
  updateSettingsSchema,
  type UpdateSettingsInput,
} from "@/features/settings/schemas/SettingsSchema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/ErrorState";
import { Spinner } from "@/components/feedback/Spinner";

// Document 9 Phase 4 — Settings: a single form (Document 8 §15: theme, AI
// defaults, language, timezone). Saving also calls next-themes' `setTheme`
// so the UI updates immediately — the persisted `Settings.theme` row and
// next-themes' own `localStorage` value are two separate things that both
// need to agree (see `ThemeProvider`).
export function SettingsView() {
  const settings = useSettings();
  const updateSettings = useUpdateSettings();
  const { setTheme } = useTheme();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateSettingsInput>({
    resolver: zodResolver(updateSettingsSchema),
  });

  useEffect(() => {
    if (settings.data) {
      reset({
        theme: settings.data.theme,
        defaultModel: settings.data.defaultModel,
        aiTemperature: settings.data.aiTemperature,
        language: settings.data.language,
        timezone: settings.data.timezone,
      });
    }
  }, [settings.data, reset]);

  function onSubmit(values: UpdateSettingsInput) {
    updateSettings.mutate(values, {
      onSuccess: (saved) => setTheme(saved.theme.toLowerCase()),
    });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Preferences, theme, and AI defaults.</p>
      </div>

      <Card className="max-w-lg">
        <CardContent className="p-6">
          {settings.isPending ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : settings.isError ? (
            <ErrorState message="Couldn't load settings." onRetry={() => void settings.refetch()} />
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-theme">Theme</Label>
                <Select id="settings-theme" {...register("theme")}>
                  {THEMES.map((theme) => (
                    <option key={theme} value={theme}>
                      {theme}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-model">Default AI Model</Label>
                <Input id="settings-model" {...register("defaultModel")} />
                {errors.defaultModel ? (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.defaultModel.message}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="settings-temperature">AI Temperature (0–2)</Label>
                <Input
                  id="settings-temperature"
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  {...register("aiTemperature", { valueAsNumber: true })}
                />
                {errors.aiTemperature ? (
                  <p role="alert" className="text-sm text-destructive">
                    {errors.aiTemperature.message}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="settings-language">Language</Label>
                  <Input id="settings-language" {...register("language")} placeholder="en" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="settings-timezone">Timezone</Label>
                  <Input id="settings-timezone" {...register("timezone")} placeholder="UTC" />
                </div>
              </div>

              <Button type="submit" disabled={updateSettings.isPending} className="mt-2 self-end">
                {updateSettings.isPending ? <Spinner label="Saving" className="mr-2" /> : null}
                Save Settings
              </Button>
              {updateSettings.isSuccess ? (
                <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
                  Saved.
                </p>
              ) : null}
              {updateSettings.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {updateSettings.error.message}
                </p>
              ) : null}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
