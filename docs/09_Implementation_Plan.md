# KAIRO-Lite
## Implementation Plan

Version: 1.7 (amended)
Status: Approved

---

# 1. Purpose

This document defines the official implementation sequence for KAIRO-Lite.

The objective is to minimize technical debt, reduce rework, and ensure every feature is built on a stable architectural foundation.

Implementation follows a **documentation-first** approach.

No feature should be implemented before its corresponding architecture and data model are approved.

---

# 2. Guiding Principles

Implementation priorities are based on dependency order, not feature popularity.

Rules:

- Foundation before features.
- Database before APIs.
- APIs before UI.
- Services before AI.
- AI before automation.
- Testing throughout the lifecycle.

---

# 3. Phase Overview

```
Phase 0
Project Foundation

↓

Phase 1
Core Infrastructure

↓

Phase 2
Database

↓

Phase 3
Backend Services

↓

Phase 4
Frontend

↓

Phase 5
AI Layer

↓

Phase 6
Search & Knowledge

↓

Phase 7
Quality Assurance

↓

Phase 8
Deployment

↓

Phase 9
Future Expansion
```

---

# Phase 0 — Project Foundation

Objective

Establish the project skeleton.

Deliverables

- Repository initialized
- Documentation committed
- Next.js configured
- TypeScript configured
- Tailwind configured
- ESLint configured
- Prettier configured
- shadcn/ui installed
- Environment configuration
- Path aliases
- GitHub Actions — delivered during the Phase 2 Infrastructure Hardening Sprint (Document 13 §16-19), not at Phase 0 itself; the Architecture Compliance Matrix (Document 14) surfaced its absence as the largest outstanding gap, prompting it before Phase 3 rather than after

Exit Criteria

✓ Project builds successfully

---

# Phase 1 — Core Infrastructure

Objective

Build reusable infrastructure.

Deliverables

- Configuration system
- Logging
- Error handling
- Validation
- Utility libraries
- Authentication foundation (Auth.js v5, see Document 11)
- Repository pattern
- Service layer
- Dependency boundaries

Exit Criteria

✓ Shared infrastructure reusable

---

# Phase 2 — Database

Objective

Implement the persistence layer.

Deliverables

- Prisma schema (per Document 10)
- Initial migration — includes the `Task` table as a schema placeholder (Core Entity per Document 3), unused by any Service/API/UI until a future phase (Document 13 §6, Amendment 5) <!-- Amended -->
- Seed script
- Repository implementations
- Audit infrastructure
- Soft-delete support
- Indexes

Exit Criteria

✓ Database migrations succeed

✓ CRUD validated

---

# Phase 3 — Backend Services

Objective

Implement application services.

Modules

- ProjectService
- KnowledgeService
- NotesService
- DocumentService
- SearchService
- GovernanceService — the sole writer of `GovernanceRule`; `KnowledgeService`/`NotesService` read the `"knowledge.allowedCategories"` rule directly via `GovernanceRuleRepositoryLike`, not by calling this Service (Document 13 §20, Amendment 18) <!-- Amended -->

Deliverables

- CRUD
- Validation
- Authorization
- Audit integration — every multi-write Service operation executes inside a single Prisma transaction (Document 7 §8, Document 13 §20 Amendment 18), not as independent writes <!-- Amended -->

Exit Criteria

✓ Services tested

---

# Phase 4 — Frontend

Objective

Build the application interface.

Pages

- Dashboard
- Projects
- Notes
- Knowledge
- Documents
- Search
- Settings — required `SettingsService` (Document 13 §20's Phase 3 module list omitted it; the Component → Route → Service chain meant the Settings page needed one to exist) <!-- Amended -->

Deliverables

- Navigation
- Layout
- Forms
- Tables
- Editors — `MarkdownEditor` (`components/editors/`) reuses the existing markdown infrastructure (`lib/markdown/render.ts`), not a new rendering path
- Empty states
- Loading states
- Error boundaries

Route Handlers (`app/api/v1/**`) were built alongside the pages — Document 8's contract, one Service call per handler, standard envelope — since Components consume Route Handlers only (Document 7 §8), never a Service directly (enforced by the pre-Phase-4 ESLint boundary, Document 13 §21 Amendment 19).

A read-only Pre-Phase-5 UX Review (before Phase 5 was authorized) found that the shared application shell (`app/(dashboard)/layout.tsx`) only wrapped the Dashboard route — every other page lived outside the `(dashboard)` route group and rendered with no sidebar, header, or skip link. Phase 4 was reopened rather than closed on the original verification pass; Document 13 §23 Amendment 21 records the correction (route group fix, responsive sidebar, `ConfirmDialog` replacing `window.confirm()`, Search result deep-linking, Project cross-navigation, truncation notice, Documents table consistency, required-field indicators) and the re-verification that followed. <!-- Amended -->

Exit Criteria

✓ Full navigation operational — every page (Dashboard, Projects, Notes, Knowledge, Documents, Search, Settings, AI Workspace) is nested under `app/(dashboard)/` and renders the shared sidebar, header, and skip link; verified in a real browser session (session-cookie auth, not the magic-link flow, since no real email delivery exists in this environment) across all eight routes, plus a mobile-viewport pass confirming the off-canvas sidebar opens/closes correctly and a keyboard-only pass confirming the skip link is the first Tab stop. The original create/edit/archive/convert/publish/search/settings workflow was re-run end-to-end with no console or page errors. Test data and the manual session were removed afterward. <!-- Amended -->

---

# Phase 5 — AI Layer

Objective

Implement the AI architecture.

Deliverables

- AI Orchestrator (`ai/orchestrator/AIOrchestrator.ts`) — `execute()` implemented: Context Retrieval → Prompt Builder → Provider → Response Validation, per Document 4 §3's flow. Exposes `createAIOrchestrator()`, the one factory that constructs the default provider + context retriever, so `app/api/v1/ai/chat/route.ts` never imports a concrete provider itself (Document 5 §5) <!-- Amended -->
- Provider interface (`ai/providers/AIProvider.ts`) — unchanged from the Phase 0/1 scaffold (Document 4 §7's fixed `chat`/`stream`/`embeddings`/`health` shape)
- OpenAI provider (`ai/providers/OpenAIProvider.ts`) — `chat`/`stream`/`health` wired to the `openai` SDK; `embeddings` deliberately left unimplemented (Phase 5's explicit "Do NOT implement: ... Embeddings" scope, Document 9 Phase 9 reserves it) even though the interface still declares the method <!-- Amended -->
- Prompt builder (`ai/prompts/PromptBuilder.ts`) — assembles the mode's system prompt + a JSON-Schema description of its output shape + only the non-empty assembled-context sections (Document 4 §6 "avoid prompt bloat") + the user prompt <!-- Amended -->
- Context retrieval (`ai/context/ContextRetriever.ts`'s `RepositoryContextRetriever`, reads via the Repository layer — Document 13 §4, Amendment 3) — implements all six Document 4 §6 priorities: Active Project, Active Document (explicit `knowledgeIds`), Related Knowledge (full-text ranked via `SearchRepository`), Previous Conversation, Global Knowledge (`KnowledgeRepository.findGlobal`, added for this), User Preferences. Ownership scoping applied independently for `projectId`/`conversationId` <!-- Amended -->
- Prompt templates (Document 12) — `ai/prompts/templates.ts`, all five templates (THINK/VALIDATE/DOCUMENT/IMPLEMENT Stage 1/Stage 2) sourced verbatim, version `1.0`
- Response validation — `ai/schemas/ModeOutputSchemas.ts`, one `.strict()` Zod schema per mode (+ IMPLEMENT's two stages); `.strict()` is what enforces Document 12 §7's "role compliance" check (cross-mode leakage, e.g. a THINK response containing `files`, fails as an unrecognized key)
- AI API — `POST /api/v1/ai/chat` (Document 8 §14). The Route Handler validates the request, calls `AIOrchestrator.execute()` directly ("the route handler delegates to the AI Orchestrator" — Doc 8 §14), then calls the new `AIChatService` (`features/ai/services/AIChatService.ts`) to persist the Conversation/Message turn and its audit entry — an ordinary Component → Route Handler → Service → Repository → Prisma call made *after* the Orchestrator's response has already passed validation, since the Orchestrator itself never writes to the database (Document 4 §2) <!-- Amended -->

Modes

- THINK
- VALIDATE
- DOCUMENT
- IMPLEMENT

Exit Criteria

✓ AI requests execute through Orchestrator only — `app/api/v1/ai/chat/route.ts` is the only Route Handler that touches `ai/` at all, and only via `createAIOrchestrator()`; verified by the ESLint boundary (`no-restricted-imports` blocks `@/ai/providers/**` from every other `app/**`/`components/**` file) and by a live end-to-end request trace (session-cookie auth) through auth → Zod validation → `AIOrchestrator.execute` → `RepositoryContextRetriever` (confirmed via a real 404 `PROJECT_NOT_FOUND` for a nonexistent `projectId`, proving the ownership/existence check actually runs) → `PromptBuilder` → `OpenAIProvider.chat()`, which reached a real outbound HTTPS attempt to `api.openai.com` before failing on this environment's network egress allowlist (not a code defect — `OPENAI_API_KEY` is a dev placeholder here, same limitation Phase 4 documented for magic-link email delivery). 122 unit tests (39 new) cover `AIOrchestrator` per-mode validation (including cross-mode leakage rejection and the IMPLEMENT Stage 1/Stage 2 gate), `RepositoryContextRetriever`'s six-priority assembly and ownership checks, `PromptBuilder`'s context-omission behavior, and `AIChatService`'s persistence/audit/ownership logic. <!-- Amended -->

A read-only Pre-Phase-6 AI Architecture Review, requested before Knowledge Intelligence work, found five gaps between this implementation and its own stated intent — none architectural. A scoped **Phase 5.5 — AI Stabilization** pass closed all five: `Settings.defaultModel`/`aiTemperature` now actually drive `provider.chat()` (previously fetched but unused); explicit `knowledgeIds` now assert project ownership (previously skipped, mirroring a check every other Knowledge read path already had); a persistence failure after a successful AI response now degrades to a `200` with the response preserved and a warning, instead of discarding it; IMPLEMENT Stage 2 now requires a real Stage 1 plan in conversation history, not just the `approved: true` boolean; and a real OpenAI rate limit now surfaces as `RATE_LIMITED` instead of the generic `AI_PROVIDER_ERROR`. 137 unit tests (15 more) cover all five fixes; the general request flow and the new Stage 2 rejection path were both re-verified live. Document 13 §26 (Amendment 24) records the pass. <!-- Amended -->

---

# Phase 6 — Knowledge & Search

Objective

Implement knowledge management.

Deliverables

- Knowledge CRUD
- Markdown support
- Relationships
- Global search (full-text, MVP)
- Filters
- Tags (Document 8 §9a)
- Document linking

All seven were already delivered in Phases 3–4 (`KnowledgeService`, the Knowledge page, `SearchService`/the Search page, Document 8 §9a's Tags API). <!-- Amended -->

Future

- Semantic search
- Embeddings
- Knowledge graph

These remain explicitly out of MVP scope — Document 9 Phase 9 lists "Embeddings" and "Vector Search" by name as "intentionally excluded from MVP," and Documents 1 §9, 3 §11, 4 §14, and 8 §13 all independently treat them as post-MVP. When Phase 6 was authorized, the initial framing ("Knowledge Intelligence" = embeddings infrastructure, vector storage, hybrid retrieval) conflicted with this directly; the project owner corrected the authorization to stay inside the existing MVP boundary rather than amend five documents to match an initial recommendation. The corrected Phase 6 scope — Document 13 §27 (Amendment 25) — improved retrieval quality within PostgreSQL full-text search instead: `SearchRepository` gained `searchKnowledgeForContext`, implementing two of Document 4 §11's non-semantic ranking signals that were never wired up (Active-Project affinity, Recency decay) and eliminating an N+1 query pattern (`RepositoryContextRetriever`'s "Related Knowledge" step previously ran a search then one `findById` per result); `AIOrchestratorResponse.citations` became structured (`{id, title, reason, rank?}`) instead of bare ids, so a response can show *why* each citation was included; Related and Global Knowledge are now deduped against each other before reaching the prompt. `SearchService`/the Search page's existing `searchKnowledge` method was not touched. <!-- Amended -->

Exit Criteria

✓ Knowledge retrieval operational — already true from Phase 3–4 for CRUD/full-text search. The Phase 6 correction pass additionally verified, live against a real Postgres database (not just unit tests): a project-affinity boost correctly surfaces a same-project Knowledge entry above otherwise-equal-relevance results from other projects, and a recency boost correctly surfaces a freshly-updated entry above older equal-relevance entries. This surfaced one real bug — Postgres rejected the boost constants with `invalid input syntax for type integer`, because a bare `0`/`0.0` sharing a `GREATEST`/`CASE` expression with an interpolated float parameter let the driver infer the wrong parameter type — fixed with explicit `::float8` casts. 140 unit tests (3 more) cover the new ranking/dedup/citation behavior via fakes; a live HTTP request through the full chain (auth → context retrieval, exercising the corrected SQL for real → prompt assembly) confirmed no error before the expected network-egress failure at the provider call. <!-- Amended -->

---

# Phase 7 — Quality Assurance

Objective

Verify production readiness.

Deliverables

- Unit tests
- Integration tests
- End-to-end tests
- Accessibility review
- Performance review
- Security validation
- Documentation review

Exit Criteria

✓ All critical paths tested — a read-only Phase 7 QA & Production Readiness Audit (six reports: QA, Performance, Accessibility, Security, Production Readiness, Remaining Issues) covered every deliverable above: unit tests (150 passing), a live end-to-end + accessibility pass (axe-core 4.13.0, WCAG2A/AA, 0 violations across all 7 authenticated pages), a performance review (indexing, pagination bounds, N+1 elimination confirmed intact from Phase 6), a security review (authorization/authN coverage, SQL injection, XSS/markdown sanitization, secrets handling, `npm audit`), and a documentation review. No CRITICAL and no architectural findings — every finding was an implementation gap within already-approved architecture. <!-- Amended -->

The audit found six real gaps worth closing before Phase 8: no security headers, no rate limiting on the AI endpoint, write-time markdown sanitization present but unwired, no health-check endpoint, three HIGH-severity transitive dependency vulnerabilities, and CI never running against a live database. The project owner approved the audit and authorized a narrowly-scoped **Phase 7.5 — Production Hardening** pass closing five of the six directly and recording a risk-acceptance decision for the sixth: `next.config.ts` now sends `Content-Security-Policy`/`X-Frame-Options`/`X-Content-Type-Options`/`Referrer-Policy` on every response (plus HSTS in production); `POST /api/v1/ai/chat` is now rate-limited (20 requests/60s per user, `lib/rate-limit/RateLimiter.ts`); `sanitizeMarkdown()` is now actually called by `KnowledgeService`/`DocumentService`'s write paths, not just `renderMarkdown()`'s read-time layer; `GET /api/health` was added (public, database-connectivity check); the `postcss`/`sharp` CVEs were verified unreachable (no `next/image` or PostCSS-of-untrusted-input usage anywhere in the app) and accepted as debt rather than forcing a breaking `next` upgrade (Document 15, DEBT-009); and `ci.yml` gained a `postgres:16` service container plus a new integration test (`tests/integration/SearchRepository.integration.test.ts`, run via `npm run test:integration`) exercising the exact raw-SQL call shape that caused the Phase 6 parameter-type-inference bug, so a regression of that class now fails CI instead of only being catchable by manual verification. Document 13 §28 (Amendment 26) records the pass. <!-- Amended -->

---

# Phase 8 — Deployment

Objective

Prepare production deployment.

Deliverables

- Vercel configuration
- Environment variables
- Production database
- CI/CD
- Monitoring
- Error reporting

Exit Criteria

✓ Successful production deployment

---

# Phase 9 — Future Expansion

Reserved capabilities

- Multi-user support (see Document 11 §11)
- Knowledge Graph
- Embeddings
- Vector Search
- Plugin System
- Workflow Automation
- Background Jobs
- Notifications
- Analytics
- Local AI Providers

These features are intentionally excluded from MVP.

---

# 4. Definition of Ready

A feature may begin implementation only if:

- Requirements are documented
- Architecture approved
- Database impact identified
- API contract defined
- Dependencies resolved

---

# 5. Definition of Done

A feature is complete only if:

✓ Compiles successfully

✓ Passes linting

✓ Passes automated tests

✓ Matches architecture

✓ Matches naming conventions

✓ Uses Service + Repository pattern

✓ Uses AI Orchestrator where applicable

✓ Documentation updated

✓ No undocumented TODOs

---

# 6. Change Management

Any change affecting:

- Architecture
- Database
- Folder structure
- API contracts
- AI architecture

requires corresponding documentation updates before implementation.

Documentation remains the source of truth.

---

# 7. Implementation Rules

The implementation engineer must:

- Never redesign approved architecture.
- Never invent missing business rules.
- Stop and ask when ambiguity exists.
- Follow dependency order.
- Keep commits small and atomic.
- Update documentation alongside implementation.

---

# 8. Git Workflow

Branch naming

```
feature/<feature-name>
fix/<issue-name>
refactor/<module-name>
docs/<document-name>
```

Commit messages follow Conventional Commits.

Examples

```
feat: implement project service
fix: resolve prisma migration issue
docs: update ai architecture
refactor: simplify search service
```

---

# 9. Final Approval Gate

Implementation may begin only after:

- Documents 1–13 have been ingested. <!-- Amended: was 1-9; Documents 10-13 added per Phase 0 constitutional expansion. -->
- Conflicts have been resolved.
- Missing information has been clarified.
- The project owner issues the command:

```
START IMPLEMENTATION
```

Until that command is received:

- No code generation.
- No scaffolding.
- No architectural changes.

The implementation engineer should only analyze, validate, and ask questions.

---

END OF DOCUMENT 9
