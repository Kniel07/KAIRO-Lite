import { prisma, type Db } from "@/lib/db/client";

// Document 13 §2 (Amendment 1) — MVP full-text search only, no semantic
// search. Document 10 §8 — reads the `searchVector` GIN-indexed generated
// column added by raw SQL in the Phase 2 migration (not declared in
// `schema.prisma` — Prisma has no native tsvector support).
//
// Document 7 §8's raw-SQL rule applies directly here: this repository
// bypasses the soft-delete Prisma Client Extension entirely ($queryRaw
// isn't intercepted by it), so `"archivedAt" IS NULL` is applied by hand
// in every query below. This is the first place that documented rule is
// actually exercised, not just written down.
//
// Cross-cutting (not owned by a single feature), lives in
// `lib/db/repositories/` per Document 13 §3.

export interface KnowledgeSearchResult {
  id: string;
  title: string;
  summary: string | null;
  rank: number;
}

export interface SearchParams {
  query: string;
  page?: number;
  pageSize?: number;
}

export interface SearchResult<T> {
  items: T[];
  total: number;
}

// Interface `SearchService` depends on (Document 7 §8) — lets unit tests
// substitute a fake without touching Prisma or raw SQL.
export interface SearchRepositoryLike {
  searchKnowledge(params: SearchParams): Promise<SearchResult<KnowledgeSearchResult>>;
}

const DEFAULT_PAGE_SIZE = 20;

export class SearchRepository implements SearchRepositoryLike {
  constructor(private readonly client: Db = prisma) {}

  async searchKnowledge(params: SearchParams): Promise<SearchResult<KnowledgeSearchResult>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * pageSize;
    const { query } = params;

    // `websearch_to_tsquery` (not `to_tsquery`) is deliberate: it accepts
    // arbitrary user search-box text (quotes, "-exclude", "or") without
    // ever throwing on malformed syntax, unlike `to_tsquery`.
    const items = await this.client.$queryRaw<KnowledgeSearchResult[]>`
      SELECT
        id,
        title,
        summary,
        ts_rank("searchVector", websearch_to_tsquery('english', ${query})) AS rank
      FROM knowledge
      WHERE "archivedAt" IS NULL
        AND "searchVector" @@ websearch_to_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${pageSize} OFFSET ${skip}
    `;

    const countRows = await this.client.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count
      FROM knowledge
      WHERE "archivedAt" IS NULL
        AND "searchVector" @@ websearch_to_tsquery('english', ${query})
    `;

    return { items, total: Number(countRows[0]?.count ?? 0) };
  }
}
