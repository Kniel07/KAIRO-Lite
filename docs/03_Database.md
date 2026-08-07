# KAIRO-Lite
## Database Design

Version: 1.1 (amended)
Status: Approved

---

# 1. Database Philosophy

The database is the single source of truth.

AI never owns data.

AI reads, analyzes, and proposes changes.

Only validated application services may write to the database.

---

# 2. Design Principles

- Normalize where practical
- Denormalize only for performance
- Soft delete instead of hard delete
- UUID primary keys
- Audit every important write
- Created/Updated timestamps on every table
- Append-only history for critical entities
- Referential integrity through foreign keys

---

# 3. Core Domains

The database is divided into the following domains:

- Authentication
- Projects
- Knowledge
- Notes
- Documents
- AI
- Search
- Governance
- Audit

<!-- Amended: Governance domain is backed by a minimal `GovernanceRule` key-value config entity (see §4 below and Document 10 §5.12), not a rules engine. See Document 13 §5 (Amendment 4). -->

---

# 4. Core Entities

## User

Purpose

Application owner.

Relationships

User
├── Projects
├── Notes
├── Documents
├── AI Conversations
└── Settings

Fields: fully specified in Document 10 §5.1 (id, email, name, image, emailVerified, role, createdAt, updatedAt, archivedAt).

---

## Project

Represents a single initiative.

Fields

- id
- name
- slug
- description
- status
- priority
- visibility
- ownerId
- createdAt
- updatedAt
- archivedAt

Relationships

Project
├── Notes
├── Documents
├── Tasks
├── Knowledge
├── Conversations
└── Tags

---

## Note

Quick knowledge capture.

Fields

- id
- title
- content
- projectId
- authorId
- noteType
- source
- createdAt
- updatedAt

Notes may later become:

- Knowledge
- Document
- Project
- Task

---

## Knowledge

Permanent structured information.

Fields

- id
- title
- summary
- markdown
- projectId
- category
- confidence — **Float, range 0.0–1.0** <!-- Amended: type/scale defined. See Document 13 §8 (Amendment 7). -->
- status
- createdAt
- updatedAt

Relationships

Knowledge
├── Tags
├── Documents
├── AI References

---

## Document

Formal documentation.

Fields

- id
- title
- type
- projectId
- markdown
- version
- published
- createdAt

---

## Task

Future implementation item.

Fields

- id
- title
- status
- priority
- dueDate
- assigneeId
- projectId

---

## Tag

Reusable classification.

Fields

- id
- name
- color

Many-to-many

Projects

Knowledge

Notes

Documents

---

## Conversation

Stores AI conversations.

Fields

- id
- projectId
- title
- model
- createdAt

Relationships

Conversation
├── Messages

---

## Message

Fields

- id
- conversationId
- role
- content
- tokenCount
- createdAt

---

## Audit Log

Every important write operation.

Fields

- id
- entity
- entityId
- operation
- actor
- timestamp
- before
- after

Immutable.

---

## Settings

Stores user preferences.

Fields

- id
- userId <!-- Amended: owner FK added, completing the User → Settings relationship already shown in §5. See Document 13 §9 (Amendment 8). -->
- theme
- defaultModel
- aiTemperature
- language
- timezone

---

## GovernanceRule

<!-- Added: minimal key-value config backing the Governance domain. See Document 13 §5 (Amendment 4) and Document 10 §5.12. -->

Purpose

Small, dynamic configuration store for the one genuinely runtime-adjustable governance concern (e.g. the Knowledge category taxonomy). Naming conventions, schema validation, and audit policy are enforced by static tooling (ESLint, Zod) and the existing Audit Log — not by this table.

Fields

- id
- key
- value
- description
- updatedAt

---

# 5. Entity Relationships

```
User

├── Projects

│     ├── Notes

│     ├── Documents

│     ├── Knowledge

│     ├── Tasks

│     └── Conversations

│

└── Settings
```

---

# 6. Standard Fields

Every primary entity contains:

- id
- createdAt
- updatedAt
- archivedAt (nullable)

---

# 7. ID Strategy

Primary Keys

UUID v7 (preferred)

Fallback

UUID v4

No auto-increment integers.

---

# 8. Soft Delete

Records are never immediately deleted.

Instead:

archivedAt

is populated.

Queries ignore archived records unless explicitly requested.

---

# 9. Audit Strategy

The following operations create audit records:

Create

Update

Archive

Restore

Delete

AI-assisted edits

Governance changes

---

# 10. Index Strategy

Indexes should exist for:

Primary Keys

Foreign Keys

Slug

Status

Created Date

Updated Date

Full-text search columns

Frequently filtered enums

---

# 11. Future Tables

Reserved for later versions:

- Knowledge Graph
- Embeddings
- Vector Index
- Workflow Engine
- Notifications
- Attachments
- Plugin Registry
- Automation Jobs

These are intentionally excluded from MVP but the schema should remain extensible.

---

# 12. Migration Strategy

Database schema changes must:

- Be versioned
- Use Prisma Migrations
- Preserve existing data
- Never perform destructive changes without explicit approval

---

# 13. Database Rules

No business logic inside the database.

No stored procedures.

No triggers except where technically required.

Application Services own business rules.

AI never writes directly.

---

END OF DOCUMENT 3
