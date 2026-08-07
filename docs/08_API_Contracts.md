# KAIRO-Lite
## API Contracts

Version: 1.1 (amended)
Status: Approved

---

# 1. Philosophy

The API layer exposes application capabilities while enforcing business rules.

APIs must be:

- Predictable
- Stateless
- Strongly typed
- Versionable
- Secure
- Auditable

The API layer never contains business logic.

Business logic belongs in Services.

---

# 2. API Architecture

```
Client

↓

Route Handler

↓

Validation

↓

Service

↓

Repository

↓

Prisma

↓

Database
```

AI requests follow:

```
Client

↓

Route Handler

↓

Validation

↓

AI Orchestrator

↓

Provider

↓

Validation

↓

Response
```

---

# 3. Response Standard

Every endpoint returns the same envelope.

Success

```json
{
  "success": true,
  "data": {}
}
```

Failure

```json
{
  "success": false,
  "error": {
    "code": "PROJECT_NOT_FOUND",
    "message": "Project does not exist."
  }
}
```

Optional metadata

```json
{
  "success": true,
  "data": {},
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 145
  }
}
```

---

# 4. API Versioning

Current version

```
v1
```

Structure

```
/api/v1/
```

Future breaking changes require:

```
/api/v2/
```

---

# 5. Authentication

Every protected endpoint requires authentication.

Implementation: Auth.js v5, database session strategy, Email (magic-link) provider via Resend. Fully specified in Document 11. <!-- Amended: previously "future"; resolved by Document 11. -->

Public endpoints are explicitly documented.

---

# 6. Authorization

Authorization belongs inside Services.

Never rely solely on middleware.

Every mutation verifies:

- authenticated user
- ownership
- permissions

---

# 7. Validation

All requests are validated using Zod.

Validation occurs before Services are called.

Reject invalid payloads immediately.

---

# 8. HTTP Status Codes

Success

```
200 OK
201 Created
204 No Content
```

Client Errors

```
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Unprocessable Entity
```

Server

```
500 Internal Server Error
503 Service Unavailable
```

---

# 9. Projects API

Base

```
/api/v1/projects
```

Endpoints

GET

List projects

POST

Create project

GET /:id

Project details

PATCH /:id

Update project

DELETE /:id

Archive project

---

# 9a. Tags API

<!-- Added: Document 13 §10 (Amendment 9). Fills a gap — Tag is a first-class entity (Document 3 §4) with no prior CRUD contract. -->

Base

```
/api/v1/tags
```

Endpoints

GET

List tags

POST

Create tag

PATCH /:id

Rename / recolor tag

DELETE /:id

Archive tag

Follows the same envelope, pagination, and noun-only naming rules as every other resource in this document.

---

# 10. Knowledge API

```
/api/v1/knowledge
```

Supports

GET

POST

PATCH

DELETE

Search

Filtering

Pagination

---

# 11. Notes API

```
/api/v1/notes
```

Supports

Create

Update

Delete

Convert to Knowledge

Convert to Document

---

# 12. Documents API

```
/api/v1/documents
```

Supports

Markdown

Export

Version history

Publishing

---

# 13. Search API

```
/api/v1/search
```

Request

```json
{
  "query": "AI architecture"
}
```

Response

```json
{
  "success": true,
  "data": {
    "results": []
  }
}
```

MVP search is full-text (Postgres GIN index, Document 10 §8). Future: Semantic Search, Vector Search. <!-- Amended: MVP scope clarified per Document 13 §2 (Amendment 1). -->

---

# 14. AI API

```
/api/v1/ai/chat
```

Request

```json
{
  "mode": "THINK",
  "projectId": "...",
  "prompt": "..."
}
```

Response

```json
{
  "success": true,
  "data": {
    "response": "...",
    "citations": [],
    "usage": {}
  }
}
```

The route handler delegates to the AI Orchestrator.

---

# 14a. Conversations API

<!-- Added: Document 13 §11 (Amendment 10). Read/archive-only — new AI turns are still only ever produced via `/api/v1/ai/chat`, preserving the Orchestrator as the sole path that generates AI-authored messages (Document 4 §15). -->

Base

```
/api/v1/conversations
```

Endpoints

GET

List conversations

GET /:id

Conversation detail, with nested messages

DELETE /:id

Archive conversation

No `POST /:id/messages` endpoint exists — messages are only ever created through `/api/v1/ai/chat`.

---

# 15. Settings API

```
/api/v1/settings
```

Supports

GET

PATCH

Preferences

Theme

AI defaults

Language

Timezone

---

# 16. Pagination Standard

Query

```
?page=1&pageSize=20
```

Response

```json
{
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 200,
    "hasNext": true
  }
}
```

---

# 17. Filtering

Example

```
?status=ACTIVE

?tag=architecture

?sort=updatedAt

?order=desc
```

---

# 18. Error Codes

Examples

```
VALIDATION_ERROR

PROJECT_NOT_FOUND

KNOWLEDGE_NOT_FOUND

DOCUMENT_NOT_FOUND

UNAUTHORIZED

FORBIDDEN

AI_PROVIDER_ERROR

RATE_LIMITED

UNKNOWN_ERROR
```

Error codes remain stable across releases.

---

# 19. Idempotency

Safe operations

GET

HEAD

DELETE (archive)

Mutating endpoints should support idempotency where practical.

Future support

```
Idempotency-Key
```

header.

---

# 20. Rate Limiting

Future implementation

AI endpoints

Search endpoints

Authentication endpoints

Rate limiting occurs before business logic.

---

# 21. Audit Requirements

The following operations generate audit entries:

Project creation

Project updates

Knowledge edits

Document publication

AI-assisted modifications

Settings changes

Governance changes

---

# 22. API Design Rules

Routes are nouns.

Actions belong inside Services.

No verbs in endpoint names.

Correct

```
POST /projects
```

Avoid

```
POST /createProject
```

---

# 23. AI Contract

Every AI request must include:

- mode
- prompt

Optional

- projectId
- conversationId
- knowledgeIds

The AI Orchestrator assembles all remaining context.

IMPLEMENT mode additionally accepts an optional `approved` boolean; Stage 2 (code output) only executes when `approved: true` is explicitly passed. See Document 12 §6.

---

# 24. Future APIs

Reserved

```
/automation

/plugins

/workflows

/analytics

/embeddings

/vector

/notifications

/governance
```

Not implemented in MVP. `/governance` reserved should the minimal `GovernanceRule` config (Document 10 §5.12) outgrow settings-style admin access.

---

# 25. API Compliance Rules

Every endpoint must:

✓ Validate input

✓ Authenticate user

✓ Authorize access

✓ Call Services only

✓ Return the standard response envelope

✓ Produce structured errors

✓ Generate audit records where applicable

✓ Never expose internal implementation details

If implementation conflicts with this document:

**This document is authoritative.**

---

END OF DOCUMENT 8
