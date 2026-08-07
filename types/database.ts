// Document 5 §9 — re-exports the generated Prisma types under the project's
// own `types/` namespace so feature code imports `@/types/database` instead
// of reaching into `@/generated/prisma` directly.
//
// Phase 0/1 only defines the Auth.js-required models (Document 10 §5.1,
// §6). TODO(Document 10 §5; Phase 2 — Database): re-export Project, Note,
// Knowledge, Document, Task, Tag, Conversation, Message, AuditLog,
// Settings, and GovernanceRule once those models exist.

export type {
  User,
  UserRole,
  Account,
  Session,
  VerificationToken,
} from "@/generated/prisma/client";
