"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { NOTE_SOURCES, NOTE_TYPES } from "@/constants/statuses";
import { createNoteSchema } from "@/features/notes/schemas/NoteSchema";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { EMPTY_TO_UNDEFINED } from "@/lib/validation/select-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { RequiredMark } from "@/components/ui/required-mark";
import { Spinner } from "@/components/feedback/Spinner";

const noteFormSchema = createNoteSchema;
export type NoteFormValues = z.infer<typeof noteFormSchema>;

export function NoteForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel,
}: {
  defaultValues?: Partial<NoteFormValues>;
  onSubmit: (values: NoteFormValues) => void;
  isSubmitting: boolean;
  submitLabel: string;
}) {
  const projects = useProjects();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      title: "",
      content: "",
      noteType: "IDEA",
      source: "MANUAL",
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <p className="text-xs text-muted-foreground">
        Fields marked <span className="text-destructive">*</span> are required.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note-title">
          Title
          <RequiredMark />
        </Label>
        <Input
          id="note-title"
          {...register("title")}
          aria-invalid={Boolean(errors.title)}
          autoFocus
        />
        {errors.title ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note-content">
          Content
          <RequiredMark />
        </Label>
        <Textarea
          id="note-content"
          {...register("content")}
          rows={6}
          aria-invalid={Boolean(errors.content)}
        />
        {errors.content ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.content.message}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note-type">Type</Label>
          <Select id="note-type" {...register("noteType")}>
            {NOTE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note-source">Source</Label>
          <Select id="note-source" {...register("source")}>
            {NOTE_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="note-project">Project</Label>
          <Select
            id="note-project"
            {...register("projectId", { setValueAs: EMPTY_TO_UNDEFINED })}
            disabled={projects.isPending}
          >
            <option value="">None</option>
            {projects.data?.items.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={isSubmitting} className="mt-2 self-end">
        {isSubmitting ? <Spinner label="Saving" className="mr-2" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}
