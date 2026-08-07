# KAIRO-Lite
## Prisma Data Model Specification

Version: 1.0
Status: Proposed (Amendment — pending approval)
Supersedes: Fills gaps left open by Document 3 (Database Design). Does not contradict it.

---

# 1. Purpose

This document is the field-level specification for every Prisma model implied by Document 3. It resolves every "missing field," "undefined enum," and "unclear relationship" item raised in the Phase 0 Ingestion Report.

This is a **specification**, not the `schema.prisma` file itself. No Prisma syntax is generated here, per the current implementation gate (Document 9 §9 — code generation requires `START IMPLEMENTATION`).

Every decision below is either:
- **Sourced** — taken directly from explicit text in Documents 1–9, or
- **Filled Gap** — a minimal, clearly-labeled addition where Documents 1–9 left a field, enum, or relationship undefined. Filled Gaps favor the smallest addition that satisfies the existing text, never introduce new modules, and are chosen to be extensible without future migration pain.

---

# 2. Prisma Conventions

| Concern | Convention | Source |
|---|---|---|
| Model names | PascalCase, singular (`Project`, `Note`) | Doc 6 §6, §21 pattern applied to models |
| Table names | snake_case, plural, via `@@map` (`projects`, `audit_logs`) | Doc 6 §11 |
| Field names | camelCase in schema; no `@map` needed unless a name collides with a Postgres reserved word | Doc 6 §12 |
| Enum names | PascalCase; members UPPER_SNAKE_CASE | Doc 6 §10 |
| Primary keys | Always `id` | Doc 6 §13 |
| Foreign keys | `<entity>Id` camelCase (`projectId`, `ownerId`) | Doc 6 §13 |
| Booleans | `is`/`has`/`can`/`should` prefix | Doc 6 §6 |

---

# 3. UUID Strategy (resolves Ingestion Report §6 Q13)

Document 3 §7 requires UUID v7 (preferred) with UUID v4 fallback, no auto-increment integers.

**Resolution:** Use Prisma's native `uuid(7)` default generator function on every primary key (`id String @id @default(uuid(7))`), available in current Prisma ORM releases. If the Prisma version pinned in Phase 0 does not expose `uuid(7)` as stable, fall back to `@default(uuid())` (v4) for that release and track an upgrade task — this fallback path is explicitly sanctioned by Doc 3 §7 itself ("Fallback: UUID v4"), so it requires no further approval if triggered. No application-level UUID library is introduced; this keeps ID generation inside the ORM boundary per Doc 7 §8's "no shortcuts" data-access rule.

---

# 4. Soft-Delete Strategy

Per Doc 3 §8: every primary business entity carries a nullable `archivedAt DateTime?`. Default queries exclude non-null `archivedAt` rows at the Repository layer (Repository, not Prisma middleware — keeps behavior explicit and testable per Doc 7 §2).

**Clarification (fills an implicit gap):** `archivedAt` is a *system-level lifecycle marker*, independent from business-status enums like `ProjectStatus`. A `Project` can have `status: ARCHIVED` (business state, still visible in "Archived Projects" views) without `archivedAt` being set. `archivedAt` is only populated when a record should disappear from default queries entirely (the Doc 3 §8 soft-delete mechanism). This preserves both concepts as documented without merging them.

Entities without `archivedAt` (explicitly justified, not oversights):
- **Message** — immutable, append-only per Doc 3 §2.
- **AuditLog** — explicitly "Immutable" per Doc 3 §4.
- **Account / Session / VerificationToken** — library-mandated Auth.js adapter models (see §9); lifecycle governed by the auth library, not KAIRO's soft-delete convention.
- **Settings** — 1:1 config row with no independent lifecycle; removed only via cascade when its owning `User` is removed.

---

# 5. Core Entities

## 5.1 User

> Doc 3 was the only entity with no field list — this section fills that gap in full.

| Field | Type | Constraints | Source |
|---|---|---|---|
| id | String (uuid) | PK | Doc 3 §4 |
| email | String | unique, required | Filled Gap — required by Doc 11 auth strategy |
| name | String? | nullable | Filled Gap |
| image | String? | nullable (avatar URL) | Filled Gap — Auth.js standard field name |
| emailVerified | DateTime? | nullable | Filled Gap — required by Auth.js Email provider |
| role | UserRole | default `OWNER` | Filled Gap — see §6, forward-compatible with Doc 1 §3 "future multi-user support" |
| createdAt | DateTime | default now() | Doc 3 §6 |
| updatedAt | DateTime | @updatedAt | Doc 3 §6 |
| archivedAt | DateTime? | nullable | Doc 3 §6 |

**Enum `UserRole`** (Filled Gap): `OWNER`, `MEMBER`. MVP creates only `OWNER` rows (see Doc 11). `MEMBER` exists purely so the future multi-user phase (Doc 9 Phase 9) needs no migration.

**Relations:** `projects[]`, `notes[]` (as author), `tasksAssigned[]` (as assignee), `conversations[]`, `settings` (1:1), `auditLogs[]` (as actor), `accounts[]`, `sessions[]`.

**Correction (Phase 2 implementation review):** an earlier revision of this row listed `documents[]` as a direct User relation. No such relation exists — §5.5's Document field list (and Document 3 §5's relationship diagram, which nests Documents under Projects, not directly under User) has no `User` foreign key on `Document`. Ownership of a Document flows through its Project. This was a drafting error in this document, not in Document 3; the Prisma schema was implemented per the correct (Document 3-consistent) shape from the start.

---

## 5.2 Project

| Field | Type | Constraints | Source |
|---|---|---|---|
| id | String (uuid) | PK | Doc 3 §4 |
| name | String | required | Doc 3 §4 |
| slug | String | unique | Doc 3 §4 |
| description | String? (Text) | nullable | Doc 3 §4 |
| status | ProjectStatus | default `ACTIVE` | Doc 3 §4 / enum sourced from Doc 6 §10 |
| priority | ProjectPriority | default `MEDIUM` | Filled Gap |
| visibility | ProjectVisibility | default `PRIVATE` | Filled Gap |
| ownerId | String (FK → User) | required | Doc 3 §4 |
| createdAt / updatedAt / archivedAt | — | standard | Doc 3 §6 |

**Enums:**
- `ProjectStatus` (**Sourced** verbatim from Doc 6 §10): `ACTIVE`, `ARCHIVED`, `COMPLETED`
- `ProjectPriority` (Filled Gap, minimal): `LOW`, `MEDIUM`, `HIGH`
- `ProjectVisibility` (Filled Gap, minimal — MVP is single-user so this is inert until Doc 9 Phase 9, but the field is required by Doc 3 §4): `PRIVATE`, `PUBLIC`

**Relations:** `notes[]`, `documents[]`, `knowledge[]`, `tasks[]`, `conversations[]`, `tags[]` (m2m).

---

## 5.3 Note

| Field | Type | Constraints | Source |
|---|---|---|---|
| id | String (uuid) | PK | Doc 3 §4 |
| title | String | required | Doc 3 §4 |
| content | String (Text) | required | Doc 3 §4 |
| projectId | String? (FK → Project) | **nullable** | Filled Gap — quick capture (Doc 2, Notes module) must work before a project exists |
| authorId | String (FK → User) | required | Doc 3 §4 |
| noteType | NoteType | default `IDEA` | Filled Gap |
| source | NoteSource | default `MANUAL` | Filled Gap |
| createdAt / updatedAt / archivedAt | — | standard | Doc 3 §6 |

**Enums (Filled Gap, minimal):**
- `NoteType`: `IDEA`, `REFERENCE`, `JOURNAL`, `TASK_DRAFT`
- `NoteSource`: `MANUAL`, `AI`, `IMPORT`

**Relations:** `project` (optional), `tags[]` (m2m).

---

## 5.4 Knowledge

| Field | Type | Constraints | Source |
|---|---|---|---|
| id | String (uuid) | PK | Doc 3 §4 |
| title | String | required | Doc 3 §4 |
| summary | String? (Text) | nullable | Doc 3 §4 |
| markdown | String (Text) | required | Doc 3 §4 |
| projectId | String? (FK → Project) | **nullable** | Filled Gap — Doc 4 §6 explicitly lists "Global Knowledge" as a context tier distinct from project-scoped knowledge, which requires this to be optional |
| category | String | required, app-governed | See amendment rationale in Doc 13 §7 |
| confidence | Float | 0.0–1.0, default 0.5 | See amendment rationale in Doc 13 §8 |
| status | KnowledgeStatus | default `DRAFT` | Filled Gap |
| createdAt / updatedAt / archivedAt | — | standard | Doc 3 §6 |

**Enum `KnowledgeStatus`** (Filled Gap — maps directly onto Doc 1 §7 workflow: Capture → Think → **Validate** → **Document**): `DRAFT`, `VALIDATED`, `DEPRECATED`

**Relations:** `project` (optional), `tags[]` (m2m), `relatedDocuments[]` (m2m → Document, fulfills Doc 3 §4 "Knowledge ├── Documents"), `citedInMessages[]` (m2m → Message, fulfills Doc 3 §4 "Knowledge ├── AI References" and Doc 8 §14's `citations` field).

---

## 5.5 Document

| Field | Type | Constraints | Source |
|---|---|---|---|
| id | String (uuid) | PK | Doc 3 §4 |
| title | String | required | Doc 3 §4 |
| type | DocumentType | default `GUIDE` | Filled Gap |
| projectId | String (FK → Project) | **required** | Doc 3 §4 (no "Global Documents" concept exists anywhere in Docs 1–9, unlike Knowledge) |
| markdown | String (Text) | required | Doc 3 §4 |
| version | Int | default 1 | Doc 3 §4 |
| published | Boolean | default false | Doc 3 §4 |
| createdAt / updatedAt / archivedAt | — | standard | Doc 3 §6 |

**Enum `DocumentType`** (Filled Gap, minimal): `SPEC`, `GUIDE`, `ARCHITECTURE`, `REPORT`, `OTHER`

**Relations:** `project`, `tags[]` (m2m), `relatedKnowledge[]` (inverse of Knowledge.relatedDocuments).

---

## 5.6 Task

> **RESERVED — schema only.** Included in schema per Doc 13 §5 amendment (Task is a Core Entity in Doc 3, not a Future Table) but **out of scope for any Repository, Service, API route, or UI** until explicitly greenlit (extended from "Service/API/UI" to also exclude Repository during the Phase 2 review — no `TaskRepository` exists, and `Task`/`TaskStatus`/`TaskPriority` are not re-exported from `@/types/database` or `constants/statuses.ts`).

| Field | Type | Constraints | Source |
|---|---|---|---|
| id | String (uuid) | PK | Doc 3 §4 |
| title | String | required | Doc 3 §4 |
| status | TaskStatus | default `TODO` | Filled Gap |
| priority | TaskPriority | default `MEDIUM` | Filled Gap |
| dueDate | DateTime? | nullable | Doc 3 §4 |
| assigneeId | String? (FK → User) | nullable | Doc 3 §4 |
| projectId | String (FK → Project) | required | Doc 3 §4 relationship diagram |
| createdAt / updatedAt / archivedAt | — | standard | Doc 3 §6 (applies to all primary entities even where a field list omitted it) |

**Enums (Filled Gap, mirrors Project's shape per Doc 6's consistency principle):**
- `TaskStatus`: `TODO`, `IN_PROGRESS`, `DONE`, `CANCELLED`
- `TaskPriority`: `LOW`, `MEDIUM`, `HIGH`

---

## 5.7 Tag

| Field | Type | Constraints | Source |
|---|---|---|---|
| id | String (uuid) | PK | Doc 3 §4 |
| name | String | unique | Doc 3 §4 |
| color | String | required (hex or design-token) | Doc 3 §4 |
| createdAt / updatedAt / archivedAt | — | standard | Doc 3 §6 |

**Relations (implicit many-to-many, one join per entity, per Doc 3 §4):** `projects[]`, `knowledge[]`, `notes[]`, `documents[]`.

---

## 5.8 Conversation

| Field | Type | Constraints | Source |
|---|---|---|---|
| id | String (uuid) | PK | Doc 3 §4 |
| projectId | String? (FK → Project) | **nullable** | Filled Gap — Doc 4 §6 context priority list treats "Active Project" as priority-1, not mandatory |
| userId | String (FK → User) | required | Filled Gap — every conversation has an owner |
| title | String? | nullable | Doc 3 §4 |
| model | String | required (e.g. provider model id) | Doc 3 §4 |
| createdAt / updatedAt / archivedAt | — | standard | Doc 3 §6 |

**Relations:** `messages[]`, `project` (optional), `user`.

**Note:** `mode` (THINK/VALIDATE/DOCUMENT/IMPLEMENT) lives on **Message**, not Conversation — a single thread may cross modes turn-by-turn, consistent with Doc 8 §14 passing `mode` per chat request rather than per conversation.

---

## 5.9 Message

| Field | Type | Constraints | Source |
|---|---|---|---|
| id | String (uuid) | PK | Doc 3 §4 |
| conversationId | String (FK → Conversation) | required | Doc 3 §4 |
| role | MessageRole | required | Filled Gap |
| content | String (Text) | required | Doc 3 §4 |
| mode | AIMode? | nullable, set only for AI-generated turns | Filled Gap — mirrors Doc 4 §4 modes exactly |
| tokenCount | Int? | nullable | Doc 3 §4 |
| createdAt | DateTime | default now() | Doc 3 §4 |

No `updatedAt`/`archivedAt` — immutable, append-only (Doc 3 §2, §4).

**Enums:**
- `MessageRole` (Filled Gap): `USER`, `ASSISTANT`, `SYSTEM`
- `AIMode` (**Sourced** verbatim from Doc 4 §4): `THINK`, `VALIDATE`, `DOCUMENT`, `IMPLEMENT`

**Relations:** `conversation`, `citedKnowledge[]` (m2m → Knowledge).

---

## 5.10 AuditLog

| Field | Type | Constraints | Source |
|---|---|---|---|
| id | String (uuid) | PK | Doc 3 §4 |
| entity | String | required | Doc 3 §4 |
| entityId | String | required | Doc 3 §4 |
| operation | AuditOperation | required | Enum sourced verbatim from Doc 3 §9's operation list |
| actorId | String? (FK → User) | nullable (SetNull on user removal) | Doc 3 §4, adjusted for AI/system actors |
| actorType | ActorType | default `USER` | Filled Gap — required to log "AI-assisted edits" per Doc 3 §9 without forcing a User row |
| timestamp | DateTime | default now() | Doc 3 §4 |
| before | Json? | nullable | Doc 3 §4 |
| after | Json? | nullable | Doc 3 §4 |

Immutable — no `updatedAt`/`archivedAt` (Doc 3 §4 "Immutable").

**Enums:**
- `AuditOperation` (**Sourced** verbatim from Doc 3 §9): `CREATE`, `UPDATE`, `ARCHIVE`, `RESTORE`, `DELETE`, `AI_EDIT`, `GOVERNANCE_CHANGE`
- `ActorType` (Filled Gap): `USER`, `AI`, `SYSTEM`

---

## 5.11 Settings

| Field | Type | Constraints | Source |
|---|---|---|---|
| id | String (uuid) | PK | Doc 3 §4 |
| userId | String (FK → User) | **unique** (1:1) | Fills Ingestion Report gap — Doc 3 §5 relationship diagram already shows `User → Settings`; this is field-completion, not a new relationship |
| theme | Theme | default `SYSTEM` | Filled Gap |
| defaultModel | String | required | Doc 3 §4 |
| aiTemperature | Float | default 0.7 | Doc 3 §4 |
| language | String | default `"en"` | Doc 3 §4 |
| timezone | String | default `"UTC"` | Doc 3 §4 |
| createdAt / updatedAt | — | standard | Doc 3 §6 |

**Enum `Theme`** (Filled Gap, ties to Doc 5 `constants/themes.ts`): `LIGHT`, `DARK`, `SYSTEM`

---

## 5.12 GovernanceRule

> New table required by Doc 13 §4 amendment (Governance Implementation). Minimal key-value config, not a rules engine.

| Field | Type | Constraints | Source |
|---|---|---|---|
| id | String (uuid) | PK | Doc 13 §4 |
| key | String | unique | Doc 13 §4 |
| value | Json | required | Doc 13 §4 |
| description | String? | nullable | Doc 13 §4 |
| updatedAt | DateTime | @updatedAt | standard |

No `createdAt`/`archivedAt` — a config table is upserted, not lifecycle-tracked the same way as content entities.

---

# 6. Auth.js Adapter Models (library-mandated, not custom KAIRO entities)

Required by the Prisma Adapter for Auth.js v5 (see Document 11). Shape is fixed by the library, not invented by this document:

| Model | Purpose |
|---|---|
| `Account` | Links a `User` to an OAuth/email provider identity. FK `userId → User`, `onDelete: Cascade`. |
| `Session` | Database session record for the "database" session strategy. FK `userId → User`, `onDelete: Cascade`. |
| `VerificationToken` | One-time tokens for Email (magic-link) sign-in. No `User` FK — matched by email at verification time. |

---

# 7. Cascade Rules

| Relation | On Parent Delete | Rationale |
|---|---|---|
| Account/Session → User | Cascade | Auth.js library requirement |
| Settings → User | Cascade | 1:1 config, meaningless without owner |
| Project → User (owner) | Restrict | Prevent accidental loss of a project via user removal; soft-delete is the sanctioned path (Doc 3 §8) |
| Note → User (author) | Restrict | Same rationale |
| Note → Project | SetNull | A note should survive its project being removed (notes predate/outlive projects per Doc 2 Notes module) |
| Knowledge → Project | SetNull | Knowledge "should never be lost" (Doc 1 §4) — demoting to global knowledge on project removal, never deleting |
| Document → Project | Restrict | Documents have no "global" tier (§5.5); a project must be archived, not hard-deleted, to remove its documents |
| Task → Project | Restrict | Same as Document |
| Task → User (assignee) | SetNull | Reassignment shouldn't be blocked by a user's removal |
| Conversation → Project | SetNull | Conversations may outlive project deletion (history preserved per Doc 1 §4) |
| Conversation → User | Restrict | Conversations require an owner |
| Message → Conversation | Cascade | Messages have no meaning outside their conversation |
| AuditLog → User (actor) | SetNull | Audit trail is immutable and must survive actor removal (Doc 3 §9) |

Hard deletes are expected to be rare in application code — Doc 3 §2 mandates soft delete as the default. These cascade rules govern the rare/administrative hard-delete path, not everyday application behavior.

---

# 8. Index Strategy

Per Doc 3 §10 (PK, FK, slug, status, created/updated date, full-text columns, frequently-filtered enums):

| Model | Indexes |
|---|---|
| User | `email` (unique) |
| Project | `ownerId`, `slug` (unique), `status`, `createdAt`, `updatedAt` |
| Note | `projectId`, `authorId`, `noteType`, `createdAt` |
| Knowledge | `projectId`, `status`, `category`, `createdAt`, `updatedAt`, GIN full-text index on `title` + `markdown` |
| Document | `projectId`, `type`, `published`, `createdAt` |
| Task | `projectId`, `assigneeId`, `status`, `dueDate` |
| Tag | `name` (unique) |
| Conversation | `projectId`, `userId`, `createdAt` |
| Message | `conversationId`, `role`, `createdAt` |
| AuditLog | composite `(entity, entityId)`, `actorId`, `timestamp` |
| Settings | `userId` (unique) |
| GovernanceRule | `key` (unique) |

The full-text GIN index is the concrete mechanism satisfying Doc 3 §10's "full-text search columns" and backs the MVP Search API resolution in Document 13 §1 — no separate search-index table is introduced.

---

# 9. Many-to-Many Relations Summary

| Relation | Entities | Justification |
|---|---|---|
| Tags ↔ Project / Knowledge / Note / Document | 4 implicit joins | Doc 3 §4 explicit |
| Knowledge ↔ Document | `relatedKnowledge` / `relatedDocuments` | Doc 3 §4 "Knowledge ├── Documents" |
| Knowledge ↔ Message | `citedInMessages` / `citedKnowledge` | Doc 3 §4 "AI References" + Doc 8 §14 `citations` field |

All implicit (Prisma-managed join tables) — no explicit join models, keeping to Doc 7 §2 "avoid unnecessary abstraction."

---

# 10. Untouched from Document 3

Everything not listed as a gap above — soft-delete philosophy, audit strategy, migration strategy (Prisma Migrate, no destructive changes without approval), and the §11 Future Tables list (Knowledge Graph, Embeddings, Vector Index, Workflow Engine, Notifications, Attachments, Plugin Registry, Automation Jobs) — remains exactly as written and is **not** re-specified here.

---

END OF DOCUMENT 10
