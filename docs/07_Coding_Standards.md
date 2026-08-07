# KAIRO-Lite
## Coding Standards

Version: 1.1 (amended)
Status: Approved

---

# 1. Philosophy

Code is a long-term knowledge asset.

Optimize for:

- Readability
- Maintainability
- Predictability
- Testability
- Scalability

Never optimize for cleverness.

The simplest correct implementation is preferred.

---

# 2. General Principles

Every piece of code must satisfy:

- Single Responsibility Principle
- Separation of Concerns
- Explicit behavior
- Minimal side effects
- Deterministic outputs
- Strong typing

Avoid unnecessary abstraction.

---

# 3. TypeScript

TypeScript is mandatory.

Rules

- Strict Mode enabled
- No implicit any
- No ts-ignore without justification
- Prefer interfaces for object contracts
- Prefer type for unions
- Never use any unless impossible

Example

```ts
interface Project {

id: string;

name: string;

status: ProjectStatus;

}
```

---

# 4. React

Use:

- Functional Components
- Hooks
- Server Components by default
- Client Components only when required

Never use Class Components.

---

# 5. Next.js

Use App Router.

Rules

- Route Handlers for APIs
- Server Actions when appropriate
- Layouts for shared UI
- Loading boundaries
- Error boundaries
- Suspense when beneficial

---

# 6. Component Rules

Components must:

- Receive typed props
- Be reusable
- Avoid business logic
- Avoid direct database access
- Avoid AI provider calls

Components render.

Services execute.

---

# 7. Business Logic

Business logic belongs only inside Services.

Example

```
ProjectService

KnowledgeService

SearchService

AIService

GovernanceService
```

Never inside:

- Components
- API routes
- Prisma models

---

# 8. Database Access

Prisma access is isolated.

Flow

```
Component

↓

Route

↓

Service

↓

Repository

↓

Prisma
```

No shortcuts.

**Raw SQL and soft delete** (Document 13 §14, Amendment 12): the Prisma Client Extension that enforces soft-delete (Document 10 §4) only intercepts Prisma Client's model methods — it does not intercept `$queryRaw`/`$executeRaw`. Every raw SQL query must explicitly document its soft-delete behavior. Every repository using `$queryRaw` must either include an `archivedAt` filter itself or explain in a comment why it intentionally doesn't. This is not optional context — a raw query with neither is a defect, not a style issue.

**Transaction boundaries** (Document 13 §20, Amendment 18): every Repository constructor accepts an optional transaction-scoped Prisma client (defaulting to the global client), so it can participate in a caller's transaction instead of always opening its own. When a Service performs more than one write as part of a single business operation — most commonly an entity write plus its `AuditLog` row — it opens exactly one transaction around all of them and constructs fresh, transaction-scoped Repository instances inside it, rather than each write committing independently.

---

# 9. AI Rules

Every AI request goes through:

```
AIOrchestrator
```

Never

```
OpenAI.chat(...)
```

inside UI or Services.

Provider-specific code belongs only inside:

```
ai/providers/
```

---

# 10. Error Handling

Never swallow errors.

Prefer

```ts
try {

...

} catch (error) {

logger.error(error)

throw error

}
```

Errors should include:

- context
- operation
- timestamp

---

# 11. Validation

All external input must be validated.

Use

- Zod

Validation occurs:

- API
- Forms
- AI outputs
- Environment variables

Never trust external input.

---

# 12. Logging

Use structured logging.

Every important operation logs:

- actor
- action
- timestamp
- entity
- result

Never log secrets.

---

# 13. Environment Variables

Use typed configuration.

Never access

```ts
process.env
```

directly throughout the application.

Centralize environment loading.

---

# 14. API Standards

Responses should be predictable.

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

"code": "...",

"message": "..."

}

}
```

---

# 15. Async Code

Prefer

```ts
async / await
```

Avoid nested promises.

Always await asynchronous operations.

---

# 16. Imports

Import order

1. External packages

2. Internal aliases

3. Relative imports

Example

```ts
import { z } from "zod"

import { ProjectService } from "@/features/projects"

import "./styles.css"
```

---

# 17. Comments

Code should explain itself.

Use comments only for:

- Why
- Architecture decisions
- Complex algorithms

Avoid commenting obvious code.

---

# 18. Testing

Testing hierarchy

Unit

↓

Integration

↓

End-to-End

Critical services require tests.

---

# 19. Documentation

Public modules require documentation.

Complex functions require examples.

Architecture changes require documentation updates.

---

# 20. Performance

Prefer

- Server Components
- Lazy loading
- Pagination
- Memoization only when justified

Avoid premature optimization.

---

# 21. Security

Always

- Validate input
- Escape output
- Sanitize markdown
- Protect secrets
- Verify authentication
- Verify authorization

Never trust client input.

---

# 22. Accessibility

UI must support

- Keyboard navigation
- Screen readers
- Proper labels
- Semantic HTML

Accessibility is mandatory.

---

# 23. Git Standards

Every Pull Request must:

- Compile
- Pass linting
- Pass tests
- Update documentation if architecture changes

No broken main branch.

---

# 24. Definition of Done

A task is complete only if:

✓ Compiles

✓ Lints successfully

✓ Passes tests

✓ Uses proper typing

✓ Matches architecture

✓ Matches naming conventions

✓ Documentation updated

✓ No TODOs unless explicitly approved

---

# 25. Architecture Compliance

Implementation must comply with:

- PRD
- Architecture
- Database Design
- AI Architecture
- Folder Structure
- Naming Conventions

If code conflicts with documentation:

**Documentation wins.**

Never silently change the architecture.

---

# 26. AI-Assisted Development Rules

AI-generated code is treated the same as human-written code.

Every generated implementation must:

- Compile without errors
- Follow project conventions
- Be deterministic
- Be reviewed before acceptance
- Preserve architectural integrity

AI must not invent APIs, schemas, or business rules that are not defined in the approved documentation.

---

# 27. Future Standards

Future additions must not violate:

- Modular architecture
- Layer separation
- AI Orchestrator pattern
- Repository pattern
- Service pattern
- Documentation-first development

Any new architectural pattern requires an update to the Architecture document before implementation.

---

END OF DOCUMENT 7
