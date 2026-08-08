import type { ApiMeta } from "@/types/api";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

// Document 8 §16 — every list endpoint's `meta` is built the same way from
// a Repository-shaped `{ items, total }` result and the request's
// pagination query, so this is the one place that arithmetic lives.
export function toPaginationMeta(
  total: number,
  query: { page?: number; pageSize?: number },
): ApiMeta {
  const page = query.page ?? DEFAULT_PAGE;
  const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
  return {
    page,
    pageSize,
    total,
    hasNext: page * pageSize < total,
  };
}
