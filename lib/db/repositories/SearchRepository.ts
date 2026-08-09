import type { Knowledge } from "@/generated/prisma/client";
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

/** Document 4 §11 — a full-text match combined with the two non-semantic
 * ranking signals that were never wired up: "Active project" and
 * "Recency." (Document 13 §27, Amendment 25 — Phase 6, corrected scope). */
export type RankedKnowledge = Knowledge & { rank: number };

export interface ContextSearchParams {
  query: string;
  /** When set, same-project Knowledge is boosted (Doc 4 §11 priority: Active Project). */
  projectId?: string;
  limit: number;
}

// Interface `SearchService`/`RepositoryContextRetriever` depend on
// (Document 7 §8) — lets unit tests substitute a fake without touching
// Prisma or raw SQL.
export interface SearchRepositoryLike {
  searchKnowledge(params: SearchParams): Promise<SearchResult<KnowledgeSearchResult>>;
  searchKnowledgeForContext(params: ContextSearchParams): Promise<RankedKnowledge[]>;
}

const DEFAULT_PAGE_SIZE = 20;

// Document 4 §11 ranking weights — deliberately small relative to a
// typical `ts_rank` match score, so full-text relevance stays the
// dominant signal and these only break ties/nudge ordering, not override
// it. Kept in one place so the reasoning is auditable, not scattered
// through the SQL.
const PROJECT_AFFINITY_BOOST = 0.3;
const RECENCY_BOOST_MAX = 0.1;
const RECENCY_DECAY_DAYS = 90;

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

  /**
   * Document 4 §11 (Knowledge Retrieval Strategy) / Document 13 §27
   * (Amendment 25, Phase 6 corrected scope) — used only by
   * `ai/context/ContextRetriever`'s "Related Knowledge" priority, never by
   * `SearchService`/the Search page (which keeps using `searchKnowledge`,
   * untouched). Selects full `Knowledge` rows directly (title, markdown,
   * category, etc.) in the same query as the ranking, instead of the
   * previous pattern of running this search and then issuing one
   * `findById` per result — that N+1 was a real "retrieval performance"
   * cost for a step that runs on every AI request.
   *
   * Ranking combines full-text relevance with two of Document 4 §11's
   * non-semantic signals that were never implemented: "Active Project"
   * (a same-project match is boosted) and "Recency" (a linear decay to
   * zero over `RECENCY_DECAY_DAYS`). "Tags" and "Explicit references" are
   * the strategy's other two signals — explicit references are handled
   * separately (the caller's `knowledgeIds`, not this method), and Tags
   * has no query surface yet to rank by. "Semantic similarity" remains
   * explicitly out of MVP scope (Document 9 Phase 9).
   */
  async searchKnowledgeForContext(params: ContextSearchParams): Promise<RankedKnowledge[]> {
    const { query, limit } = params;
    const projectId = params.projectId ?? null;

    return this.client.$queryRaw<RankedKnowledge[]>`
      SELECT
        id,
        title,
        summary,
        markdown,
        "projectId",
        category,
        confidence,
        status,
        "createdAt",
        "updatedAt",
        "archivedAt",
        (
          ts_rank("searchVector", websearch_to_tsquery('english', ${query}))
          + CASE WHEN "projectId" = ${projectId} THEN ${PROJECT_AFFINITY_BOOST}::float8 ELSE 0.0 END
          + GREATEST(
              0.0,
              ${RECENCY_BOOST_MAX}::float8 - (EXTRACT(EPOCH FROM (now() - "updatedAt")) / 86400.0 / ${RECENCY_DECAY_DAYS}::float8) * ${RECENCY_BOOST_MAX}::float8
            )
        ) AS rank
      FROM knowledge
      WHERE "archivedAt" IS NULL
        AND "searchVector" @@ websearch_to_tsquery('english', ${query})
      ORDER BY rank DESC
      LIMIT ${limit}
    `;
  }
}
