import {
  SearchRepository,
  type KnowledgeSearchResult,
  type SearchRepositoryLike,
  type SearchResult,
} from "@/lib/db/repositories/SearchRepository";
import { searchQuerySchema } from "@/features/search/schemas/SearchSchema";
import { parseOrThrow } from "@/lib/validation";
import type { ServiceContext } from "@/features/shared/types/Service";

// Document 7 §7-8, Document 13 §2 (Amendment 1), Document 13 §20 (Phase 3)
// — SearchService is the foundation-only search Service the Phase 3 scope
// calls for: full-text search via `SearchRepositoryLike`, no semantic
// search, no embeddings, no vector search (all explicitly out of scope —
// AI Orchestrator territory, later phases).
//
// A pure read path — no `AuditLogRepository` dependency, matching every
// other Service's `get`/`list` methods (Document 7 §7's audit requirement
// is for business-transaction writes, not reads).
export class SearchService {
  constructor(private readonly searchRepository: SearchRepositoryLike = new SearchRepository()) {}

  /**
   * Document 11 §2 — single-user MVP; results already exclude archived
   * rows (`SearchRepository` applies `archivedAt IS NULL` by hand, since
   * raw SQL bypasses the soft-delete Prisma extension — Document 7 §8), so
   * there is no per-user scoping to apply here. `context` is still
   * accepted, for the same calling convention every other Service uses
   * (Document 11 §7) and so per-user scoping can be added later without a
   * signature change.
   */
  async searchKnowledge(
    context: ServiceContext,
    rawInput: unknown,
  ): Promise<SearchResult<KnowledgeSearchResult>> {
    void context;
    const input = parseOrThrow(searchQuerySchema, rawInput);
    return this.searchRepository.searchKnowledge({
      query: input.query,
      page: input.page,
      pageSize: input.pageSize,
    });
  }
}
