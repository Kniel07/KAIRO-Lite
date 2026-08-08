"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useConvertNoteToDocument } from "@/features/notes/hooks/useNotes";
import {
  convertNoteToDocumentSchema,
  type ConvertNoteToDocumentInput,
} from "@/features/notes/schemas/NoteSchema";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { EMPTY_TO_UNDEFINED } from "@/lib/validation/select-helpers";
import { DOCUMENT_TYPES } from "@/constants/statuses";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/feedback/Spinner";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROUTES } from "@/constants/routes";

// Document 8 §11 — Notes API "Convert to Document." `projectId` is
// optional here only because the source Note might already have one
// (`NotesService.convertToDocument` falls back to it); if the Note has no
// project, the Service rejects a missing selection, so the option list
// still needs to be usable.
export function ConvertToDocumentDialog({
  noteId,
  open,
  onOpenChange,
}: {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const projects = useProjects();
  const convert = useConvertNoteToDocument();
  const { register, handleSubmit, reset } = useForm<ConvertNoteToDocumentInput>({
    resolver: zodResolver(convertNoteToDocumentSchema),
    defaultValues: { type: "GUIDE" },
  });

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function onSubmit(values: ConvertNoteToDocumentInput) {
    convert.mutate(
      { id: noteId, input: values },
      {
        onSuccess: () => {
          handleClose(false);
          router.push(ROUTES.documents);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogCloseButton onClick={() => handleClose(false)} />
        <DialogHeader>
          <DialogTitle>Convert to Document</DialogTitle>
          <DialogDescription>
            The note&apos;s title and content carry over. Documents require a project — select one
            if the note isn&apos;t already attached to one.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="convert-doc-project">Project</Label>
            <Select
              id="convert-doc-project"
              {...register("projectId", { setValueAs: EMPTY_TO_UNDEFINED })}
              disabled={projects.isPending}
              autoFocus
            >
              <option value="">Use the note&apos;s existing project</option>
              {projects.data?.items.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="convert-doc-type">Type</Label>
            <Select id="convert-doc-type" {...register("type")}>
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" disabled={convert.isPending} className="self-end">
            {convert.isPending ? <Spinner label="Converting" className="mr-2" /> : null}
            Convert
          </Button>
          {convert.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {convert.error.message}
            </p>
          ) : null}
        </form>
      </DialogContent>
    </Dialog>
  );
}
