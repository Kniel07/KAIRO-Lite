"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Archive } from "lucide-react";
import {
  useArchiveProject,
  useCreateProject,
  useProjects,
} from "@/features/projects/hooks/useProjects";
import { ProjectForm, type ProjectFormValues } from "@/features/projects/components/ProjectForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import { TruncationNotice } from "@/components/feedback/TruncationNotice";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ROUTES } from "@/constants/routes";

// Document 9 Phase 4 — Projects: list (table), create (dialog + form),
// archive. Editing happens on the detail page (`/projects/[id]`).
export function ProjectsView() {
  const projects = useProjects();
  const createProject = useCreateProject();
  const archiveProject = useArchiveProject();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; name: string } | null>(null);

  function handleCreate(values: ProjectFormValues) {
    createProject.mutate(values, {
      onSuccess: () => setIsCreateOpen(false),
    });
  }

  function handleArchive(id: string, name: string) {
    setArchiveTarget({ id, name });
  }

  function confirmArchive() {
    if (!archiveTarget) return;
    archiveProject.mutate(archiveTarget.id, { onSuccess: () => setArchiveTarget(null) });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Organize your knowledge, notes, and documents.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {projects.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : projects.isError ? (
        <ErrorState message="Couldn't load projects." onRetry={() => void projects.refetch()} />
      ) : projects.data.items.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create your first project to start organizing your work."
          action={
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">
                  Name
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Priority
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Visibility
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projects.data.items.map((project) => (
                <tr key={project.id} className="hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`${ROUTES.projects}/${project.id}`}
                      className="font-medium hover:underline"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{project.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{project.priority}</td>
                  <td className="px-4 py-3 text-muted-foreground">{project.visibility}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Archive ${project.name}`}
                      onClick={() => handleArchive(project.id, project.name)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {projects.data ? (
        <TruncationNotice
          shown={projects.data.items.length}
          total={projects.data.meta?.total ?? projects.data.items.length}
        />
      ) : null}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogCloseButton onClick={() => setIsCreateOpen(false)} />
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <ProjectForm
            onSubmit={handleCreate}
            isSubmitting={createProject.isPending}
            submitLabel="Create Project"
          />
          {createProject.isError ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {createProject.error.message}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={`Archive "${archiveTarget?.name}"?`}
        description="You can find it later via the database, but there's no restore view yet."
        confirmLabel="Archive"
        onConfirm={confirmArchive}
        isConfirming={archiveProject.isPending}
      />
    </div>
  );
}
