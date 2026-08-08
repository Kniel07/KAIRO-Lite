"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Archive, StickyNote, BookOpen, FileText } from "lucide-react";
import {
  useArchiveProject,
  useProject,
  useUpdateProject,
} from "@/features/projects/hooks/useProjects";
import { ProjectForm, type ProjectFormValues } from "@/features/projects/components/ProjectForm";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/ErrorState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ROUTES } from "@/constants/routes";

export function ProjectDetailView({ id }: { id: string }) {
  const router = useRouter();
  const project = useProject(id);
  const updateProject = useUpdateProject(id);
  const archiveProject = useArchiveProject();
  const [isConfirmingArchive, setIsConfirmingArchive] = useState(false);

  function handleUpdate(values: ProjectFormValues) {
    updateProject.mutate(values);
  }

  function confirmArchive() {
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
            <Button variant="outline" size="sm" onClick={() => setIsConfirmingArchive(true)}>
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          </div>

          {/* UX correction (Pre-Phase-5 Review, Priority 5): a Project is
              the organizing entity for Notes, Knowledge, and Documents —
              this page previously had no way to reach any of them scoped
              to this project. */}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`${ROUTES.notes}?projectId=${project.data.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <StickyNote className="h-4 w-4" />
              Notes
            </Link>
            <Link
              href={`${ROUTES.knowledge}?projectId=${project.data.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <BookOpen className="h-4 w-4" />
              Knowledge
            </Link>
            <Link
              href={`${ROUTES.documents}?projectId=${project.data.id}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <FileText className="h-4 w-4" />
              Documents
            </Link>
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

      {project.data ? (
        <ConfirmDialog
          open={isConfirmingArchive}
          onOpenChange={setIsConfirmingArchive}
          title={`Archive "${project.data.name}"?`}
          confirmLabel="Archive"
          onConfirm={confirmArchive}
          isConfirming={archiveProject.isPending}
        />
      ) : null}
    </div>
  );
}
