// Document 10 §5 / Document 13 §7 (Amendment 6) — canonical enum values.
// These are plain TS constants (not yet backed by Prisma enums, which are
// introduced in Phase 2) so Phase 1 code — e.g. UI placeholders, future Zod
// schemas — has a single source for status vocabularies ahead of the
// database layer.

export const PROJECT_STATUSES = ["ACTIVE", "ARCHIVED", "COMPLETED"] as const;
export const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const KNOWLEDGE_STATUSES = ["DRAFT", "VALIDATED", "DEPRECATED"] as const;
export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"] as const;

export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number];
export type ProjectPriorityValue = (typeof PROJECT_PRIORITIES)[number];
export type KnowledgeStatusValue = (typeof KNOWLEDGE_STATUSES)[number];
export type TaskStatusValue = (typeof TASK_STATUSES)[number];
