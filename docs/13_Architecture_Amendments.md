# KAIRO-Lite
## Architecture Amendments

Version: 1.1 (applied)
Status: Applied — approved by the project owner. Documents 1, 3, 4, 5, 6, and 8 have been updated in place (each now at version 1.1) to reflect every amendment below.

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

**Chosen Solution:** `Task` **is** included in the Phase 2 Prisma schema and migration (Document 10 §5.6), consistent with its Core Entity placement, but remains explicitly **out of scope for any Service, API route, or UI** in Phases 3–8. It exists as a forward-compatible schema placeholder only, consistent with Document 3's own "Future implementation item" label.

**Consistency Rationale:** This doesn't resolve the tension by picking one document over the other — it honors both simultaneously: Document 3's *schema* placement (Core Entity) and Document 3's own *scope* label (future) are both true at once, once "in the schema" and "in the product" are recognized as separate questions. No document is contradicted or overridden.

**Applied text change:** None required — this is a sequencing clarification, not a text conflict. Document 9 Phase 2 deliverables may optionally note "includes Task table, unused until a future phase" for clarity.

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

# 13. Amendment Ledger Summary

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
| 11 | `ReviewPrompt` naming | None (clarification only) | Confirmed |

All items are now Applied. Documents 1, 3, 4, 5, 6, and 8 have been edited in place (version 1.1 each, with inline `<!-- Amended -->` markers), and Document 9's Final Approval Gate (§9) now references Documents 1–13. The full constitution (Documents 1–13) is internally consistent as of this revision.

---

END OF DOCUMENT 13
