"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KNOWLEDGE_STATUSES } from "@/constants/statuses";
import { createKnowledgeSchema } from "@/features/knowledge/schemas/KnowledgeSchema";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { EMPTY_TO_UNDEFINED } from "@/lib/validation/select-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MarkdownEditor } from "@/components/editors/MarkdownEditor";
import { Spinner } from "@/components/feedback/Spinner";

const knowledgeFormSchema = createKnowledgeSchema;
export type KnowledgeFormValues = z.infer<typeof knowledgeFormSchema>;

export function KnowledgeForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel,
}: {
  defaultValues?: Partial<KnowledgeFormValues>;
  onSubmit: (values: KnowledgeFormValues) => void;
  isSubmitting: boolean;
  submitLabel: string;
}) {
  const projects = useProjects();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<KnowledgeFormValues>({
    resolver: zodResolver(knowledgeFormSchema),
    defaultValues: {
      title: "",
      summary: "",
      markdown: "",
      category: "",
      status: "DRAFT",
      confidence: 0.5,
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="knowledge-title">Title</Label>
        <Input id="knowledge-title" {...register("title")} autoFocus />
        {errors.title ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.title.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="knowledge-summary">Summary</Label>
        <Textarea id="knowledge-summary" {...register("summary")} rows={2} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="knowledge-category">Category</Label>
          <Input id="knowledge-category" {...register("category")} placeholder="e.g. engineering" />
          {errors.category ? (
            <p role="alert" className="text-sm text-destructive">
              {errors.category.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="knowledge-status">Status</Label>
          <Select id="knowledge-status" {...register("status")}>
            {KNOWLEDGE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="knowledge-project">Project</Label>
          <Select
            id="knowledge-project"
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="knowledge-markdown">Content</Label>
        <Controller
          name="markdown"
          control={control}
          render={({ field }) => (
            <MarkdownEditor id="knowledge-markdown" value={field.value} onChange={field.onChange} />
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
