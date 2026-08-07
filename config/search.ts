// Document 8 §13 / Document 10 §8 — MVP search configuration. Full-text
// search only (Document 13 §2, Amendment 1); semantic search is Phase 6+.
//
// TODO(Document 3 §11, Phase 6): extend with vector/embedding config once
// semantic search is implemented.

export const searchConfig = {
  strategy: "full-text",
  defaultPageSize: 20,
} as const;
