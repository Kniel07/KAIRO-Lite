"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Archive } from "lucide-react";
import {
  useArchiveProject,
  useProject,
  useUpdateProject,
} from "@/features/projects/hooks/useProjects";
import { ProjectForm, type ProjectFormValues } from "@/features/projects/components/ProjectForm";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ROUTES } from "@/constants/routes";

export function ProjectDetailView({ id }: { id: string }) {
  const router = useRouter();
  const project = useProject(id);
  const updateProject = useUpdateProject(id);
  const archiveProject = useArchiveProject();

  function handleUpdate(values: ProjectFormValues) {
    updateProject.mutate(values);
  }

  function handleArchive() {
    if (!project.data) return;
    if (!window.confirm(`Archive "${project.data.name}"?`)) return;
    archiveProject.mutate(id, { onSuccess: () => router.push(ROUTES.projects) });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <Link
        href={ROUTES.projects}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      {project.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full max-w-lg" />
        </div>
      ) : project.isError ? (
        <ErrorState message="Couldn't load this project." onRetry={() => void project.refetch()} />
      ) : (
        <div className="flex max-w-lg flex-col gap-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">{project.data.name}</h1>
            <Button variant="outline" size="sm" onClick={handleArchive}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          </div>

          <ProjectForm
            defaultValues={{
              name: project.data.name,
              description: project.data.description ?? "",
              status: project.data.status,
              priority: project.data.priority,
              visibility: project.data.visibility,
            }}
            onSubmit={handleUpdate}
            isSubmitting={updateProject.isPending}
            submitLabel="Save Changes"
          />
          {updateProject.isSuccess ? (
            <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
              Saved.
            </p>
          ) : null}
          {updateProject.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {updateProject.error.message}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
