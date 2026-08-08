import { z } from "zod";
import { paginationQuerySchema } from "@/features/shared/schemas/pagination";

// Document 7 §11 — query-param validation for `GET /api/v1/knowledge`.
// `projectId` is optional here (unlike Documents' query schema) because
// `Knowledge.projectId` itself is optional (Document 10 §5.4) — an
// unscoped listing is a valid, meaningful request.
export const knowledgeQuerySchema = paginationQuerySchema.extend({
  projectId: z.string().uuid().optional(),
});
export type KnowledgeQuery = z.infer<typeof knowledgeQuerySchema>;
