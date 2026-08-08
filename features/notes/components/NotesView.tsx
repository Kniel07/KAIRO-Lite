"use client";

import { useState } from "react";
import { Plus, Archive, Pencil, Sparkles, FileOutput } from "lucide-react";
import {
  useArchiveNote,
  useCreateNote,
  useNotes,
  useUpdateNote,
} from "@/features/notes/hooks/useNotes";
import { NoteForm, type NoteFormValues } from "@/features/notes/components/NoteForm";
import { ConvertToKnowledgeDialog } from "@/features/notes/components/ConvertToKnowledgeDialog";
import { ConvertToDocumentDialog } from "@/features/notes/components/ConvertToDocumentDialog";
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
import type { Note } from "@/types/database";

function EditNoteDialog({
  note,
  open,
  onOpenChange,
}: {
  note: Note;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const updateNote = useUpdateNote(note.id);

  function handleSubmit(values: NoteFormValues) {
    updateNote.mutate(values, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogCloseButton onClick={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle>Edit Note</DialogTitle>
        </DialogHeader>
        <NoteForm
          defaultValues={{
            title: note.title,
            content: note.content,
            noteType: note.noteType,
            source: note.source,
            projectId: note.projectId ?? undefined,
          }}
          onSubmit={handleSubmit}
          isSubmitting={updateNote.isPending}
          submitLabel="Save Changes"
        />
        {updateNote.isError ? (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {updateNote.error.message}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function NotesView() {
  const notes = useNotes();
  const createNote = useCreateNote();
  const archiveNote = useArchiveNote();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [convertToKnowledgeId, setConvertToKnowledgeId] = useState<string | null>(null);
  const [convertToDocumentId, setConvertToDocumentId] = useState<string | null>(null);

  function handleCreate(values: NoteFormValues) {
    createNote.mutate(values, { onSuccess: () => setIsCreateOpen(false) });
  }

  function handleArchive(id: string, title: string) {
    if (!window.confirm(`Archive "${title}"?`)) return;
    archiveNote.mutate(id);
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notes</h1>
          <p className="text-sm text-muted-foreground">
            Quick capture — convert a note into Knowledge or a Document once it&apos;s ready.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Note
        </Button>
      </div>

      {notes.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : notes.isError ? (
        <ErrorState message="Couldn't load notes." onRetry={() => void notes.refetch()} />
      ) : notes.data.items.length === 0 ? (
        <EmptyState
          title="No notes yet"
          description="Capture a quick idea, reference, or journal entry — convert it into Knowledge or a Document later."
          action={
            <Button size="sm" onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Note
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
                  Source
                </th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {notes.data.items.map((note) => (
                <tr key={note.id} className="hover:bg-accent/30">
                  <td className="max-w-xs truncate px-4 py-3 font-medium">{note.title}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{note.noteType}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{note.source}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${note.title}`}
                        onClick={() => setEditingNote(note)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Convert ${note.title} to Knowledge`}
                        onClick={() => setConvertToKnowledgeId(note.id)}
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Convert ${note.title} to Document`}
                        onClick={() => setConvertToDocumentId(note.id)}
                      >
                        <FileOutput className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Archive ${note.title}`}
                        onClick={() => handleArchive(note.id, note.title)}
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogCloseButton onClick={() => setIsCreateOpen(false)} />
          <DialogHeader>
            <DialogTitle>New Note</DialogTitle>
          </DialogHeader>
          <NoteForm
            onSubmit={handleCreate}
            isSubmitting={createNote.isPending}
            submitLabel="Create Note"
          />
          {createNote.isError ? (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {createNote.error.message}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>

      {editingNote ? (
        <EditNoteDialog
          note={editingNote}
          open={Boolean(editingNote)}
          onOpenChange={(open) => !open && setEditingNote(null)}
        />
      ) : null}

      {convertToKnowledgeId ? (
        <ConvertToKnowledgeDialog
          noteId={convertToKnowledgeId}
          open={Boolean(convertToKnowledgeId)}
          onOpenChange={(open) => !open && setConvertToKnowledgeId(null)}
        />
      ) : null}

      {convertToDocumentId ? (
        <ConvertToDocumentDialog
          noteId={convertToDocumentId}
          open={Boolean(convertToDocumentId)}
          onOpenChange={(open) => !open && setConvertToDocumentId(null)}
        />
      ) : null}
    </div>
  );
}
