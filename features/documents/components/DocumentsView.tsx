"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Archive, Pencil, Eye, EyeOff } from "lucide-react";
import { useProjects } from "@/features/projects/hooks/useProjects";
import {
  useArchiveDocument,
  useCreateDocument,
  useDocuments,
  useSetDocumentPublished,
  useUpdateDocument,
} from "@/features/documents/hooks/useDocuments";
import {
  DocumentEditForm,
  DocumentForm,
  type DocumentEditFormValues,
  type DocumentFormValues,
} from "@/features/documents/components/DocumentForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
import type { KairoDocument } from "@/types/database";

function EditDocumentDialog({
  document,
  open,
  onOpenChange,
}: {
  document: KairoDocument;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateDocument = useUpdateDocument(document.id);

  function handleSubmit(values: DocumentEditFormValues) {
    updateDocument.mutate(values, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-2xl">
      <DialogContent>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Edit Document</DialogTitle>
        </DialogHeader>
        <DocumentEditForm
          defaultValues={{
            title: document.title,
            markdown: document.markdown,
            type: document.type,
          }}
          onSubmit={handleSubmit}
          isSubmitting={updateDocument.isPending}
          submitLabel="Save Changes"
        />
        {updateDocument.isError ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {updateDocument.error.message}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function DocumentsView() {
  const projects = useProjects();
  const searchParams = useSearchParams();
  // UX correction (Pre-Phase-5 Review, Priority 5): arriving from a
  // Project's cross-navigation link preselects that project instead of
  // defaulting to the first one in the list.
  const [projectId, setProjectId] = useState<string>(() => searchParams.get("projectId") ?? "");

  useEffect(() => {
    const firstProject = projects.data?.items[0];
    if (!projectId && firstProject) {
      setProjectId(firstProject.id);
    }
  }, [projectId, projects.data]);

  const documents = useDocuments(projectId || undefined);
  const createDocument = useCreateDocument();
  const archiveDocument = useArchiveDocument();
  const setPublished = useSetDocumentPublished();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDocument, setEditingDocument] = useState<KairoDocument | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; title: string } | null>(null);

  function handleCreate(values: DocumentFormValues) {
    createDocument.mutate(values, { onSuccess: () => setIsCreateOpen(false) });
  }

  function handleArchive(id: string, title: string) {
    setArchiveTarget({ id, title });
  }

  function confirmArchive() {
    if (!archiveTarget) return;
    archiveDocument.mutate(archiveTarget.id, { onSuccess: () => setArchiveTarget(null) });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="text-sm text-muted-foreground">
            Formal, versioned Markdown documents, scoped to a project.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} disabled={!projectId}>
          <Plus className="mr-2 h-4 w-4" />
          New Document
        </Button>
      </div>

      {projects.isPending ? (
        <Skeleton className="h-9 w-64" />
      ) : projects.data && projects.data.items.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Documents belong to a project. Create a project first."
          action={
            <Link href={ROUTES.projects} className="text-sm font-medium underline">
              Go to Projects
            </Link>
          }
        />
      ) : (
        <div className="flex max-w-xs flex-col gap-1.5">
          <Label htmlFor="document-project-filter">Project</Label>
          <Select
            id="document-project-filter"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
          >
            {projects.data?.items.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {projectId ? (
        documents.isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : documents.isError ? (
          <ErrorState message="Couldn't load documents." onRetry={() => void documents.refetch()} />
        ) : documents.data.items.length === 0 ? (
          <EmptyState
            title="No documents in this project yet"
            description="Create your first document, or convert a Note into one from the Notes page."
            action={
              <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Document
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Title
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Version
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents.data.items.map((document) => (
                  <tr key={document.id} className="hover:bg-accent/30">
                    <td className="max-w-xs truncate px-4 py-3 font-medium">{document.title}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{document.type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">v{document.version}</td>
                    <td className="px-4 py-3">
                      <Badge variant={document.published ? "default" : "secondary"}>
                        {document.published ? "Published" : "Draft"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Edit ${document.title}`}
                          onClick={() => setEditingDocument(document)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={
                            document.published
                              ? `Unpublish ${document.title}`
                              : `Publish ${document.title}`
                          }
                          onClick={() =>
                            setPublished.mutate({ id: document.id, published: !document.published })
                          }
                        >
                          {document.published ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Archive ${document.title}`}
                          onClick={() => handleArchive(document.id, document.title)}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : null}

      {documents.data ? (
        <TruncationNotice
          shown={documents.data.items.length}
          total={documents.data.meta?.total ?? documents.data.items.length}
        />
      ) : null}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen} className="max-w-2xl">
        <DialogContent>
          <DialogCloseButton onClick={() => setIsCreateOpen(false)} />
          <DialogHeader>
            <DialogTitle>New Document</DialogTitle>
          </DialogHeader>
          <DocumentForm
            lockedProjectId={projectId}
            onSubmit={handleCreate}
            isSubmitting={createDocument.isPending}
            submitLabel="Create Document"
          />
          {createDocument.isError ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {createDocument.error.message}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      {editingDocument ? (
        <EditDocumentDialog
          document={editingDocument}
          open={Boolean(editingDocument)}
          onOpenChange={(open) => !open && setEditingDocument(null)}
        />
      ) : null}

      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={`Archive "${archiveTarget?.title}"?`}
        confirmLabel="Archive"
        onConfirm={confirmArchive}
        isConfirming={archiveDocument.isPending}
      />
    </div>
  );
}
