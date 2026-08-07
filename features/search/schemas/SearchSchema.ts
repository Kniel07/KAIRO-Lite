import { z } from "zod";

// Document 7 §11. Document 8 §13 — Search API request shape.
export const searchQuerySchema = z.object({
  query: z.string().trim().min(1, "query is required").max(500),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
