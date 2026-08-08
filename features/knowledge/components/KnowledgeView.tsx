"use client";

import { useState } from "react";
import { Plus, Archive, Pencil } from "lucide-react";
import {
  useArchiveKnowledge,
  useCreateKnowledge,
  useKnowledgeList,
  useUpdateKnowledge,
} from "@/features/knowledge/hooks/useKnowledge";
import {
  KnowledgeForm,
  type KnowledgeFormValues,
} from "@/features/knowledge/components/KnowledgeForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/feedback/EmptyState";
import { ErrorState } from "@/components/feedback/ErrorState";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Knowledge } from "@/types/database";

function EditKnowledgeDialog({
  knowledge,
  open,
  onOpenChange,
}: {
  knowledge: Knowledge;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateKnowledge = useUpdateKnowledge(knowledge.id);

  function handleSubmit(values: KnowledgeFormValues) {
    updateKnowledge.mutate(values, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-2xl">
      <DialogContent>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Edit Knowledge</DialogTitle>
        </DialogHeader>
        <KnowledgeForm
          defaultValues={{
            title: knowledge.title,
            summary: knowledge.summary ?? "",
            markdown: knowledge.markdown,
            category: knowledge.category,
            status: knowledge.status,
            confidence: knowledge.confidence,
            projectId: knowledge.projectId ?? undefined,
          }}
          onSubmit={handleSubmit}
          isSubmitting={updateKnowledge.isPending}
          submitLabel="Save Changes"
        />
        {updateKnowledge.isError ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {updateKnowledge.error.message}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function KnowledgeView() {
  const knowledge = useKnowledgeList();
  const createKnowledge = useCreateKnowledge();
  const archiveKnowledge = useArchiveKnowledge();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState<Knowledge | null>(null);

  function handleCreate(values: KnowledgeFormValues) {
    createKnowledge.mutate(values, { onSuccess: () => setIsCreateOpen(false) });
  }

  function handleArchive(id: string, title: string) {
    if (!window.confirm(`Archive "${title}"?`)) return;
    archiveKnowledge.mutate(id);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Knowledge</h1>
          <p className="text-sm text-muted-foreground">Your validated, reusable knowledge base.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Knowledge
        </Button>
      </div>

      {knowledge.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : knowledge.isError ? (
        <ErrorState message="Couldn't load knowledge." onRetry={() => void knowledge.refetch()} />
      ) : knowledge.data.items.length === 0 ? (
        <EmptyState
          title="No knowledge yet"
          description="Add your first entry, or convert an existing Note into Knowledge from the Notes page."
          action={
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Knowledge
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
                  Category
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  Confidence
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {knowledge.data.items.map((item) => (
                <tr key={item.id} className="hover:bg-accent/30">
                  <td className="max-w-xs truncate px-4 py-3 font-medium">{item.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.category}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{item.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {Math.round(item.confidence * 100)}%
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${item.title}`}
                        onClick={() => setEditingKnowledge(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Archive ${item.title}`}
                        onClick={() => handleArchive(item.id, item.title)}
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
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen} className="max-w-2xl">
        <DialogContent>
          <DialogCloseButton onClick={() => setIsCreateOpen(false)} />
          <DialogHeader>
            <DialogTitle>New Knowledge</DialogTitle>
          </DialogHeader>
          <KnowledgeForm
            onSubmit={handleCreate}
            isSubmitting={createKnowledge.isPending}
            submitLabel="Create Knowledge"
          />
          {createKnowledge.isError ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {createKnowledge.error.message}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      {editingKnowledge ? (
        <EditKnowledgeDialog
          knowledge={editingKnowledge}
          open={Boolean(editingKnowledge)}
          onOpenChange={(open) => !open && setEditingKnowledge(null)}
        />
      ) : null}
    </div>
  );
}
