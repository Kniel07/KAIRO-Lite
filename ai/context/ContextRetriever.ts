// Document 4 §6 — Context Retrieval priority order (Active Project, Active
// Document, Related Knowledge, Previous Conversation, Global Knowledge,
// User Preferences). Document 13 §4 (Amendment 3) — this reads via the
// Repository layer directly, never via Feature Services, keeping `ai/` and
// `features/` dependency siblings (Document 5 §20).
//
// TODO(Document 10 §5; Phase 2 — Database): replace the `unknown` fields
// below with the real Project/Knowledge/Conversation/Settings types once
// those Prisma models exist.

export interface AssembledContext {
  project?: unknown;
  relatedKnowledge: unknown[];
  conversationHistory: unknown[];
  globalKnowledge: unknown[];
  userPreferences?: unknown;
}

export interface ContextRetrieverParams {
  /** Document 13 §4 — ownership scoping is applied here, independently of
   * a Feature Service's authorization logic. */
  userId: string;
  projectId?: string;
  conversationId?: string;
  knowledgeIds?: string[];
}

export interface ContextRetriever {
  retrieve(params: ContextRetrieverParams): Promise<AssembledContext>;
}
