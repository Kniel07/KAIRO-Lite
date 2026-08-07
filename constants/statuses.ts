// Document 10 §5 / Document 13 §7 (Amendment 6) — canonical enum values,
// now backed by the Phase 2 Prisma enums (`prisma/schema.prisma`). Kept as
// plain TS constants too since UI code (Phase 4+) needs status vocabularies
// without importing the generated Prisma client, and Phase 3's Zod schemas
// (`features/*/schemas/`) validate against these same arrays rather than
// duplicating the value lists.
//
// `TASK_STATUSES` is deliberately absent — Task is RESERVED, schema only
// (Document 10 §5.6, Document 13 §6). No code outside `schema.prisma` may
// reference Task's status vocabulary until it is explicitly greenlit.

export const PROJECT_STATUSES = ["ACTIVE", "ARCHIVED", "COMPLETED"] as const;
export const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export const PROJECT_VISIBILITIES = ["PRIVATE", "PUBLIC"] as const;
export const KNOWLEDGE_STATUSES = ["DRAFT", "VALIDATED", "DEPRECATED"] as const;
export const NOTE_TYPES = ["IDEA", "REFERENCE", "JOURNAL", "TASK_DRAFT"] as const;
export const NOTE_SOURCES = ["MANUAL", "AI", "IMPORT"] as const;
export const DOCUMENT_TYPES = ["SPEC", "GUIDE", "ARCHITECTURE", "REPORT", "OTHER"] as const;

export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number];
export type ProjectPriorityValue = (typeof PROJECT_PRIORITIES)[number];
export type ProjectVisibilityValue = (typeof PROJECT_VISIBILITIES)[number];
export type KnowledgeStatusValue = (typeof KNOWLEDGE_STATUSES)[number];
export type NoteTypeValue = (typeof NOTE_TYPES)[number];
export type NoteSourceValue = (typeof NOTE_SOURCES)[number];
export type DocumentTypeValue = (typeof DOCUMENT_TYPES)[number];
