"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PROJECT_PRIORITIES, PROJECT_STATUSES, PROJECT_VISIBILITIES } from "@/constants/statuses";
import { createProjectSchema } from "@/features/projects/schemas/ProjectSchema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { RequiredMark } from "@/components/ui/required-mark";
import { Spinner } from "@/components/feedback/Spinner";

// `createProjectSchema` covers both create and edit — `updateProjectSchema`
// is just its `.partial()`, and a form always submits every field it shows,
// so validating against the stricter (non-partial) shape here also catches
// a user clearing a required field before it ever reaches the API.
const projectFormSchema = createProjectSchema;
export type ProjectFormValues = z.infer<typeof projectFormSchema>;

export function ProjectForm({
  defaultValues,
  onSubmit,
  isSubmitting,
  submitLabel,
}: {
  defaultValues?: Partial<ProjectFormValues>;
  onSubmit: (values: ProjectFormValues) => void;
  isSubmitting: boolean;
  submitLabel: string;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "ACTIVE",
      priority: "MEDIUM",
      visibility: "PRIVATE",
      ...defaultValues,
    },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      <p className="text-xs text-muted-foreground">
        Fields marked <span className="text-destructive">*</span> are required.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="project-name">
          Name
          <RequiredMark />
        </Label>
        <Input
          id="project-name"
          {...register("name")}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? "project-name-error" : undefined}
          autoFocus
        />
        {errors.name ? (
          <p id="project-name-error" role="alert" className="text-sm text-destructive">
            {errors.name.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="project-description">Description</Label>
        <Textarea id="project-description" {...register("description")} rows={3} />
        {errors.description ? (
          <p role="alert" className="text-sm text-destructive">
            {errors.description.message}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-status">Status</Label>
          <Select id="project-status" {...register("status")}>
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-priority">Priority</Label>
          <Select id="project-priority" {...register("priority")}>
            {PROJECT_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="project-visibility">Visibility</Label>
          <Select id="project-visibility" {...register("visibility")}>
            {PROJECT_VISIBILITIES.map((visibility) => (
              <option key={visibility} value={visibility}>
                {visibility}
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
