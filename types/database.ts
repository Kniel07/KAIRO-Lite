// Document 5 §9 — re-exports the generated Prisma types under the project's
// own `types/` namespace so feature code imports `@/types/database` instead
// of reaching into `@/generated/prisma` directly.
//
// Document 10 §5 — full domain model (Phase 2 — Database).
//
// `Task`/`TaskStatus`/`TaskPriority` are deliberately NOT re-exported here.
// Task is RESERVED — schema only (Document 10 §5.6, Document 13 §6). No
// repository, Service, API, or UI may reference it; that includes this
// types barrel.

export type {
  User,
  UserRole,
  Account,
  Session,
  VerificationToken,
  Project,
  ProjectStatus,
  ProjectPriority,
  ProjectVisibility,
  Note,
  NoteType,
  NoteSource,
  Knowledge,
  KnowledgeStatus,
  Document as KairoDocument,
  DocumentType,
  Tag,
  Conversation,
  Message,
  MessageRole,
  AIMode,
  AuditLog,
  AuditOperation,
  ActorType,
  Settings,
  Theme,
  GovernanceRule,
} from "@/generated/prisma/client";
