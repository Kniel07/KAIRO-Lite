import { z } from "zod";
import { DOCUMENT_TYPES, NOTE_SOURCES, NOTE_TYPES } from "@/constants/statuses";

// Document 7 §11. Document 10 §5.3 — field constraints.
export const createNoteSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(300),
  content: z.string().min(1, "content is required"),
  projectId: z.string().uuid().optional(),
  noteType: z.enum(NOTE_TYPES).optional(),
  source: z.enum(NOTE_SOURCES).optional(),
});
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = createNoteSchema.partial();
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

// Document 8 §11 — Notes API "Convert to Knowledge" / "Convert to Document".
export const convertNoteToKnowledgeSchema = z.object({
  category: z.string().trim().min(1, "category is required").max(100),
  confidence: z.number().min(0).max(1).optional(),
});
export type ConvertNoteToKnowledgeInput = z.infer<typeof convertNoteToKnowledgeSchema>;

export const convertNoteToDocumentSchema = z.object({
  // Document.projectId is required (Document 10 §5.5), unlike Note's
  // optional one — if the source Note has no projectId, the caller must
  // supply one explicitly, or the Service rejects the conversion.
  projectId: z.string().uuid().optional(),
  type: z.enum(DOCUMENT_TYPES).optional(),
});
export type ConvertNoteToDocumentInput = z.infer<typeof convertNoteToDocumentSchema>;
