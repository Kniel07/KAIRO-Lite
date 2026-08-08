"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { DOCUMENT_TYPES } from "@/constants/statuses";
import {
  createDocumentSchema,
  updateDocumentSchema,
} from "@/features/documents/schemas/DocumentSchema";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MarkdownEditor } from "@/components/editors/MarkdownEditor";
import { Spinner } from "@/components/feedback/Spinner";

// Split into two components, not one with a `mode` prop: `projectId` is
// required to create a Document (Document 10 §5.5) but doesn't exist at
// all in `updateDocumentSchema` (a Document's project never changes after
// creation — see `DocumentService`'s header comment). A single
// `useForm<T>` can't be typed against two different Zod schemas
// depending on a runtime prop, so this is two small, honestly-typed forms
// instead of one form fighting the type system.
export type DocumentFormValues = z.infer<typeof createDocumentSchema>;
export type DocumentEditFormValues = z.infer<typeof updateDocumentSchema>;

export function DocumentForm({
  lockedProjectId,
  onSubmit,
  isSubmitting,
  submitLabel,
}: {
  lockedProjectId?: string;
  onSubmit: (values: DocumentFormValues) => void;
  isSubmitting: boolean;
  submitLabel: string;
}) {
  const projects = useProjects();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DocumentFormValues>({
    resolver: zodResolver(createDocumentSchema),
    defaultValues: { title: "", markdown: "", type: "GUIDE", projectId: lockedProjectId ?? "" },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="document-title">Title</Label>
        <Input id="document-title" {...register("title")} autoFocus />
        {errors.title ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="document-project">Project</Label>
          <Select id="document-project" {...register("projectId")} disabled={projects.isPending}>
            {projects.data?.items.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
          {errors.projectId ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.projectId.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="document-type">Type</Label>
          <Select id="document-type" {...register("type")}>
            {DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="document-markdown">Content</Label>
        <Controller
          name="markdown"
          control={control}
          render={({ field }) => (
            <MarkdownEditor id="document-markdown" value={field.value} onChange={field.onChange} />
          )}
        />
        {errors.markdown ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.markdown.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={isSubmitting} className="mt-2 self-end">
        {isSubmitting ? <Spinner label="Saving" className="mr-2" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}

export function DocumentEditForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel,
}: {
  defaultValues: DocumentEditFormValues;
  onSubmit: (values: DocumentEditFormValues) => void;
  isSubmitting: boolean;
  submitLabel: string;
}) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DocumentEditFormValues>({
    resolver: zodResolver(updateDocumentSchema),
    defaultValues,
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="document-edit-title">Title</Label>
        <Input id="document-edit-title" {...register("title")} autoFocus />
        {errors.title ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="document-edit-type">Type</Label>
        <Select id="document-edit-type" {...register("type")}>
          {DOCUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="document-edit-markdown">Content</Label>
        <Controller
          name="markdown"
          control={control}
          render={({ field }) => (
            <MarkdownEditor
              id="document-edit-markdown"
              value={field.value ?? ""}
              onChange={field.onChange}
            />
          )}
        />
        {errors.markdown ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.markdown.message}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={isSubmitting} className="mt-2 self-end">
        {isSubmitting ? <Spinner label="Saving" className="mr-2" /> : null}
        {submitLabel}
      </Button>
    </form>
  );
}
