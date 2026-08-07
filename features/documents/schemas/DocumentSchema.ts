import { z } from "zod";
import { DOCUMENT_TYPES } from "@/constants/statuses";

// Document 7 §11. Document 10 §5.5 — field constraints. `projectId` is
// required (unlike Knowledge's optional one) — Documents have no "global"
// tier (Document 10 §5.5).
export const createDocumentSchema = z.object({
  title: z.string().trim().min(1, "title is required").max(300),
  projectId: z.string().uuid("projectId is required"),
  markdown: z.string().min(1, "markdown is required"),
  type: z.enum(DOCUMENT_TYPES).optional(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

export const updateDocumentSchema = createDocumentSchema.omit({ projectId: true }).partial();
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
