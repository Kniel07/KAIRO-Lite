# KAIRO-Lite
## Architecture Amendments

Version: 2.2 (applied)
Status: Applied — approved by the project owner. Documents 1, 3, 4, 5, 6, 7, 8, 9, 10, and 11 have been updated in place to reflect every amendment below.

---

# 1. Purpose

This document is the formal amendment ledger requested after the Phase 0 Ingestion Report. It resolves every Critical and Important issue raised in that report. Each entry states the problem, the chosen resolution, and why the resolution preserves — rather than redesigns — the existing architecture.

No amendment here invents a new module, layer, or principle. Every resolution either (a) selects among options the existing documents already implied, (b) fills an explicitly-acknowledged gap with the smallest addition that satisfies existing text, or (c) corrects an internal inconsistency by deferring to the majority/more-specific document.

Per Document 9 §6 (Change Management): these amendments were approved by the project owner and have been applied in place to Documents 1, 3, 4, 5, 6, and 8 (each bumped to version 1.1). Every amended location carries an inline `<!-- Amended -->` marker pointing back to its entry in this document, per Document 9 §6's traceability requirement.

---

# 2. Amendment 1 — Semantic Search Scope

**Problem:** Document 1 §9 lists "Semantic Search" as MVP scope. Document 2 (Search module), Document 8 §13, and Document 4 §14 all classify semantic search / embeddings / vector search as future work. Document 3 §11 separately lists "Embeddings" and "Vector Index" under Future Tables (not MVP schema). Document 9 Phase 6 also lists semantic search under "Future," not the MVP phase deliverables.

**Chosen Solution:** Document 1 §9's MVP Scope line "Semantic Search" is amended to **"Full-Text Search (keyword-based)"**. Semantic search remains reserved for Phase 6+, exactly as three of the four other documents already state.

**Consistency Rationale:** This is not a scope cut invented by this document — it is restoring agreement between the PRD and the three documents (Architecture, Database, API Contracts) that were already internally consistent with each other. MVP full-text search is mechanically supported without new infrastructure: Document 3 §10 already requires "full-text search columns," which Document 10 §8 now concretely assigns as a GIN index on Knowledge (title + markdown). No new module or table is introduced.

**Applied text change:** Document 1 §9, MVP Scope — replace `Semantic Search` with `Full-Text Search`.

---

# 3. Amendment 2 — Repository Pattern Location

**Problem:** Document 7 §8 mandates a `Component → Route → Service → Repository → Prisma` flow, and Document 6 §22 names Repository classes, but Document 5's folder structure never lists a `repositories/` directory anywhere — not under `features/*`, not under `lib/`.

**Chosen Solution:** Add `repositories/` as a sibling folder inside each feature's existing per-feature structure (`features/<feature>/repositories/`), alongside the already-defined `components/, actions/, services/, schemas/, types/, hooks/, utils/` (Document 5 §4). Cross-cutting repositories used by more than one feature (e.g. `TagRepository`, `AuditLogRepository`) live in `lib/db/repositories/`, inside the already-existing `lib/db/` folder (Document 5 §7).

**Consistency Rationale:** This adds one folder to a pattern Document 5 already defines per-feature — it does not restructure or rename anything Document 5 specifies. It resolves the Document 7 §8 data-access chain literally, and gives Document 6 §22's Repository naming convention (`ProjectRepository`, `KnowledgeRepository`, etc.) a concrete, singular home.

**Applied text change:** Document 5 §4 — add `repositories/` to the per-feature folder list. Document 5 §7 — add one line noting `lib/db/` contains shared/cross-cutting repositories.

---

# 4. Amendment 3 — AI Orchestrator Dependency Direction

**Problem:** Document 5 §20 states the allowed dependency chain is `App → Features → AI/Lib → Prisma`, placing `ai/` below `features/` — meaning `ai/` must not depend on `features/`. But Document 4 §3 requires the Orchestrator to "load project context" and "load knowledge context" before every request, which sounds like calling `ProjectService`/`KnowledgeService` (both inside `features/`).

**Chosen Solution:** The Orchestrator's context retrieval (`ai/context/`) reads data via the **Repository layer directly** (Document 10 §6 amendment — `lib/db/repositories/` or the owning feature's `repositories/`, read-only), not via Feature Services. `ai/` and `features/` remain siblings, both depending downward on `lib/`/Prisma, exactly as Document 5 §20 already states. Feature Services may call *into* `ai/` (e.g. a "Convert Note to Knowledge" action invoking the Orchestrator) — that direction was never forbidden.

This is a narrow, explicitly-scoped exception: context retrieval is **read-only** (Document 4 §2 already forbids only "direct database *writes*," implying reads are permitted) and must independently apply ownership scoping (only load records belonging to the requesting user) inside `ai/context/`, rather than reuse a Service's full authorization logic. This duplication is intentional and minimal — it is not a general license for `ai/` to bypass Services for anything beyond context assembly.

**Consistency Rationale:** Preserves Document 5 §20's stated chain exactly, using the Repository layer (introduced in Amendment 2) as the shared dependency both `features/` and `ai/` sit above. No circular dependency is created. This directly resolves the Ingestion Report's flagged circular-dependency risk.

**Applied text change:** Document 4 §3 — add one sentence clarifying context retrieval reads via Repositories, not Services. Document 5 §20 — add one sentence stating `ai/` and `features/` are dependency siblings, both above `lib/`, neither depending on the other except Services → Orchestrator (one direction only).

---

# 5. Amendment 4 — Governance Implementation

**Problem:** Document 2 and Document 7 §7 both require a `GovernanceService` (also a Document 6 §25 reserved word), but Document 3's Core Entities include no governance table, and Document 8 has no `/governance` endpoint.

**Chosen Solution:** Governance is implemented as a **code-level + minimal config-table hybrid**, not a new CRUD subsystem:
- Naming conventions and schema validation (Document 6, Document 7) are enforced statically — ESLint rules and Zod schemas — no database table needed for these.
- Audit policy enforcement is already handled by the existing `AuditLog` entity (Document 3 §4, fully specified in Document 10 §5.10) — no new table needed for this either.
- The one genuinely dynamic governance concern — the open-ended `Knowledge.category` taxonomy (Amendment 7) and any adjustable `KnowledgeStatus` transition rules — is backed by a new minimal table, `GovernanceRule` (key/value config, specified in Document 10 §5.12), read and written by `GovernanceService`.

No new API surface is introduced for MVP; `GovernanceRule` is managed through the existing `/api/v1/settings`-style admin access pattern. A dedicated `/governance` endpoint remains reserved under Document 8 §24 Future APIs if this grows.

**Consistency Rationale:** Every Document 2 responsibility for Governance ("naming conventions, schema validation, knowledge lifecycle, audit policies") is satisfied by mechanisms that already exist elsewhere in the documentation (ESLint/Zod, AuditLog) plus one small table sized to the one concern that actually needs runtime configurability. This avoids inventing a rules-engine that no document ever asked for.

**Applied text change:** Document 3 §3 (Core Domains) — add `GovernanceRule` to the entity list, noting it is intentionally minimal. No change needed to Document 2 or Document 8.

---

# 6. Amendment 5 — Task Entity Status

**Problem:** Document 3 places `Task` under Core Entities (not Future Tables) with a full field/relationship spec, yet its own purpose line reads "Future implementation item," and no module in Documents 1, 2, 5, or 8 ever surfaces a Task UI, API, or feature folder.

**Chosen Solution:** `Task` **is** included in the Phase 2 Prisma schema and migration (Document 10 §5.6), consistent with its Core Entity placement, but is **RESERVED — schema only**: out of scope for any Repository, Service, API route, or UI in Phases 3–8. It exists as a forward-compatible schema placeholder only, consistent with Document 3's own "Future implementation item" label.

**Consistency Rationale:** This doesn't resolve the tension by picking one document over the other — it honors both simultaneously: Document 3's *schema* placement (Core Entity) and Document 3's own *scope* label (future) are both true at once, once "in the schema" and "in the product" are recognized as separate questions. No document is contradicted or overridden.

**Applied text change:** None required initially — a sequencing clarification, not a text conflict. **Updated during the Phase 2 review:** the original wording ("out of scope for any Service, API route, or UI") did not exclude Repository, and a `TaskRepository` was built during Phase 2 alongside the other 7 generic-shape repositories. On review, that repository was removed — a Repository exposes CRUD capability even with zero current callers, which is a foothold for accidental feature creep the RESERVED status is meant to prevent. Document 10 §5.6 and the Prisma schema's `Task` model comment are both updated accordingly.

---

# 7. Amendment 6 — Enum Definitions

**Problem:** `ProjectStatus`, `ProjectPriority`, `ProjectVisibility`, `KnowledgeStatus`, `TaskStatus`, `TaskPriority`, `NoteType`, `NoteSource`, `DocumentType`, `MessageRole` had no canonical value sets anywhere in Documents 1–9 (only `ProjectStatus` had an illustrative example in Document 6 §10).

**Chosen Solution:** Full canonical enum list is now defined in Document 10 (§5.1–§5.11), reproduced here as the amendment record:

| Enum | Values | Status |
|---|---|---|
| `ProjectStatus` | `ACTIVE`, `ARCHIVED`, `COMPLETED` | Sourced verbatim, Doc 6 §10 |
| `ProjectPriority` | `LOW`, `MEDIUM`, `HIGH` | Filled Gap |
| `ProjectVisibility` | `PRIVATE`, `PUBLIC` | Filled Gap |
| `NoteType` | `IDEA`, `REFERENCE`, `JOURNAL`, `TASK_DRAFT` | Filled Gap |
| `NoteSource` | `MANUAL`, `AI`, `IMPORT` | Filled Gap |
| `KnowledgeStatus` | `DRAFT`, `VALIDATED`, `DEPRECATED` | Filled Gap, maps to Doc 1 §7 workflow |
| `DocumentType` | `SPEC`, `GUIDE`, `ARCHITECTURE`, `REPORT`, `OTHER` | Filled Gap |
| `TaskStatus` | `TODO`, `IN_PROGRESS`, `DONE`, `CANCELLED` | Filled Gap |
| `TaskPriority` | `LOW`, `MEDIUM`, `HIGH` | Filled Gap |
| `MessageRole` | `USER`, `ASSISTANT`, `SYSTEM` | Filled Gap |
| `UserRole` | `OWNER`, `MEMBER` | Filled Gap |
| `Theme` | `LIGHT`, `DARK`, `SYSTEM` | Filled Gap |
| `AuditOperation` | `CREATE`, `UPDATE`, `ARCHIVE`, `RESTORE`, `DELETE`, `AI_EDIT`, `GOVERNANCE_CHANGE` | Sourced verbatim, Doc 3 §9 |
| `ActorType` | `USER`, `AI`, `SYSTEM` | Filled Gap |
| `AIMode` | `THINK`, `VALIDATE`, `DOCUMENT`, `IMPLEMENT` | Sourced verbatim, Doc 4 §4 |

**Consistency Rationale:** Where a document already gave an explicit list (`ProjectStatus`, `AuditOperation`, `AIMode`), that list is used unchanged. Every other enum is a minimal, standard set (Prisma enums can gain members later without a breaking migration), chosen to be the smallest addition that makes the already-named field usable.

**Applied text change:** Document 6 §10 — note that the `ProjectStatus` example is now the canonical, final value set (not just illustrative).

---

# 8. Amendment 7 — Knowledge Confidence Type

**Problem:** Document 3 lists a `confidence` field on `Knowledge` with no type or scale.

**Chosen Solution:** `Float`, normalized range `0.0`–`1.0`, validated at the Service boundary via Zod (`z.number().min(0).max(1)`), default `0.5`.

**Consistency Rationale:** Document 4 §9 (Response Validation) and Document 4 §13 (Structured Outputs) already frame AI outputs as needing continuous, machine-checkable confidence signals — a float preserves that precision. A closed enum (e.g. `LOW`/`MEDIUM`/`HIGH`) would lose information the AI Orchestrator's validation layer could use, and would still need a UI-layer mapping to bands for display — better to do that mapping once, in the UI, than lose precision at the schema level. This satisfies Document 7 §11's blanket "all external input must be validated" rule directly.

**Applied text change:** Document 3 §4, Knowledge fields — annotate `confidence` as `Float, 0.0–1.0`.

---

# 9. Amendment 8 — Settings Ownership

**Problem:** `Settings` (Document 3 §4) has no `userId`/owner field in its explicit field list, despite Document 3 §5's relationship diagram already showing `User → Settings`.

**Chosen Solution:** Add `userId String @unique` (1:1 with `User`) — specified fully in Document 10 §5.11.

**Consistency Rationale:** This is field-completion, not a new relationship — Document 3 §5 already asserts the relationship exists; this amendment only supplies the foreign key needed to implement what was already diagrammed.

**Applied text change:** Document 3 §4, Settings fields — add `userId` to the field list.

---

# 10. Amendment 9 — Tags API

**Problem:** `Tag` is a first-class entity (Document 3 §4) with many-to-many relationships to four other entities, but Document 8 never defines CRUD endpoints for it — tags only appear as a filter query parameter on other resources.

**Chosen Solution:** Add to Document 8:
```
GET    /api/v1/tags          List tags
POST   /api/v1/tags          Create tag
PATCH  /api/v1/tags/:id      Rename / recolor tag
DELETE /api/v1/tags/:id      Archive tag
```
Following exactly the same response envelope, versioning, pagination, and noun-only naming rules Document 8 already defines for every other resource (§3, §4, §22).

**Consistency Rationale:** Purely additive — no existing endpoint, envelope shape, or rule in Document 8 changes. It fills an omission using Document 8's own established pattern.

**Applied text change:** Document 8 — new §9a "Tags API," inserted after §9 (Projects API), matching the existing section format.

---

# 11. Amendment 10 — Conversations API

**Problem:** Document 3 fully models `Conversation` and `Message`, but Document 8 defines only `POST /api/v1/ai/chat` — there is no way to list or retrieve past conversations/messages.

**Chosen Solution:** Add to Document 8:
```
GET    /api/v1/conversations           List conversations
GET    /api/v1/conversations/:id       Conversation detail + nested messages
DELETE /api/v1/conversations/:id       Archive conversation
```
Deliberately **read/archive-only** — no `POST /api/v1/conversations/:id/messages` is added. New AI turns are still only ever produced via `/api/v1/ai/chat`, preserving Document 4 §3's rule that the Orchestrator is the sole path that generates AI-authored messages.

**Consistency Rationale:** This is a retrieval-only addition; it does not create a second way to produce AI output, so it cannot weaken the "Orchestrator is the only gateway" rule (Document 4 §15) that Document 4 treats as non-negotiable.

**Applied text change:** Document 8 — new §14a "Conversations API," inserted after §14 (AI API).

---

# 12. Additional Minor Clarification (not in the original 10-item list, closed for completeness)

**`ReviewPrompt` naming (Ingestion Report Minor Q12):** Document 6 §19's example prompt-template names includes `ReviewPrompt`, but Document 4 formally defines only four modes and Document 9 Phase 5 repeats only those four. **Resolution:** `ReviewPrompt` is confirmed as an illustrative naming example only — not a fifth mode. The "Review" stage in Document 1 §7's workflow is satisfied by VALIDATE mode's output (Document 12 §4), which already produces a review report. No document requires a text change; this is a confirmation, not an amendment.

---

# 13. Amendment 11 — Soft-Delete Enforcement Mechanism (Phase 2 review)

**Problem:** Document 10 §4 originally specified soft-delete filtering "at the Repository layer (Repository, not Prisma middleware)." During Phase 2 review, this was identified as enforcing the invariant by convention only — every repository had to remember to apply `notArchived()`, nothing structurally prevented a new method (or a caller bypassing the repository entirely) from forgetting it.

**Chosen Solution:** A Prisma Client Extension (`lib/db/soft-delete-extension.ts`), applied once to the shared Prisma Client, auto-injects `archivedAt: null` into read operations on soft-deletable models unless the caller's `where` already mentions `archivedAt`. Verified live: calling `prisma.project.findMany()` directly — bypassing every repository — still excludes an archived row.

**Consistency Rationale:** This doesn't contradict Document 10 §4's original text so much as correct an implementation detail within it — the goal ("default queries exclude archived records," Document 3 §8) is unchanged; only the mechanism moved from a per-call convention to a single infrastructure-layer guarantee, which is a strictly stronger implementation of the same rule, not a different rule. Escape hatches (`findArchived()`, `findIncludingArchived()`, `restore()`) preserve every existing capability.

**Applied text change:** Document 10 §4 rewritten to describe the extension as the enforcement mechanism. Document 3 §8 gained a one-line cross-reference. Document 7 §8 gained a new rule: raw SQL bypasses the extension, so every `$queryRaw`/`$executeRaw` use must document its own `archivedAt` handling.

---

# 14. Amendment 12 — Raw SQL Soft-Delete Documentation Rule

**Problem:** The Prisma Client Extension from Amendment 11 only intercepts Prisma Client's model methods. `$queryRaw`/`$executeRaw` — which the future `SearchRepository` (Phase 6) will use for full-text search over `searchVector` — bypass it entirely. Nothing prevented a future raw query from silently leaking archived rows.

**Chosen Solution:** A new rule in Document 7 §8: every raw SQL query must explicitly document its soft-delete behavior — either include an `archivedAt` filter, or comment explaining why it intentionally doesn't. This is a documentation/review requirement (Document 7 §8's existing category — coding standards), not a new technical mechanism; raw SQL is, by definition, outside what a Prisma-level extension can reach.

**Consistency Rationale:** Document 7 already governs code-review-enforced conventions (e.g. "no `ts-ignore` without justification," §3). This rule is the same shape: it doesn't invent new infrastructure, it closes a documented, known gap in existing infrastructure (Amendment 11) the same way Document 7's other "must justify in a comment" rules do.

**Applied text change:** Document 7 §8, new paragraph. Document 10 §4, "Limitation" note added.

---

# 15. Amendment 13 — Archived-User Authentication Behavior

**Problem:** Amendment 11's extension applies to the same shared Prisma Client the Auth.js Prisma Adapter uses (Document 11 §2). This has a real consequence — an archived `User` cannot authenticate — that no document stated.

**Chosen Solution:** Document this as intended behavior, not a special case. No code change: it already happens as a direct, correct consequence of Amendment 11 applying globally to the shared client, exactly as designed.

**Consistency Rationale:** Document 1 §4's core principle "Knowledge should never be lost" is about data, not access — soft-deleting a user revoking their access is consistent with, not contrary to, how soft delete is documented to work everywhere else (Document 3 §8: archived records are excluded from default resolution). No document ever promised archived users could still sign in; this is simply the first place that consequence became concrete enough to write down.

**Applied text change:** Document 11 §6, new paragraph.

---

# 16. Amendment 14 — `process.env` Centralization Enforcement

**Problem:** Document 7 §13 has always required environment access to go through `config/env.ts` — but nothing checked it. The Phase 2 Architecture Compliance Matrix (Document 14) flagged this as a `CONVENTION`-only rule, meaning a real gap: any new file could write `process.env.SOMETHING` directly and nothing would catch it.

**Chosen Solution:** An ESLint `no-restricted-syntax` rule matching the `process.env` AST node itself (catching every access form — `process.env.X`, `process.env["X"]`, bare `process.env`), scoped to all TypeScript files except `config/env.ts` (the one sanctioned reader), `prisma.config.ts` (a Prisma-CLI-loaded file that runs before the app's module graph exists, already exempt for the same reason it needs its own `dotenv/config` import), and `tests/unit/env.test.ts` (which specifically tests `config/env.ts`'s validation behavior and must mutate `process.env` directly to build fixtures). One incidental fix alongside it: `lib/db/client.ts` was itself using `process.env.NODE_ENV` directly for its dev/hot-reload caching check — switched to `env.NODE_ENV` from the centralized loader, closing the one real violation that existed before the rule could be added cleanly.

**Consistency Rationale:** Identical shape to the Component→Prisma and `ai/`→`features/` boundaries already enforced this way (Document 5 §20) — a documented rule gets an ESLint rule once a concrete violation shape exists to write a selector against. Verified live: a deliberate `process.env.OPENAI_API_KEY` access in a throwaway file was confirmed to fail lint before being removed.

**Applied text change:** None to the rule text itself (Document 7 §13 was already correct) — this closes the enforcement gap Document 14 identified, recorded here for traceability.

---

# 17. Amendment 15 — Markdown Sanitization Implemented

**Problem:** Document 7 §21 requires markdown sanitization as a mandatory security control. `lib/markdown/` held only a `.gitkeep` — this was not a convention gap, it was an outright missing requirement, flagged explicitly by Document 14.

**Chosen Solution:** `lib/markdown/sanitize.ts` (`safeHtml()` for raw HTML strings, `sanitizeMarkdown()` for stripping embedded HTML from markdown source text — defense in depth, write-time) and `lib/markdown/render.ts` (`renderMarkdown()` — a `remark`/`rehype` pipeline with `rehype-sanitize` producing safe HTML, defense in depth, read-time). Both are pure `lib/` functions, not components — no UI was built (Document 5 §5: components render, they don't own sanitization logic; a future `MarkdownViewer` component, Phase 4, would call `renderMarkdown()` and is out of scope here). Proven against real XSS payloads (`<script>`, `onerror`, `javascript:` URLs) in `tests/unit/markdown.test.ts`, not just compiled.

**Consistency Rationale:** Two independent sanitization layers (source-text stripping and rendered-HTML sanitization) rather than relying on either alone — consistent with Document 7 §21's blanket "never trust client input" posture applied twice rather than once.

**Applied text change:** None to Document 7 §21's rule text (it was already correct) — this closes the implementation gap Document 14 identified.

---

# 18. Amendment 16 — Environment Validation Failure-Path Tests

**Problem:** Document 14 noted `config/env.ts`'s failure behavior was "implemented, not exercised" — the success path had been run many times (every `npm run build`/`npm run dev`), but no test proved a missing or malformed variable actually failed the way Document 7 §11-13 expects.

**Chosen Solution:** `tests/unit/env.test.ts` — dynamically re-imports `config/env.ts` (via `vi.resetModules()`) against mutated `process.env` states: missing `DATABASE_URL`, missing `OPENAI_API_KEY`, malformed `AUTH_URL`, invalid `KAIRO_OWNER_EMAIL`, multiple missing keys at once, and — matching Document 7 §12's "never log secrets" — a case that asserts a real-looking secret value never appears in the thrown error message.

**Consistency Rationale:** Same standard as Amendment 15 — a documented behavior is only trustworthy once it's been made to fail on purpose and observed failing correctly, not just reasoned about.

**Applied text change:** None to Document 7's rule text — this closes the verification gap Document 14 identified.

---

# 19. Amendment 17 — CI/CD Pipeline

**Problem:** Document 7 §23 requires every PR to compile, lint, and pass tests, with "no broken main branch." Document 14 identified this as the single largest gap in the entire constitution: zero automation existed. Every green `tsc`/`eslint`/`prettier`/`build` result up to that point came from manual runs in this session — nothing would have stopped a broken commit from being pushed.

**Chosen Solution:** `.github/workflows/ci.yml` — on every push and pull request: install, generate the Prisma client (required before typecheck/lint/build, since `generated/` is gitignored), `tsc --noEmit`, `eslint`, `prettier --check`, `prisma validate`, `npm test`, `next build`. Uses CI-only dummy environment values (never real secrets) — verified this is sufficient by running the entire sequence locally with PostgreSQL stopped entirely; `next build` does not query the database (no page does yet), so no live database service is needed in CI for this scope.

**Consistency Rationale:** Document 9 Phase 0 listed "GitHub Actions (optional)" and it was skipped at the time. Document 14's matrix made the cost of that skip concrete rather than abstract, which is exactly what a compliance matrix is for — this amendment is the direct result of that tool doing its job.

**Applied text change:** Document 9, Phase 0 deliverables — the "GitHub Actions (optional)" line annotated with when and why it was actually delivered.

---

# 20. Amendment 18 — Phase 3 Backend Services Architecture

**Problem:** Document 9's Phase 3 authorization added a requirement not previously written anywhere in the constitution: multi-write Service operations (e.g. an entity write plus its `AuditLog` row) must execute atomically inside a single Prisma transaction, and Repository interfaces must support participating in a shared transaction context rather than each opening independent ones (Document 7 §8 said Services "use Repository interfaces only" and "generate audit records... as part of the business transaction," but never specified the mechanism). Separately, two real cross-feature dependencies surfaced during implementation that Document 7 §7's "never call another Service unless explicitly required" rule doesn't by itself resolve: `KnowledgeService`'s `category` field is governed by the `GovernanceRule` config table (Document 13 §4 Amendment 4), and `NotesService`'s "Convert to Knowledge"/"Convert to Document" operations (Document 8 §11) produce `Knowledge`/`Document` rows.

**Chosen Solution:**
- **Transaction boundaries:** `lib/db/client.ts` exports `Db = typeof prisma`; `lib/db/transaction.ts` exports `withTransaction<T>(fn: (tx: Db) => Promise<T>)`, wrapping `prisma.$transaction`. Every Repository constructor now accepts `client: Db = prisma` (defaulting to the global client) instead of importing `prisma` at module scope. A Service's write method opens one `withTransaction` and constructs fresh, tx-scoped Repository instances *inside* the callback (e.g. `new ProjectRepository(tx)`), so the entity write and its audit write share one transaction. Read methods (`get`/`list`) use the constructor-injected default-client Repository instances instead — no transaction needed for a single read. Verified live: forcing the second write (the audit write) in a `ProjectService.create()`-shaped transaction to fail with a real Postgres FK violation left zero trace of the entity write afterward, proving genuine rollback, not just code that looks transactional.
- **Governance category policy:** `KnowledgeService` and `NotesService` both read the `GovernanceRule` row keyed `"knowledge.allowedCategories"` (a value convention introduced here — a JSON array of allowed strings; an absent rule or empty/malformed value means no restriction is configured) directly via `GovernanceRuleRepositoryLike`, not by calling `GovernanceService`. `GovernanceService` remains the sole *writer* of `GovernanceRule` (Document 13 §4's own wording), consistent with Document 7 §8 permitting a Service to depend on any Repository interface, not only its own feature's. This also resolves a build-order dependency the Phase 3 authorization's own service list would otherwise create (`GovernanceService` is specified after `KnowledgeService`).
- **Note conversion:** `NotesService.convertToKnowledge`/`convertToDocument` write directly via `KnowledgeRepositoryLike`/`DocumentRepositoryLike` (constructed tx-scoped, same as every other write) rather than calling `KnowledgeService`/`DocumentService`. Document 8 §11 requires the *capability*, not a specific call path, and this avoids both an unnecessary Service-to-Service edge and the same build-order issue (`DocumentService` is specified after `NotesService`). The cost, accepted deliberately: the category-governance check and the project-ownership check are duplicated at the point of conversion rather than inherited from a call into `KnowledgeService`/`DocumentService`.
- **Shared authorization helper:** `features/shared/services/assertProjectOwnership.ts` — `KnowledgeService`, `NotesService`, and `DocumentService` all need the identical "does this `Project` belong to the caller" check (Document 10 §5.3-5.5, all three reference `Project` optionally or required), checked via `findByIdIncludingArchived` rather than `findById` so archiving a Project (a visibility/lifecycle state) doesn't strip access to records already attached to it.
- **`ProjectRepository.findBySlugIncludingArchived`:** added alongside the existing `findBySlug`. `Project.slug` (Document 10 §5.2) is unique at the database level across archived and active rows alike, so `ProjectService`'s slug-collision check needed to look past the soft-delete extension's default exclusion to stay correct.
- **`NotFoundEntity` extended:** `lib/utils/errors.ts`'s union gained `"NOTE"` (previously `"PROJECT" | "KNOWLEDGE" | "DOCUMENT"`), needed once `NotesService` existed.

**Consistency Rationale:** None of this changes a public Service method's external behavior or any constitutional rule already applied — it fills in mechanism where Document 7/9/13 established the requirement but not the "how," using the same "Repository-only, no invented Service-to-Service edges" discipline the constitution already establishes elsewhere (Document 5 §20 / Amendment 3's AI Orchestrator dependency-direction rule is the same shape of decision).

**Applied text change:** Document 7 §8 — add one sentence: Repository constructors accept an optional transaction-scoped client, and a Service performing more than one write opens exactly one `withTransaction` around all of them. Document 9, Phase 3 — Modules list annotated: `GovernanceService`'s `GovernanceRule` writes are read directly by `KnowledgeService`/`NotesService` via Repository, not via a Service call.

---

# 21. Amendment 19 — Component/Page → Service Boundary Enforcement

**Problem:** Document 7 §8's chain (`Component → Route → Service → Repository → Prisma`, "no shortcuts") was always the rule, but it was unenforceable before Phase 3 — no Service existed for a Component to shortcut to. The Document 14 Revision 3 pre-Phase-4 audit found this had become a real, live gap the moment Phase 3 landed: nothing blocked `components/**` or `app/**` from importing a Service directly, confirmed by a deliberate violating import that compiled and linted clean.

**Chosen Solution:** An ESLint `no-restricted-imports` rule blocking `@/features/*/services/**` from `components/**` and `app/**`, with `app/api/**` (Route Handlers) explicitly exempt — that's the one place in the chain a Service call belongs. Identical shape to every other dependency-boundary rule in `eslint.config.js` (Component→Prisma, `ai/`→`features/`, Service→Prisma). Verified live: deliberate violations in both a page and a component file were confirmed to fail lint with the expected message; the identical import inside a Route Handler was confirmed to still pass; all scratch files were then removed and the full verification suite (`tsc`, `eslint`, `prettier`, `prisma validate`, 78 tests) re-confirmed clean.

**Consistency Rationale:** No new rule was invented — this is Document 7 §8's existing chain, automated the same way every other layer of it already is. The exemption boundary (`app/api/**` only) was not a judgment call requiring a design decision: Document 7 §8's own chain names exactly one place between Component and Service, so the exemption has exactly one shape.

**Applied text change:** None to the rule text itself (Document 7 §8 already stated the chain) — this closes the enforcement gap Document 14 Revision 3 identified, recorded here for traceability, same pattern as Amendment 14.

---

---

# 22. Amendment 20 — Phase 4 Frontend Architecture

**Problem:** Document 9's Phase 4 authorization required Settings as a page, but Document 9's Phase 3 module list never included `SettingsService` — the Component → Route → Service → Repository → Prisma chain (Document 7 §8) meant the Settings Route Handler had nothing to call. Separately, three implementation-level decisions needed making that no document specified: how Client Components reach Route Handlers without violating the Component/page → Service boundary (Amendment 19), whether to add new UI-library dependencies for a modal/select, and how the Markdown editor should relate to the existing sanitization infrastructure.

**Chosen Solution:**
- **`SettingsService`:** added following the exact shape already specified in Document 10 §5.11 and Document 8 §15 — `get`/`update`, auto-provisioning a default row on first access (audited as `CREATE`), explicit updates audited as `UPDATE`. A mechanical gap-fill, not a redesign.
- **Client data fetching:** every list/detail/mutation in `features/*/components/**` goes through a `features/*/hooks/*.ts` file using TanStack Query, calling `fetch()` against `/api/v1/**` (via `lib/utils/api-client.ts`'s envelope-unwrapping helper) — never a Service import, which the existing ESLint boundary (Amendment 19) already forbids outside `app/api/**`. Route Handlers resolve the session via `lib/auth/session.ts`'s `requireUserId()`, validate with the same Zod schemas Phase 3's Services already use, and call exactly one Service method each.
- **No new UI-library dependencies:** `components/ui/dialog.tsx` is built on the native `<dialog>` element (not `@radix-ui/react-dialog`, which isn't installed) — `showModal()` gives focus trapping, Escape-to-close, and a real backdrop without adding a package. `components/ui/select.tsx` is a native `<select>` for the same reason — full keyboard/screen-reader support for free.
- **`MarkdownEditor` (`components/editors/`):** calls `lib/markdown/render.ts`'s existing `renderMarkdown()` for its Preview tab — the same sanitized rendering pipeline built in the Infrastructure Hardening Sprint (Amendment 15), not a second rendering path. Used by Knowledge and Document forms only — `Note.content` is plain text (Document 10 §5.3 names the field `content`, not `markdown`), so Notes forms use a plain `Textarea`.
- **Form/select validation fix:** a native `<select>`'s empty/placeholder option submits `""`, which `z.string().uuid().optional()` schemas (correct at the API layer) reject — silently, since `handleSubmit` simply never calls `onSubmit` and no form here rendered an error for that specific field. Fixed via React Hook Form's `register(name, { setValueAs })`, not a Zod `.preprocess()` wrapper around the schema (confirmed by trying it: `.preprocess()` changes the schema's inferred input type to `unknown`, which breaks `useForm<T>`'s single type parameter). Found and fixed via real browser testing (session-cookie auth, since no real email delivery exists in this environment) — the create-Note flow silently did nothing before this fix.

**Consistency Rationale:** Every decision here either fills a mechanical gap the constitution already fully specified elsewhere (`SettingsService`) or chooses the option that avoids inventing new dependencies/patterns beyond what Documents 1–13 already established (reusing `lib/markdown`, reusing the Amendment 19 boundary, avoiding new UI packages).

**Applied text change:** Document 9, Phase 4 — Pages/Deliverables/Exit Criteria annotated with the `SettingsService` gap-fill, the `MarkdownEditor`'s reuse of existing infrastructure, the Route Handlers built alongside the pages, and the real-browser verification performed.

---

# 23. Amendment 21 — Phase 4 UX Corrections (Pre-Phase-5 Review)

**Problem:** A read-only UX review conducted before authorizing Phase 5 found that Document 9's Phase 4 exit criterion — "Full navigation operational" — was not actually met. `app/(dashboard)/layout.tsx` defines the shared shell (sidebar, header, skip link, error boundary), but only `app/(dashboard)/page.tsx` (the Dashboard, `/`) was physically nested inside that route group; `app/projects`, `app/notes`, `app/knowledge`, `app/documents`, `app/search`, `app/settings`, and `app/ai` were sibling top-level directories that never inherited it. Every page except the Dashboard rendered with no sidebar, no header, and no way to reach any other section except the browser back button. The review also found six smaller but genuine defects: no responsive sidebar behavior, `window.confirm()` used for archive actions instead of the app's own `Dialog` system, Search results linking to the generic Knowledge list instead of the specific matched item, no cross-navigation from a Project to its scoped Notes/Knowledge/Documents, silent truncation past the 100-item fetch cap, inconsistent Type/Status treatment in the Documents table, and no required-field indicators on forms. The project owner reopened Phase 4 rather than authorizing Phase 5, and authorized these eight corrections in a fixed priority order, explicitly scoped to UI/Route Handler changes only — no Service, Repository, or architectural changes, no AI work.

**Chosen Solution (in the authorized priority order):**
1. **Route group fix:** moved all seven pages (plus `app/projects/[id]`) into `app/(dashboard)/` via `git mv` — a file relocation, not a redesign. Verified via a fresh Chromium session that every route now renders the sidebar and header, and via `npm run build` that all 25 routes still generate correctly.
2. **Responsive sidebar:** added `components/navigation/SidebarContext.tsx` (a small React Context for open/close state, Component-layer only) and `components/navigation/Sidebar.tsx` (off-canvas below `md`, static above it), with a hamburger toggle added to `Header.tsx`. `NavLink` gained an `onNavigate` callback so clicking a link closes the mobile sidebar.
3. **`ConfirmDialog`:** `components/ui/confirm-dialog.tsx`, built on the existing `Dialog` primitive (same one every create/edit flow already uses), replacing all five `window.confirm()` call sites (`ProjectsView`, `ProjectDetailView`, `NotesView`, `KnowledgeView`, `DocumentsView`). Added a `destructive` variant to `components/ui/button.tsx` (the `--destructive` CSS token already existed; only `default`/`outline`/`ghost` variants existed on the Button component itself).
4. **Search result routing:** `SearchService.searchKnowledge` only ever returns Knowledge entries (Document 13 §2, Amendment 1 — Search is Knowledge-only, not a review error, confirmed against `SearchRepository`/`SearchService`), so "route by resource type" reduces to "link to the specific Knowledge item" rather than a Note/Knowledge/Document dispatch. Search results now link to `/knowledge?open=<id>`; `KnowledgeView` reads that param and opens the existing `EditKnowledgeDialog` for the matched item, then strips the param via `router.replace`. No new detail route was added.
5. **Project cross-navigation:** `ProjectDetailView` gained three links to `/notes?projectId=<id>`, `/knowledge?projectId=<id>`, `/documents?projectId=<id>`. `KnowledgeView` already supported a server-side `projectId` filter (`useKnowledgeList(projectId)`); `DocumentsView` now seeds its existing project-selector state from the URL param instead of defaulting to the first project; `NotesView` filters its already-fetched list client-side by `projectId`, since the Notes API has no server-side project filter and adding one was out of scope ("no Service/Repository changes unless absolutely required").
6. **Truncation notice:** `components/feedback/TruncationNotice.tsx`, shown on Projects/Notes/Knowledge/Documents whenever `meta.total` exceeds the fetched `pageSize=100` — using `meta` every list hook already returns. A full pager was explicitly out of scope.
7. **Documents table consistency:** the `Type` column now renders as a `Badge` (`variant="outline"`) instead of plain text, matching the existing `Status` badge in the same row.
8. **Required-field indicators:** `components/ui/required-mark.tsx`, plus a "Fields marked * are required" legend, added to every schema-required field (no `.optional()`) across `ProjectForm`, `NoteForm`, `KnowledgeForm`, and `DocumentForm` (the create form only — `DocumentEditForm`'s schema is `.partial()`, so it has no required fields).

**Consistency Rationale:** Every change stays inside the Component/Route Handler layer the Phase 4 UX review was scoped to. No Service, Repository, or Prisma code changed; no new UI-library dependency was added (the confirm dialog and sidebar both reuse existing primitives/patterns); the Search fix corrected a factual error in the original review's premise (it assumed Search could return Notes/Documents, which the architecture never allowed) rather than inventing new search-routing logic.

**Applied text change:** Document 9, Phase 4 — Exit Criteria rewritten to describe the corrected navigation behavior and to note the review-then-correction cycle, since "Full navigation operational" is now genuinely true rather than true-on-one-route.

---

# 24. Amendment 22 — `ai/` ESLint Boundary Correction (Phase 5)

**Problem:** Document 5 §20's text says `ai/context/` "reads project, knowledge, and conversation data via the Repository layer... directly — never via Feature Services," which requires it to import from `features/*/repositories/**` (every domain Repository — Project, Knowledge, Conversation, Message, Settings — is feature-owned per Document 13 §3, Amendment 2). The `eslint.config.js` rule enforcing this instead blocked all of `@/features/**` from `ai/**`, with no carve-out for repositories. Attempting to implement `RepositoryContextRetriever` (Phase 5) against the actual constitution surfaced the contradiction directly — the documented architecture was unimplementable under the enforced rule.

**Chosen Solution:** Narrowed the `ai/**` restricted-imports rule from blocking `@/features/**` entirely to blocking only `@/features/*/services/**`, `@/features/*/components/**`, `@/features/*/hooks/**`, and `@/features/*/actions/**` — mirroring the precision the analogous Components/pages → Services rule already uses (that rule blocks `@/features/*/services/*` specifically, not all of `features/**`, so Route Handlers can still reach it). This makes the enforcement match what Document 5 §20's prose already specified; no text change to Document 5 itself.

**Consistency Rationale:** This is a mechanical correction of an over-broad ESLint pattern, not a new architectural decision — the constitution already said Repositories were fair game for `ai/context/`, only the lint rule disagreed. Blocking Services/Components/hooks/actions still fully prevents `ai/` from depending on business logic or UI code, which was the rule's actual intent.

**Applied text change:** None to Document 5. `eslint.config.js` updated in place (not a `docs/` file, but recorded here per this document's own stated purpose of being where every constitutional-adjacent change is traceable from).

---

# 25. Amendment 23 — Phase 5 AI Layer Architecture

**Problem:** Document 4/Document 12 specify the AI Layer's architecture and prompt contracts in detail, but several concrete implementation choices were left to Phase 5, same as every prior phase: how the Route Handler avoids importing a concrete provider while still "delegating to the AI Orchestrator" (Doc 8 §14), how response validation mechanically enforces Document 12 §7's "role compliance" check, how "Global Knowledge" (Doc 4 §6 priority 5) is fetched when no existing Repository method covered it, and how the AI-specific request flow (Doc 8 §2, no Service node) reconciles with "AI-assisted modifications generate audit entries" (Doc 8 §21) when the Orchestrator itself is forbidden from writing to the database (Doc 4 §2).

**Chosen Solution:**
- **`createAIOrchestrator()` factory** (`ai/orchestrator/AIOrchestrator.ts`): the Route Handler calls this instead of constructing `OpenAIProvider`/`RepositoryContextRetriever` itself, so `app/api/v1/ai/chat/route.ts` never imports `@/ai/providers` at all — the existing ESLint rule blocking that import from every `app/**` file (Document 5 §5, no `app/api/**` exemption) is satisfied without weakening it, and "No UI component or API route may communicate directly with an LLM" (Doc 4 §3) holds structurally, not just by convention.
- **Response validation via `.strict()` Zod schemas** (`ai/schemas/ModeOutputSchemas.ts`): Document 12 §7 check 5 ("role compliance... cross-mode leakage is treated as a schema failure") is enforced mechanically — `.strict()` rejects any key the schema doesn't declare, so a THINK response smuggling a `files` field fails validation the same way a missing required field would, with no separate leakage-detection logic needed.
- **`response_format: { type: "json_object" }`** set unconditionally inside `OpenAIProvider.chat()` (not added to the provider-agnostic `AIChatRequest`, which stays exactly as Document 4 §7 specifies it: `messages`/`model`/`temperature`) — every mode's system prompt already instructs JSON-only output, and this is a reliability improvement layered on top of, not a substitute for, the Zod validation that remains the authoritative check.
- **`KnowledgeRepository.findGlobal()`** — added (mirrors the existing `findByProject`) because Document 4 §6 priority 5, "Global Knowledge" (project-less entries), had no existing Repository method to read it with. A mechanical gap-fill, not a new business rule.
- **`ConversationRepositoryLike`/`MessageRepositoryLike` interfaces** — added to `features/ai/repositories/` (the concrete classes already matched this shape from Phase 2/3; Phase 5 is when the first real consumers — `RepositoryContextRetriever`, `AIChatService` — arrived and needed the DI-friendly interface every other Repository already has).
- **`CONVERSATION` added to `NotFoundEntity`** (`lib/utils/errors.ts`) — the same extensible union `NOTE` was added to in Phase 3, now covering the one entity Phase 5 introduces that can 404.
- **`AIChatService`** (`features/ai/services/AIChatService.ts`) — an ordinary Service (normal Component → Route Handler → Service → Repository → Prisma chain, Doc 7 §8), called by the Route Handler *after* `AIOrchestrator.execute()` succeeds, to persist the Conversation/Message rows and audit entry Document 8 §21 requires for "AI-assisted modifications." This is how Document 8 §2's AI-specific flow diagram (no Service node between Route Handler and Orchestrator) coexists with Document 4 §2's "AI layer is NOT responsible for... Writing directly to the database": the Orchestrator's flow and the persistence flow are two separate, sibling Route Handler calls, not one blended one.
- **Embeddings intentionally left unimplemented** in `OpenAIProvider` — Document 9's Phase 5 authorization explicitly excludes "Embeddings"/"Vector search" (Document 9 Phase 9 reserves them); the method still exists (Document 4 §7's provider interface requires it) but throws, and nothing in the Phase 5 pipeline calls it.
- **Document 12's status corrected** from "Proposed (Amendment — pending approval)" to "Applied" — Document 8 §23 already referenced Document 12 §6 as authoritative before this phase began, so the "pending approval" marker was stale, not a live open question; this phase's implementation is what made the staleness worth fixing.

**Consistency Rationale:** Every choice above either fills a gap the constitution already anticipated (Global Knowledge, the persistence Service, the `NotFoundEntity` extension pattern) or enforces existing text more precisely (the factory function, `.strict()` schemas) — none introduce a new layer, a new dependency direction, or a capability outside Document 9 Phase 5's explicit scope.

**Applied text change:** Document 9, Phase 5 — Deliverables and Exit Criteria rewritten to describe the actual implementation and its verification (live request trace, 122 passing unit tests). Document 12 — status changed from Proposed to Applied (no text/prompt changes — the five templates were implemented verbatim).

---

# 26. Amendment 24 — Phase 5.5 AI Stabilization

**Problem:** A read-only Pre-Phase-6 AI Architecture Review (requested before authorizing Knowledge Intelligence work) audited the Phase 5 implementation against its own stated intent rather than its existence, and found five behavioral gaps — none architectural, all inside behavior the architecture already allowed: (1) `Settings.defaultModel`/`aiTemperature` (Document 10 §5.11) were fetched into context and described in the prompt as text, but never actually passed to `provider.chat()` — the Settings page promised AI-behavior control it didn't deliver; (2) explicit `knowledgeIds` ("Active Document," Doc 4 §6 priority 2) skipped the project-ownership check every other Knowledge read path enforces (`KnowledgeService.assertAccess`, Phase 3); (3) a successful, schema-validated AI response was discarded if the subsequent `AIChatService.recordTurn()` persistence call failed, forcing the caller to regenerate (and re-pay for) an answer that had already succeeded; (4) `approved: true` alone was trusted to unlock IMPLEMENT Stage 2, with nothing verifying a real Stage 1 plan had ever been produced — weakening Document 4 §1's "Human approval always overrides AI suggestions" to a bare boolean; (5) a real OpenAI rate limit (429) surfaced as the same generic `AI_PROVIDER_ERROR` as every other provider failure, even though `RateLimitedError`/`RATE_LIMITED` (Document 8 §18) already existed unused.

**Chosen Solution:**
- **Settings applied to the provider call:** `AIOrchestrator.execute()` now passes `context.userPreferences?.defaultModel`/`aiTemperature` into `provider.chat()`, falling through to `OpenAIProvider`'s own `aiConfig` defaults when no Settings row exists or a field is unset. `PromptBuilder`'s descriptive text is unchanged (harmless, complementary) — this fix is about the real API parameters, not the prompt text.
- **Ownership check for explicit `knowledgeIds`:** `RepositoryContextRetriever.loadActiveKnowledge` now asserts ownership for every resolved entry via a new private `assertKnowledgeOwnership`, mirroring `KnowledgeService.assertAccess`'s exact rule (project-scoped entries inherit the project's ownership; project-less "global" entries need no check, per Document 11 §2's single-user MVP). Reimplemented locally rather than importing `assertProjectOwnership` — that helper lives under `features/shared/services/`, which the `ai/` ESLint boundary (Document 13 §24, Amendment 22) correctly still blocks; the two-line rule itself is small enough to duplicate rather than justify a new shared location `ai/` and `features/` could both reach.
- **AI response preserved on persistence failure:** the Route Handler now wraps `AIChatService.recordTurn()` in its own `try`/`catch`, separate from every earlier failure in the request. On success: `201` with the response and a real `conversationId`, as before. On a persistence failure: `200` with the same validated response, `citations`, and `usage`, plus `conversationId: null` and a `warning` field explaining the turn wasn't saved — the failure is logged (`logger.error`, actor/action/entity/result shape) but never discards a response that already succeeded.
- **Stage 1 → Stage 2 approval requires real evidence:** `AIOrchestrator` gained `assertStage2Approval`, called right after context retrieval (before the provider is invoked, so a doomed request never burns a real API call). It rejects (`ValidationError`, 400) unless `context.conversationHistory` contains an `ASSISTANT` message with `mode: "IMPLEMENT"` whose content parses as a valid `implementStage1OutputSchema`. `approved: true` remains a required, caller-only flag (the Orchestrator still never sets it autonomously) — this adds a second, structural requirement on top of it, rather than replacing it. No new field, table, or "approval marker" was introduced (that would be an architecture change, out of this phase's scope) — the plan's own presence in conversation history *is* the marker.
- **Rate limits normalized:** `OpenAIProvider` gained a private `mapProviderError`, checked in both `chat()`'s and `stream()`'s catch blocks: `error instanceof OpenAI.RateLimitError` (the SDK's own typed 429) now throws the existing `RateLimitedError` (`RATE_LIMITED`, 429) instead of the generic `AIProviderError` (502) every other provider failure still uses.

**Consistency Rationale:** Every fix closes a gap between documented intent and actual behavior inside the Phase 5 architecture — none required a new layer, dependency direction, table, or capability. The review that found these explicitly noted "if the architecture were wrong, these would require redesign. Instead, they require refinement," which is exactly what this amendment records.

**Applied text change:** None to Documents 1–12 (no architectural text was inconsistent — only the code was). Document 9's Phase 5 section is not re-opened; this is recorded as its own amendment since it's a distinct, dated correction pass, the same pattern Amendment 21 (Phase 4 UX Corrections) established for Phase 4.

---

# 27. Amendment 25 — Phase 6 Corrected Scope (Knowledge Intelligence Within MVP)

**Problem:** Phase 6 was initially authorized as "Knowledge Intelligence" scoped to embeddings infrastructure, vector storage, and hybrid retrieval. This directly conflicted with the constitution as it stood: Document 1 §9 (Amendment 1) defers semantic search; Document 3 §11 lists Embeddings/Vector Index under Future Tables; Document 4 §14 lists Semantic search/Embeddings as "Reserved for future releases"; Document 8 §13 states MVP search is full-text only, "Future: Semantic Search, Vector Search"; and Document 9's own Phase 6 section already exists, already lists Knowledge CRUD/full-text search/tags/linking as its deliverables (all completed in Phases 3–4), and lists "Semantic search / Embeddings / Knowledge graph" under its own **Future** subsection. Document 9 Phase 9 is the most explicit: it names "Embeddings" and "Vector Search" and states "These features are intentionally excluded from MVP." Before any code was written, this conflict was surfaced to the project owner rather than either silently building the excluded capability or silently refusing.

**Chosen Solution:** The project owner corrected Phase 6's scope to stay inside the existing MVP boundary — explicitly declining to amend Documents 1/3/4/8/9 to accommodate the original recommendation, on the principle that "a constitutional amendment should happen because you've decided the product needs it — not because a review suggested a common architecture pattern." The corrected scope: improve retrieval quality, ranking, context selection, explainability, and citation quality within PostgreSQL full-text search — no embeddings, no vector storage, no new external retrieval dependency. Concretely:
- **`SearchRepository.searchKnowledgeForContext`** (new method; the existing `searchKnowledge` used by `SearchService`/the Search page is untouched) — combines `ts_rank` with two of Document 4 §11's Knowledge Retrieval Strategy signals that were specified but never implemented: Active-Project affinity (a flat boost for same-project matches) and Recency (a linear decay to zero over 90 days). "Tags" and "Semantic similarity" remain unimplemented — Tags has no query surface yet, and semantic similarity is the exact capability this amendment declined to build.
- **N+1 elimination:** the same method selects full `Knowledge` rows directly instead of `RepositoryContextRetriever` running a search and then issuing one `findById` per result — a real "retrieval performance" cost on every AI request, closed as part of this pass rather than left for later.
- **Deduplication:** `RepositoryContextRetriever.retrieve()` now filters Related Knowledge against Global Knowledge after both resolve (they're fetched in parallel, so a project-less entry matching the search query could previously reach the prompt twice — Document 4 §6 "avoid prompt bloat").
- **Explainable, higher-quality citations:** `AIOrchestratorResponse.citations` changed from bare id strings to `{id, title, reason, rank?}` — `reason` distinguishes an explicit `knowledgeIds` reference from a ranked search match, and related-knowledge citations are sorted by rank descending. `AIChatService`'s `citedKnowledge` connect logic was updated for the new shape.
- **A real bug found via live database verification, not caught by any static check:** the ranking SQL's boost constants (`0.3`, `0.1`) triggered `invalid input syntax for type integer` in Postgres, because a bare `0`/`0.0` sharing a `GREATEST`/`CASE` expression with an interpolated float parameter let the driver infer the wrong bound type. Fixed with explicit `::float8` casts; re-verified live afterward (project-affinity and recency boosts both confirmed to reorder results correctly against real seeded data).

**Consistency Rationale:** Nothing here required a new layer, table, external dependency, or capability outside what Document 4 §11 already specified. The two ranking signals implemented are named, non-semantic entries from that section's own priority list; everything else is a performance or data-quality fix inside the existing `SearchRepository`/`RepositoryContextRetriever`/`AIOrchestrator` boundaries. `SearchService` remains the only entry point the Search page uses; `AIOrchestrator` remains the only AI entry point; no Component, Route Handler, or Service outside `ai/`'s own dependency rules changed.

**Applied text change:** Document 9, Phase 6 — annotated to note its deliverables were already complete from Phases 3–4, to record the scope-correction episode, and to describe the corrected work and its verification. No change to Documents 1, 3, 4, 8, or 9 Phase 9's MVP exclusions — that boundary was upheld, not moved.

---

# 28. Amendment 26 — Phase 7.5 Production Hardening

**Problem:** A read-only Phase 7 QA & Production Readiness Audit (six reports: QA, Performance, Accessibility, Security, Production Readiness, Remaining Issues) found no CRITICAL and no architectural findings, but did find six real implementation gaps worth closing before Phase 8 (Deployment): (S1/R1) no security headers configured anywhere — no CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, or HSTS; (S4) no application-level rate limit on any route, most importantly `/api/v1/ai/chat`, which calls a paid, quota-limited external provider on every request; (S3) `sanitizeMarkdown()` (Document 7 §21, Amendment 15) existed but was dead code — never called by `KnowledgeService`/`DocumentService`'s write paths, leaving only `renderMarkdown()`'s read-time sanitization actually active, contradicting the "two independent layers" claim in the code's own comments; (R2) no health-check endpoint; (S2/R3) `npm audit` reported 3 HIGH-severity transitive vulnerabilities (`postcss`, `sharp`, both via `next`); (Q1) CI validated schema shape and built the app, but never ran against a live Postgres instance, so a raw-SQL regression (the exact class of bug closed in Amendment 25) could pass every check and only fail at runtime.

**Chosen Solution:** The project owner reviewed the audit, approved it without requesting changes, and authorized a narrowly-scoped "Phase 7.5 — Production Hardening" covering exactly six items, explicitly declining to bundle in any new product feature:
- **Security headers:** `next.config.ts` gained a `headers()` function applying `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin` to every route, plus `Strict-Transport-Security` in production only. The CSP omits `'unsafe-inline'`/`'unsafe-eval'` in production (verified via grep that the app has no inline `<script>`, no `style={{...}}` usage, and no CSS-in-JS) but relaxes to allow Next.js Fast Refresh in development, so local `npm run dev` keeps working unmodified.
- **AI endpoint rate limiting:** a new `lib/rate-limit/RateLimiter.ts` (`FixedWindowRateLimiter`, in-memory, per-key) is checked in `POST /api/v1/ai/chat` immediately after `requireUserId()`, before body parsing — 20 requests/60s per user, throwing the existing (previously-unused-for-this-purpose) `RateLimitedError`. Deliberately scoped to only the AI endpoint per the authorization's explicit "AI endpoint rate limiting" item — the sign-in and search endpoints remain unlimited, recorded as reduced-scope residual debt (Document 15, DEBT-005) rather than silently expanded past what was authorized, following this project's established pattern (Amendment 25) of not broadening a phase's scope on its own initiative.
- **Write-time markdown sanitization wired in:** `KnowledgeService.create`/`.update` and `DocumentService.create`/`.update` now call `sanitizeMarkdown()` before persisting. `DocumentService.update`'s version-bump comparison (`contentChanged`) was restructured to compare the *sanitized* value against `existing.markdown`, not the raw input — comparing raw-vs-sanitized could otherwise bump a version on a change sanitization reduces to a no-op.
- **Health-check endpoint:** `GET /api/health` (public — added to `middleware.ts`'s `PUBLIC_PATH_PREFIXES`, since a liveness probe can't authenticate and the route returns no sensitive data) backed by a new `lib/health/checkDatabaseHealth.ts`, which runs `SELECT 1` and returns a boolean. Deliberately not wrapped in the standard `{success, data}` envelope (Document 8 §3) — like `/api/auth/**`, it's infrastructure for orchestrators, not a domain API endpoint.
- **Dependency-vulnerability risk decision:** recorded as new Document 15 debt entry DEBT-009, not fixed. Verified both vulnerable code paths are unreachable: `postcss` processes only this project's own trusted CSS at build time; `sharp` is exercised only via `next/image`/`/_next/image`, and a repo-wide grep confirmed neither is used anywhere (no image-upload feature exists in the MVP). Accepted rather than forcing a breaking `next` major-version upgrade for a currently-unreachable vulnerability; re-evaluate the moment either path is introduced.
- **CI Postgres integration test:** a new `tests/integration/SearchRepository.integration.test.ts` (run via `npm run test:integration`, a separate Vitest config/script so the default `npm test` still needs no live database) exercises both `SearchRepository` raw-SQL methods — including the exact call shape that caused the Amendment 25 Postgres type-inference bug — against a real, migrated database. `ci.yml` gained a `postgres:16` service container and two new steps (`prisma migrate deploy`, then the integration test) at the end of the existing job, with `DATABASE_URL` overridden only for those two steps; every earlier step keeps using the original dummy value, unchanged.

**Consistency Rationale:** Every change closes a gap the audit found inside already-approved architecture — none introduced a new layer, dependency direction, external service, or capability. The rate limiter and health-check module both follow the established "thin `lib/` module a Route Handler imports directly, bypassing no boundary rule" pattern (`lib/logger/`, `lib/markdown/`, mirrored here); the sanitization fix makes existing code (Amendment 15) actually run where it always claimed to; the CI/integration-test addition exercises existing raw SQL (Amendment 25), adding no new query. No Component, Service-layer boundary, or `ai/`/`features/` dependency rule changed.

**Applied text change:** None to Documents 1–12 — every fix operates below the level those documents specify (headers, rate limiting, and health checks were never previously specified as absent or present; sanitization's write-time call was always implied by Document 7 §21, just unenforced). Document 15 (Technical Debt Register) updated: DEBT-002 and DEBT-005 marked partially closed with resolution notes, DEBT-009 added.

---

# 29. Amendment 27 — Release Candidate Review and Pre-Deployment Hardening

**Problem:** A read-only Release Candidate (RC) Review, requested after Phase 7.5, checked the project against Document 16's own pre-existing RC exit criteria (written after Phase 2, long before this review) rather than inventing new requirements. It found that several Document 16 RC-milestone items — hosting platform, production Postgres provider, backup strategy, monitoring, and the Document 10 §8a migration procedure that Document 16 itself named as a Beta-milestone deadline — were entirely undecided or unwritten, not partially built. Two items were genuinely findable defects rather than open decisions: `AUTH_URL`/`EMAIL_FROM` had no production-only enforcement (Document 15 DEBT-007), and the `searchVector` migration-safety procedure Document 16 required "before Beta, not during it" had never actually been written down anywhere.

**Chosen Solution:** The project owner reviewed the RC Review, requested five specific analytical additions (a Production Readiness Score, a Decision-vs-Implementation classification, a deployment order, a Release-Blocking classification, and a Cost Control section the original review had missed), then made the three outstanding platform decisions the review had surfaced: **Vercel** (hosting — already assumed throughout Documents 1, 2, 9, 16, and specifically required by Document 11 §6's Node.js-Middleware-dependent session strategy), **Neon** (Postgres — closes Document 15 DEBT-008's connection-pooling-under-serverless-concurrency gap, decouples the database from the hosting vendor), and **monitoring deferred** (Sentry named as the intended choice but explicitly not installed during this pass — "add it during Phase 8, or immediately after deployment"). A Pre-Deployment Hardening pass then closed the decision-independent and now-decision-unblocked implementation items:
- **`config/env.ts`** gained a `superRefine` requiring, only when `NODE_ENV === "production"`: `AUTH_URL` to start with `https://` (closing Document 15 DEBT-007 — Auth.js derives session-cookie `Secure`-flag behavior from this, so an accidental `http://` in production was a real session-hijacking-surface increase, not just a misconfiguration inconvenience), and a new `EMAIL_FROM` variable to be present (closing RC Review finding RC1 — a deploy could previously ship the hardcoded Resend shared-onboarding-domain placeholder silently).
- **`config/app.ts`** — `emailFrom` is now `env.EMAIL_FROM ?? <placeholder>` instead of a hardcoded string; the placeholder remains the fallback for development/test only, where the new production-only validation doesn't apply.
- **`lib/db/client.ts`** — `PrismaPg`'s adapter now receives an explicit `max: 5` pool-size cap (Document 15 DEBT-008), a conservative per-process safety margin now that Neon (whose own pooled `-pooler` endpoint is documented as the primary mechanism, Document 17 §4) is the confirmed database target.
- **Document 10 §8a** (new) — the `searchVector` migration-safety procedure Document 15 DEBT-003 always described the *shape* of but never formalized: always `prisma migrate dev --create-only`, manually review the generated SQL for an unexpected `DROP COLUMN "searchVector"` before applying, every time, regardless of database provider.
- **Document 17** (new) — a Deployment & Operations Runbook (same derived-artifact standing as Documents 14–16): the confirmed production stack, an environment-variables checklist reflecting the new production-only validation, the migration procedure (cross-referencing Document 10 §8a rather than duplicating it), a Neon-PITR-based backup/restore strategy, a two-part rollback procedure (deploy rollback via Vercel Instant Rollback vs. migration rollback via a Neon branch restore — explicitly not the same mechanism), the monitoring/logging decision record, cost-control setup steps (an OpenAI spend limit is called out as the single highest-value, lowest-effort action), and a release checklist.

**Consistency Rationale:** Every code change operates below the level Documents 1–12 already specify — production-only environment validation, connection pool sizing, and a migration review procedure are all operational hardening within already-approved architecture, none requiring a new layer, dependency direction, or capability. Document 17 is deliberately a derived artifact (like Documents 14–16), not a constitutional one — it doesn't reinterpret Document 9's Phase 8 deliverables or Document 16's milestone definitions, it operationalizes decisions Document 16 already anticipated needing. The rate limiter (Document 13 §28, Amendment 26) was deliberately left unchanged — its known in-memory limitation was reconfirmed as an accepted tradeoff for MVP scale under the now-confirmed Vercel target, not silently revisited.

**Applied text change:** Document 10 gained new §8a (searchVector procedure). Document 15: DEBT-003 marked closed (exit criteria met); DEBT-007 marked closed (production enforcement now live); DEBT-008 marked partially closed (pool sizing done, Neon chosen; DEBT-008's original "switch to a serverless-aware driver" language superseded by "use Neon's pooled connection string," recorded as the resolution). Document 17 created new. No change to Documents 1–9, 11–14, or 16 — this pass operationalizes what they already specify rather than amending them.

---

# 30. Amendment Ledger Summary

| # | Topic | Affected Document(s) | Status |
|---|---|---|---|
| 1 | Semantic Search scope | Doc 1 §9 | Applied |
| 2 | Repository location | Doc 5 §4, §7 | Applied |
| 3 | AI Orchestrator dependency direction | Doc 4 §3, Doc 5 §20 | Applied |
| 4 | Governance implementation | Doc 3 §3 | Applied |
| 5 | Task entity status | None (clarification only) | Confirmed |
| 6 | Enum definitions | Doc 6 §10 | Applied |
| 7 | Knowledge confidence type | Doc 3 §4 | Applied |
| 8 | Settings ownership | Doc 3 §4 | Applied |
| 9 | Tags API | Doc 8 (new §9a) | Applied |
| 10 | Conversations API | Doc 8 (new §14a) | Applied |
| — | `ReviewPrompt` naming | None (clarification only) | Confirmed |
| 11 | Soft-delete enforcement mechanism | Doc 10 §4, Doc 3 §8 | Applied |
| 12 | Raw SQL soft-delete documentation rule | Doc 7 §8 | Applied |
| 13 | Archived-user authentication behavior | Doc 11 §6 | Applied |
| 14 | `process.env` centralization enforcement | Doc 7 §13 (enforcement only, no text change) | Applied |
| 15 | Markdown sanitization implemented | Doc 7 §21 (enforcement only, no text change) | Applied |
| 16 | Environment validation failure-path tests | Doc 7 §11-13 (verification only, no text change) | Applied |
| 17 | CI/CD pipeline | Doc 9 (Phase 0 deliverable annotated) | Applied |
| 18 | Phase 3 backend services architecture (transaction boundaries, governance read path, note conversion) | Doc 7 §8, Doc 9 Phase 3 | Applied |
| 19 | Component/page → Service boundary enforcement | Doc 7 §8 (enforcement only, no text change) | Applied |
| 20 | Phase 4 frontend architecture (SettingsService gap-fill, client data fetching, no new UI dependencies, MarkdownEditor reuse) | Doc 8 §15, Doc 9 Phase 4 | Applied |
| 21 | Phase 4 UX corrections (route group fix, responsive sidebar, ConfirmDialog, Search result routing, Project cross-navigation, truncation notice, Documents table consistency, required-field indicators) | Doc 9 Phase 4 | Applied |
| 22 | `ai/` ESLint boundary correction (enforcement only, no text change) | eslint.config.js | Applied |
| 23 | Phase 5 AI Layer architecture (Orchestrator factory, `.strict()` response validation, `findGlobal`, `AIChatService` persistence, embeddings exclusion, Document 12 status correction) | Doc 9 Phase 5, Doc 12 | Applied |
| 24 | Phase 5.5 AI Stabilization (Settings applied to provider calls, Knowledge ownership check, persistence-failure response preservation, Stage 1→2 approval enforcement, rate-limit normalization) | None (behavioral only, no text change) | Applied |
| 25 | Phase 6 corrected scope (Knowledge Intelligence within MVP — ranking, N+1 fix, dedup, explainable citations; embeddings/vector storage declined) | Doc 9 Phase 6 | Applied |
| 26 | Phase 7.5 Production Hardening (security headers, AI endpoint rate limiting, write-time markdown sanitization wired in, health-check endpoint, dependency-vulnerability risk decision, CI Postgres integration test) | Doc 15 (debt entries updated) | Applied |
| 27 | Release Candidate Review + Pre-Deployment Hardening (hosting/database/monitoring decisions recorded, production-only env validation, connection pooling, searchVector migration procedure, new Document 17 runbook) | Doc 10 (new §8a), Doc 15 (debt entries closed), Doc 17 (new) | Applied |

All items are now Applied. Documents 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, and 12 have been edited in place (version bumped each time, with inline `<!-- Amended -->` markers or equivalent inline notes), and Document 9's Final Approval Gate (§9) references Documents 1–13. Amendments 11–17 originated from the Phase 2 architectural review and the subsequent Infrastructure Hardening Sprint; Amendment 18 originated from the Phase 3 implementation itself; Amendment 19 originated from the Document 14 Revision 3 pre-Phase-4 audit; Amendment 20 originated from the Phase 4 implementation itself; Amendment 21 originated from the read-only Pre-Phase-5 UX Review, which found Phase 4's "Full navigation operational" exit criterion was not actually met and reopened Phase 4 for correction before Phase 5 was authorized; Amendments 22–23 originated from the Phase 5 implementation itself; Amendment 24 originated from the read-only Pre-Phase-6 AI Architecture Review, which authorized a scoped Phase 5.5 stabilization pass before Knowledge Intelligence work begins; Amendment 25 originated from a scope conflict caught before Phase 6 implementation began — the initial "Knowledge Intelligence" authorization named embeddings/vector storage, which Document 9 Phase 9 explicitly excludes from MVP, and the project owner corrected the authorization rather than amend the exclusion. Amendment 26 originated from the read-only Phase 7 QA & Production Readiness Audit, which the project owner approved without requesting changes and followed with a narrowly-scoped Phase 7.5 Production Hardening authorization covering exactly its six highest-value findings, explicitly declining to bundle in any new product feature. Amendment 27 originated from the read-only Release Candidate Review, which checked the project against Document 16's own pre-existing RC exit criteria and found several genuinely undecided (not unfinished) items; the project owner made the outstanding hosting/database/monitoring decisions directly, which a Pre-Deployment Hardening pass then operationalized. All recorded here anyway, in the same ledger, since this document's purpose is being the single place every constitutional change is traceable from, regardless of which phase surfaced it. The full constitution (Documents 1–14) is internally consistent as of this revision.

---

END OF DOCUMENT 13
