import { describe, expect, it, vi } from "vitest";
import type { SearchRepositoryLike } from "@/lib/db/repositories/SearchRepository";
import { ValidationError } from "@/lib/utils/errors";
import { SearchService } from "@/features/search/services/SearchService";

// Document 13 §20 (Phase 3) — SearchService is a pure read path (no
// transactional write, no `withTransaction` mock needed, unlike every
// other Phase 3 Service test file), so a plain constructor-injected fake
// is sufficient for full coverage.

const context = { userId: "user-1" };

describe("SearchService", () => {
  describe("searchKnowledge", () => {
    it("throws ValidationError on an empty query without calling the repository", async () => {
      const searchRepository: SearchRepositoryLike = {
        searchKnowledge: vi.fn(),
        searchKnowledgeForContext: vi.fn(),
      };
      const service = new SearchService(searchRepository);

      await expect(service.searchKnowledge(context, { query: "" })).rejects.toThrow(
        ValidationError,
      );
      expect(searchRepository.searchKnowledge).not.toHaveBeenCalled();
    });

    it("passes the validated query and pagination through to the repository", async () => {
      const searchRepository: SearchRepositoryLike = {
        searchKnowledge: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        searchKnowledgeForContext: vi.fn(),
      };
      const service = new SearchService(searchRepository);

      await service.searchKnowledge(context, { query: "auth flow", page: 2, pageSize: 10 });

      expect(searchRepository.searchKnowledge).toHaveBeenCalledWith({
        query: "auth flow",
        page: 2,
        pageSize: 10,
      });
    });

    it("returns the repository's result unchanged", async () => {
      const result = {
        items: [{ id: "knowledge-1", title: "Auth Flow", summary: null, rank: 0.5 }],
        total: 1,
      };
      const searchRepository: SearchRepositoryLike = {
        searchKnowledge: vi.fn().mockResolvedValue(result),
        searchKnowledgeForContext: vi.fn(),
      };
      const service = new SearchService(searchRepository);

      await expect(service.searchKnowledge(context, { query: "auth" })).resolves.toEqual(result);
    });
  });
});
