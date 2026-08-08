"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useConvertNoteToKnowledge } from "@/features/notes/hooks/useNotes";
import {
  convertNoteToKnowledgeSchema,
  type ConvertNoteToKnowledgeInput,
} from "@/features/notes/schemas/NoteSchema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

// Document 8 §11 — Notes API "Convert to Knowledge." Category is the one
// required input `KnowledgeService.create` needs beyond what the Note
// already has (title/content carry over — see `NotesService.convertToKnowledge`).
export function ConvertToKnowledgeDialog({
  noteId,
  open,
  onOpenChange,
}: {
  noteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const convert = useConvertNoteToKnowledge();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ConvertNoteToKnowledgeInput>({
    resolver: zodResolver(convertNoteToKnowledgeSchema),
    defaultValues: { category: "" },
  });

  function handleClose(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function onSubmit(values: ConvertNoteToKnowledgeInput) {
    convert.mutate(
      { id: noteId, input: values },
      {
        onSuccess: () => {
          handleClose(false);
          router.push(ROUTES.knowledge);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogCloseButton onClick={() => handleClose(false)} />
        <DialogHeader>
          <DialogTitle>Convert to Knowledge</DialogTitle>
          <DialogDescription>
            The note&apos;s title and content carry over. Choose a category for the new Knowledge
            entry.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="convert-category">Category</Label>
            <Input
              id="convert-category"
              {...register("category")}
              autoFocus
              placeholder="e.g. engineering"
            />
            {errors.category ? (
              <p role="alert" className="text-sm text-destructive">
                {errors.category.message}
              </p>
            ) : null}
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
