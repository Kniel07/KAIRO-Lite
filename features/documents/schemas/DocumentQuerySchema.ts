import { z } from "zod";
import { paginationQuerySchema } from "@/features/shared/schemas/pagination";

// Document 7 §11 — query-param validation for `GET /api/v1/documents`.
// `projectId` is required here (unlike Knowledge's query schema) because
// `DocumentService` has no unscoped `list` — `Document.projectId` is
// required (Document 10 §5.5), so every listing must be project-scoped
// (see `DocumentService`'s header comment for why).
export const documentQuerySchema = paginationQuerySchema.extend({
  projectId: z.string().uuid("projectId is required"),
});
export type DocumentQuery = z.infer<typeof documentQuerySchema>;
