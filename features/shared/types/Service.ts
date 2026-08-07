// Document 7 §7 — "Business logic belongs only inside Services." This is
// the generic contract every concrete Service (ProjectService,
// KnowledgeService, ...) implements once Phase 3 introduces them.
// Document 11 §7 — every mutating call carries the authenticated user so
// the Service can enforce ownership; this is the mechanism that check
// depends on.

export interface ServiceContext {
  userId: string;
}

export interface Service<T, CreateInput, UpdateInput> {
  get(context: ServiceContext, id: string): Promise<T>;
  list(context: ServiceContext): Promise<T[]>;
  create(context: ServiceContext, input: CreateInput): Promise<T>;
  update(context: ServiceContext, id: string, input: UpdateInput): Promise<T>;
  archive(context: ServiceContext, id: string): Promise<void>;
}
