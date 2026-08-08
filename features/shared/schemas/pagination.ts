import { z } from "zod";

// Document 7 §11 — "All requests are validated using Zod... occurs before
// Services are called," applies to query params too, not only bodies.
// Document 8 §16 — pagination standard (`?page=1&pageSize=20`).
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
