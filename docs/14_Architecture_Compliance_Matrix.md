# KAIRO-Lite
## Architecture Compliance Matrix

Generated: after Phase 3 (Backend Services, Document 13 §20 Amendment 18)
Revision: 3 — regenerated, not hand-patched, per the user's explicit pre-Phase-4 audit request
Status: **Point-in-time audit report, not a constitutional document.** It does not define rules — Documents 1–13 do that. It inventories which of those rules are currently *automated* versus *dependent on human discipline*, as of this commit. It will go stale as Phase 4+ lands; regenerate rather than trust an old copy.

No code was modified to produce this revision — every row below reflects the codebase exactly as committed at the end of Phase 3 (`4899eeb`). Every claim of `LINT-TIME`/`RUNTIME`/`COMPILE-TIME` enforcement below that changed from Revision 2 was re-verified live during this audit (a real ESLint violation written and confirmed to fail, a real grep across the codebase, or the existing test suite), not carried forward from the Phase 3 report by assertion.

---

# 1. How to Read This

For every constitutional rule found across Documents 1–13, five columns:

| Column | Meaning |
|---|---|
| Doc / § | Which document and section states the rule |
| Rule | The rule itself, paraphrased |
| Enforcement Mechanism | *What* enforces it, in plain language |
| Current Implementation | The actual file/tool, or "none yet" |
| Type | See the classification key below |

**Type key** (as specified):

| Type | Meaning |
|---|---|
| `DOCUMENTED` | Stated in the constitution; nothing in the system checks it. Pure prose. |
| `CONVENTION` | Followed consistently by hand so far, but nothing would catch a violation. |
| `COMPILE-TIME` | TypeScript's type system makes a violation fail to compile. |
| `LINT-TIME` | ESLint catches a violation (`npm run lint` / `next build`). |
| `RUNTIME` | Enforced by code that executes (middleware, extension logic, validators, Service logic). |
| `CI` | Enforced by the GitHub Actions pipeline running on every push/PR. |
| `DATABASE` | Enforced by PostgreSQL itself (constraints, FK, generated columns, native enums). |
| `PRISMA` | Enforced by the Prisma schema/client layer specifically. |
| `MANUAL REVIEW` | Requires a human (or an AI agent under review) to check; no tooling exists. |
| `PROCESS` | Enforced by the human/AI workflow itself (approval gates), not by the codebase. |
| `N/A (not yet built)` | The rule governs something no phase has implemented yet. |

A rule can have more than one type where enforcement is layered — both are listed, not averaged into one.

---

# 2. Document 1 (PRD)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §9 | MVP scope is Full-Text Search, not Semantic Search | `SearchService`/`SearchRepository` implement full-text only (`websearch_to_tsquery`); no embeddings/vector code exists anywhere in the tree | `features/search/services/SearchService.ts`, `lib/db/repositories/SearchRepository.ts` — grep-confirmed no `pgvector`/embeddings reference exists | `RUNTIME` (scope honored) / `DOCUMENTED` (nothing would stop a future PR from adding semantic search early — no gate enforces the boundary itself) |
| §10 | Team collaboration, billing, marketplace, public APIs are out of scope | None | none | `DOCUMENTED` |
| §4 | Core principles (think before designing, kill weak ideas, etc.) | None — process/judgment, not code-checkable | This entire session's back-and-forth review cadence | `PROCESS` |
| §11 | Acceptance criteria (users can manage projects, etc.) | Partial — Service-layer CRUD now exists and is unit-tested for Projects/Knowledge/Notes/Documents; no UI/API route exists yet for an end-to-end acceptance test | `features/*/services/*.ts`, `tests/unit/*.test.ts` | `RUNTIME` (Service layer) / `N/A (not yet built)` (full acceptance criteria — needs Phase 4 UI + API) |

---

# 3. Document 2 (Architecture)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §3, §7 | Components contain no business logic | Nothing generic — no Component exists yet that could violate this (Phase 4) | — | `N/A (not yet built)` |
| §7 | Components never access Prisma/the database directly | ESLint `no-restricted-imports` blocks `@/lib/db`, `@/generated/prisma` from `components/**`, `app/**` | `eslint.config.js` — re-verified live this audit | `LINT-TIME` |
| §7 | All AI requests pass through the AI Orchestrator | Components blocked from `ai/providers` directly (unchanged); **Services are now also blocked** from `@/ai/providers/**` (Phase 3 addition) — verified live this audit with a deliberate violating import | `eslint.config.js` (components + `features/*/services/**`) | `LINT-TIME` — Route Handlers still unenforced (`N/A`, none exist yet) |
| §7 | Knowledge updates are auditable | **Closed.** `KnowledgeService.create`/`update`/`archive`/`restore` each call `AuditLogRepository.record()` inside the same transaction as the entity write | `features/knowledge/services/KnowledgeService.ts`; `tests/unit/KnowledgeService.test.ts` asserts the audit call on every write path; live-verified atomicity (see §8 below) | `RUNTIME` |
| §7 | Modules communicate through services | Six Services now exist and own their domain's business logic exclusively (verified: zero direct Prisma imports in any Service, grep-confirmed this audit) — but **nothing yet stops a future Component/Route from importing a Service's Repository directly, or a Service directly, skipping intended layering**, since no Route Handler exists to test the Component→Route boundary against | `features/*/services/*.ts` | `RUNTIME` (Services themselves are correctly structured) / `CONVENTION` (nothing external is forced through them yet — flagged as a new, now-live gap; see §16) |
| §7 | No circular dependencies | `ai/ ↔ features/` lint-enforced (unchanged); **no Service imports another Service** (grep-verified this audit — zero cross-service imports found); no Repository imports another Repository (grep-verified) | `eslint.config.js` (ai/features), plus the newly-verified absence of Service→Service and Repository→Repository edges | `LINT-TIME` (ai/features) / `RUNTIME` (Service/Repository graph, verified by inspection, not by a lint rule that would catch a *future* violation) |
| §5, §6 | Every AI request executes only through the Orchestrator | No AI code executes yet (Phase 5) | none | `N/A (not yet built)` |

---

# 4. Document 3 (Database Design)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §2, §7 | UUID v7 primary keys | Prisma schema `@default(uuid(7))` | `prisma/schema.prisma` | `PRISMA`, `DATABASE` |
| §2, §8 | Soft delete instead of hard delete | Prisma Client Extension auto-filters reads; every Repository's `restore`/`findArchived`/`findIncludingArchived` escape hatches unchanged by Phase 3 | `lib/db/soft-delete-extension.ts` | `RUNTIME`, `PRISMA` |
| §2 | Created/updated timestamps on every table | Postgres/Prisma defaults | `prisma/schema.prisma` | `DATABASE`, `PRISMA` |
| §2 | Append-only history for critical entities (Message, AuditLog) | No `update`/`archive` method on `MessageRepository`/`AuditLogRepository`; confirmed `AuditLogRepository`'s only writer is `record()`, called exclusively by Services, never mutated afterward | Bespoke repository classes with a narrower method set | `COMPILE-TIME` — still not `DATABASE` (no Postgres trigger blocks a raw UPDATE) |
| §2 | Referential integrity through foreign keys | Postgres FK constraints | `prisma/migrations/.../migration.sql` | `DATABASE` |
| §9 | Audit every important write (Create, Update, Archive, Restore, Delete, AI-assisted, Governance) | **Closed for Create/Update/Archive/Restore/Governance.** Every Service write method records an audit entry inside the same transaction as the entity write (grep-verified this audit: write-call count equals `audit.record()` call count in every Service file). `GOVERNANCE_CHANGE` operation used by `GovernanceService.set()`. `Delete`/`AI_EDIT` operations remain unused — by design: no hard-delete path exists (soft-delete architecture), and no AI write path exists yet (Phase 5) | `features/*/services/*.ts` calling `lib/db/repositories/AuditLogRepository.ts`; live atomicity proof (see §8 below) | `RUNTIME` (Create/Update/Archive/Restore/Governance) / `N/A (not yet built)` (Delete, AI_EDIT) |
| §12 | Migrations preserve data; no destructive changes without explicit approval | Unchanged — Prisma CLI's own AI-agent safety gate | Prisma CLI | `RUNTIME` (Prisma tooling) |
| §13 | No business logic inside the database; no stored procedures; no triggers except where technically required | Unchanged — the one DB-level computation (`searchVector`) is a generated column, now actively read by `SearchService`/`SearchRepository` (previously built but only smoke-tested) | `prisma/migrations/.../migration.sql`, `lib/db/repositories/SearchRepository.ts` | `MANUAL REVIEW` |
| §13 | AI never writes directly | No AI write path exists yet | none | `N/A (not yet built)` |

---

# 5. Document 4 (AI Architecture)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §3 | AI Orchestrator is the single entry point; no UI/route calls an LLM directly | Components blocked (unchanged); **Services now blocked too** — closes the caveat Revision 2 flagged ("no Service exists yet to test") | `eslint.config.js` (components + `features/*/services/**`) — re-verified live this audit | `LINT-TIME` — Route Handlers still `N/A` (none exist) |
| §3 (amended, Doc 13 §4) | `ai/` never depends on `features/` | ESLint `no-restricted-imports` on `ai/**` — re-verified live this audit, including specifically that `ai/` cannot import a Phase-3 Service | `eslint.config.js` | `LINT-TIME` |
| §3 | Context retrieval reads via Repositories, not Feature Services | `ContextRetriever` interface still unimplemented (Phase 5); moot for Phase 3 since no AI code reads context yet, but the boundary that would enforce it (`ai/` blocked from `features/`) is already active and tested | `ai/context/ContextRetriever.ts` (interface only) | `N/A (not yet built)` (implementation) / `LINT-TIME` (the boundary it will depend on) |
| §4 | Four AI modes only | Unchanged | `prisma/schema.prisma`, `types/ai.ts` | `DATABASE`, `COMPILE-TIME` |
| §9 | Invalid AI responses never reach the UI | Not implemented (Phase 5) | none | `N/A (not yet built)` |
| §15 | No direct database writes from the AI layer | No AI code executes yet | none | `N/A (not yet built)` |

---

# 6. Document 5 (Folder Structure)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §2–§17 | The folder structure itself | `features/*/services/`, `features/*/schemas/` added exactly per spec for all six Phase 3 modules; `features/shared/services/` added for the one genuinely cross-feature helper | Verified by direct inspection this audit | `MANUAL REVIEW` |
| §5 | Components never access Prisma / call AI providers | Same rule as Doc 2 §7 above | `eslint.config.js` | `LINT-TIME` |
| §20 (amended) | `ai/` and `features/` are dependency siblings; `ai/` never imports `features/` | ESLint rule | `eslint.config.js` — re-verified live | `LINT-TIME` |
| §20 | `Features → UI Components from unrelated features` forbidden | Still nothing — no Component exists yet to test against, and no rule restricts cross-feature imports generally. Note: Phase 3 Services legitimately cross feature boundaries at the *Repository* level (e.g. `NotesService` uses `KnowledgeRepository`), which is a distinct, permitted case (Document 7 §8 allows a Service to depend on any Repository) — not a violation of this UI-component rule | none | `N/A (not yet built)` (the UI-component case) / `CONVENTION` (the general cross-feature-import gap, unchanged) |
| §20 | `Prisma → Features` forbidden | Structurally impossible | `generated/prisma/` (gitignored) | `PRISMA` |
| §22 | New top-level folders require architectural approval | Relies on this review process — the entire Phase 3 authorization message is the record of that approval for `features/*/services/`, `features/*/schemas/`, `features/shared/services/` | This conversation | `PROCESS`, `MANUAL REVIEW` |
| §19 | Prefer `@/*` aliases over deep relative imports | Followed by every Phase 3 file; not lint-enforced | `tsconfig.json` `paths` | `COMPILE-TIME` (aliases work) / `CONVENTION` (preference) |

---

# 7. Document 6 (Naming Conventions)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §3–§9 | File/class/variable naming casing | No lint rule; still followed by hand | none | `CONVENTION` (gap) |
| §11 | Database tables snake_case, plural | Prisma `@@map` | `prisma/schema.prisma` | `PRISMA`, `DATABASE` |
| §10 | Enums PascalCase, members UPPER_SNAKE_CASE | Unchanged | `prisma/schema.prisma` | `PRISMA`, `DATABASE`, `COMPILE-TIME` |
| §21 | Services end with `Service` | **Now testable — and compliant.** All six: `ProjectService`, `KnowledgeService`, `NotesService`, `DocumentService`, `GovernanceService`, `SearchService`. No lint rule (e.g. `unicorn/filename-case` + a custom suffix check) enforces this for a *future* class | `features/*/services/*.ts` — grep-confirmed this audit | `CONVENTION` (compliant today, not lint-enforced) |
| §22 | Repositories end with `Repository` | Unchanged — 12 repositories now (11 + `SearchRepository`), all compliant, still by hand | none | `CONVENTION` |
| §25 | Reserved architectural names must not be renamed casually | Nothing automated | none | `MANUAL REVIEW` |

---

# 8. Document 7 (Coding Standards)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §3 | TypeScript strict mode; no implicit `any` | Unchanged | `tsconfig.json` | `COMPILE-TIME` |
| §3 | Never use `any` unless impossible | Unchanged — re-verified: zero `any` usages introduced across all six Services | `eslint.config.js` | `LINT-TIME` |
| §3 | No `ts-ignore` without justification | Unchanged; zero `ts-ignore`/`ts-expect-error` introduced in Phase 3 | none | `CONVENTION` (gap) |
| §4 | Functional components, Server Components by default | No Component exists yet | — | `N/A (not yet built)` |
| §6 | Components: typed props, no business logic, no DB/AI calls | No Component exists yet | — | `N/A (not yet built)` |
| §7 | Business logic only in Services | **Now demonstrated, not just asserted.** Slug generation, category-governance policy, version-bump-on-content-change, publish/unpublish, note-conversion — all live in Service classes, none in Repositories (which remain pure data access — spot-checked this audit: no `if`/business-rule branching found in any Repository beyond the escape-hatch method selection itself). Nothing yet lint-blocks a *future* rule violation (e.g. a Route Handler doing its own ownership check instead of delegating) | `features/*/services/*.ts` | `RUNTIME` (demonstrated) / `CONVENTION` (still nothing prevents a future violation elsewhere — same caveat as always, now with something real to violate) |
| §8 | `Component → Route → Service → Repository → Prisma`, no shortcuts | Component→Prisma lint-blocked (unchanged). **Service→Prisma now lint-blocked** (re-verified live this audit: a deliberate `import { prisma } from "@/lib/db/client"` inside a Service file fails lint with the exact Document 7 §8 message). Route→Service, Route→Repository: `N/A`, no Route Handler exists. **Component→Service is NOT blocked** — re-verified live this audit: a deliberate `import { ProjectService } from "@/features/projects/services/ProjectService"` inside `app/` compiles and lints clean. This is a new, live gap (previously `N/A` — no Service existed to import) | `eslint.config.js` | `LINT-TIME` (Component→Prisma, Service→Prisma) / **gap**: `CONVENTION` (Component→Service — see §16) / `N/A` (Route↔Service/Repository) |
| §8 (amended, Doc 13 §14) | Raw SQL must document its soft-delete behavior | Followed in `KnowledgeRepository.ts`'s doc comment (unchanged) and now also in `SearchRepository.ts` (Phase 3), which manually applies `archivedAt IS NULL` in every `$queryRaw` call since raw SQL bypasses the extension — documented inline and exercised live in the Phase 2/3 smoke tests | `lib/db/repositories/SearchRepository.ts` | `MANUAL REVIEW` (documentation requirement) |
| §8 (Doc 13 §20, Amendment 18) | Repository constructors accept an optional transaction-scoped client; a Service performing more than one write opens exactly one transaction around all of them | **New rule this phase, closed on arrival.** Every one of the 12 repository constructors accepts `client: Db = prisma`; every Service write method opens exactly one `withTransaction` and constructs fresh tx-scoped Repository instances inside it (grep-verified this audit: no Service performs two writes outside a `withTransaction` block). Live-verified against real Postgres: a forced audit-write failure inside a `ProjectService.create()`-shaped transaction left zero trace of the entity write afterward | `lib/db/transaction.ts`, `lib/db/client.ts`, every `features/*/repositories/*.ts` and `features/*/services/*.ts` | `RUNTIME`, live-database-verified — the strongest evidence tier this matrix has for any rule |
| §9 | Provider-specific AI code only in `ai/providers/` | Components blocked (unchanged); **Services now blocked too** | `eslint.config.js` (components + Services) | `LINT-TIME` — Routes still `N/A` |
| §10 | Never swallow errors; always log + rethrow | Every Service propagates `AppError` subclasses (`NotFoundError`/`ForbiddenError`/`ValidationError`/`UnknownError`) rather than catching and discarding; `parseOrThrow` converts Zod failures into `ValidationError` rather than swallowing them. No lint rule enforces this pattern generally | `lib/utils/errors.ts`, used consistently across all six Services | `CONVENTION` (pattern followed, not lint-enforced) |
| §11 | All external input validated via Zod | **Closed for every Service mutation that accepts free-form input.** `parseOrThrow(schema, rawInput)` is the first statement in every `create`/`update`/`set`/`convertTo*`/`searchKnowledge` method (grep-verified this audit: 15 `parseOrThrow` call sites across 6 Services, one per input-accepting method); methods taking only a typed `id: string` (`archive`/`restore`/`publish`/`unpublish`) correctly have none, since there's no free-form input to validate | `features/*/services/*.ts`, `features/*/schemas/*.ts` | `RUNTIME`, test-verified (every Service's test file asserts a `ValidationError` on bad input before any repository call) |
| §12 | Structured logging; never log secrets | Unchanged | `lib/logger/index.ts` | `COMPILE-TIME` / `CONVENTION` |
| §13 | Never access `process.env` directly; centralize | Unchanged, still closed | `eslint.config.js` | `LINT-TIME` |
| §14 | API response envelope standard | Helpers exist; no Route Handler exists yet to check compliance (Services return domain entities/errors, not HTTP envelopes directly — that translation is the Route Handler's job, Phase 4) | `lib/utils/http.ts`, `types/api.ts` | `N/A (not yet built)` for enforcement; helpers `COMPILE-TIME` typed |
| §16 | Import order | Unchanged, still no `eslint-plugin-import` rule | none | `CONVENTION` (gap) |
| §18 | Testing hierarchy (unit → integration → e2e) | **Partially closed.** 78 unit tests now exist (8 files: 6 Services + markdown + env), all passing, all wired into CI. No integration tests (e.g. against a live test database as part of the automated suite — the Phase 3 atomicity proof was run manually, once, not added as a repeatable integration test) or e2e tests exist yet | `tests/unit/*.test.ts`, `.github/workflows/ci.yml` | `RUNTIME`, `CI` (unit) / `N/A (not yet built)` (integration, e2e) |
| §21 | Validate input / escape output / sanitize markdown / protect secrets / verify auth / verify authz | Auth: `RUNTIME` (unchanged). Markdown sanitization: `RUNTIME` (unchanged). **Verify authz is now `RUNTIME`, not `N/A`**: every Service's `get`/`update`/`archive`/`restore` calls an ownership assertion (`assertOwnership`/`assertAccess`/`assertAuthor`/`assertProjectOwnership`) that throws `ForbiddenError` on mismatch, test-verified in all six Service test files | `middleware.ts`, `lib/markdown/`, `features/*/services/*.ts`, `features/shared/services/assertProjectOwnership.ts` | `RUNTIME`, test-verified |
| §22 | Accessibility | Unchanged — no Component exists yet | `eslint.config.js` (`next/core-web-vitals`) | `N/A (not yet built)` in practice (nothing to check yet), rule itself is `LINT-TIME` (`warn`) once Components exist |
| §23 | Every PR must compile, lint, pass tests | Unchanged, CI now also runs 78 tests instead of 20 | `.github/workflows/ci.yml` — re-run this audit, all steps pass | `CI` |
| §25 | If code conflicts with documentation, documentation wins | This review process — Phase 3's own design decisions (governance read path, note-conversion call path) were resolved by consulting Documents 7, 8, 13 explicitly rather than by convenience | This conversation | `PROCESS` |
| §26 | AI-generated code follows the same standards as human-written code | Unchanged | This conversation | `PROCESS`, `MANUAL REVIEW` |

---

# 9. Document 8 (API Contracts)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §3 | Standard response envelope | No Route Handler exists yet | `types/api.ts`, `lib/utils/http.ts` | `N/A (not yet built)` |
| §4 | `/api/v1/` versioning | Folder exists, empty | `app/api/v1/.gitkeep` | `N/A (not yet built)` |
| §5 | Every protected endpoint requires authentication | Unchanged — middleware exists, not live-request-tested | `middleware.ts` | `RUNTIME` (implemented, not live-tested) |
| §6 | Authorization lives in Services, never middleware alone | **Closed for the Service half.** Every Service now performs its own ownership authorization independent of middleware — demonstrated and test-verified (see Doc 7 §21 row above). The "never middleware alone" comparison itself is `N/A` until a Route Handler exists to show middleware *isn't* the only check for a real HTTP request | `features/*/services/*.ts` | `RUNTIME` (Service-side authorization) / `N/A (not yet built)` (the Route-level comparison) |
| §11 | Notes API: Convert to Knowledge / Convert to Document | **Implemented at the Service layer.** `NotesService.convertToKnowledge`/`convertToDocument` exist, validated, authorized, audited, transactional, unit-tested (5 tests). No `/api/v1/notes/:id/convert-to-*` Route Handler exists yet to expose it over HTTP | `features/notes/services/NotesService.ts` | `RUNTIME` (Service capability) / `N/A (not yet built)` (HTTP exposure) |
| §12 | Documents API: Markdown, Export, Version history, Publishing | **Version history and Publishing implemented at the Service layer.** `DocumentService.update` bumps `version` on actual content change; `publish`/`unpublish` toggle `published` with an audit trail. "Export" is not implemented (no format/mechanism specified anywhere in Documents 1–13 — genuinely undefined scope, not a gap in what was asked) | `features/documents/services/DocumentService.ts` | `RUNTIME` (version history, publishing) / `N/A (not yet built)` (export — undefined scope) |
| §16, §17 | Pagination / filtering standard | `toPagination()` used by every Repository including the six new ones' underlying calls; every Service's `list`/`listByProject` methods accept and thread through `FindManyParams` | `lib/db/soft-delete.ts`, `features/*/services/*.ts` | `COMPILE-TIME` (typed and used consistently) |
| §18 | Stable error codes | `NotFoundEntity` extended with `"NOTE"` this phase; `ErrorCode` union covers every Service's thrown errors | `lib/utils/errors.ts` | `COMPILE-TIME` |
| §22 | Routes are nouns, no verbs | No routes exist yet | none | `N/A (not yet built)` |
| §9a, §14a | Tags API, Conversations API | Documented only | none | `N/A (not yet built)` |

---

# 10. Document 9 (Implementation Plan)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §2 | Foundation before features; database before APIs; APIs before UI | Followed — Phase 3 (Services) landed before any Route Handler or UI (Phase 4) | This conversation | `PROCESS` |
| §7 | Never redesign approved architecture without asking | Every Phase 3 judgment call (governance read path, note-conversion call path, missing `list()` for Documents, `findBySlugIncludingArchived` addition) was flagged and justified against a specific constitutional section, not silently decided | This conversation, Document 13 §20 Amendment 18 | `PROCESS`, `MANUAL REVIEW` |
| §9 | `START IMPLEMENTATION` / phase-gate before code generation | Phase 3 began only after explicit "START PHASE 3" authorization | This conversation | `PROCESS` |
| — | Phase boundaries ("do not begin Phase 4 yet") | Nothing technical stops it — still 100% human-in-the-loop | This conversation | `PROCESS` |

---

# 11. Document 10 (Prisma Data Model Specification)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §3 | UUID v7 strategy | Unchanged | `prisma/schema.prisma` | `PRISMA`, `DATABASE` |
| §4 (amended) | Soft-delete strategy | Unchanged; now also exercised by every Service's `archive`/`restore` methods | `lib/db/soft-delete-extension.ts` | `RUNTIME`, `PRISMA` |
| §5.6, Doc 13 §6 | Task is RESERVED — schema only | **Re-verified after Phase 3.** Grep-confirmed this audit: still no `TaskRepository`, no `TaskService`, `Task`/`TaskStatus`/`TaskPriority` still absent from `types/database.ts` and `constants/statuses.ts` | `prisma/schema.prisma` (model exists, referenced nowhere else) | `MANUAL REVIEW` (confirmed by inspection, no lint rule would catch a future violation) |
| §7 | Cascade rules | Unchanged | `prisma/schema.prisma` | `DATABASE` |
| §8 | Index strategy, including the Knowledge full-text GIN index | Unchanged; now actively queried in production code paths (`SearchService`), not just smoke-tested | `prisma/migrations/.../migration.sql` | `DATABASE` |
| §8 | Full-text search functional | **Now exercised through the Service layer, not just raw SQL.** `SearchService.searchKnowledge` → `SearchRepository.searchKnowledge` → `$queryRaw` with `ts_rank`/`websearch_to_tsquery`, unit-tested (3 tests) with the repository mocked; the underlying SQL was live-verified in Phase 2 | `features/search/services/SearchService.ts`, `lib/db/repositories/SearchRepository.ts` | `DATABASE` (query mechanism) / `RUNTIME` (Service wiring, test-verified) |
| §5.12 | `GovernanceRule` — minimal key-value config, read/written per Amendment 4 | **Closed.** Grep-verified this audit: `GovernanceRuleRepository.upsert()` is called from exactly one place in the entire codebase — `GovernanceService.set()`. `KnowledgeService` and `NotesService` call only `findByKey()` (read), never `upsert()`. `GovernanceService` is genuinely, not just nominally, the sole writer | `features/governance/services/GovernanceService.ts` | `RUNTIME`, exhaustively grep-verified (strongest evidence tier short of a live-database test) |

---

# 12. Document 11 (Security & Authentication)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §2, §6 | Database session strategy | Unchanged, still not live-request-tested | `lib/auth/index.ts` | `RUNTIME` (implemented, structural) |
| §6 (amended) | Archived users cannot authenticate | Unchanged, still not live-tested | `lib/db/soft-delete-extension.ts` + `lib/auth/index.ts` | `RUNTIME` (logically sound, not live-tested) |
| §7 | Authorization lives in Services, ownership checks required | **Closed.** All six Services perform ownership authorization as described in Doc 7 §21's row above — this was the single largest `N/A (not yet built)` item in Revision 2, now fully demonstrated and test-verified | `features/*/services/*.ts` | `RUNTIME`, test-verified |
| §8 | Middleware performs a cheap presence check only | Unchanged | `middleware.ts` | `RUNTIME` (implemented, not live-request-tested) |
| §9 | Env vars centralized, typed, Zod-validated | Unchanged | `config/env.ts`, `tests/unit/env.test.ts` | `COMPILE-TIME`, `RUNTIME`, test-verified |
| §10 | Single-user MVP gate | Unchanged, still not live-tested; correctly, no Service re-implements this gate itself — `ServiceContext.userId` is trusted as already-authenticated by the time it reaches a Service, consistent with "middleware performs a cheap presence check" plus Auth.js's `signIn` callback owning the allowlist | `lib/auth/index.ts` | `RUNTIME` (implemented, code-review-verified) |

---

# 13. Document 12 (AI Prompt Library)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| all | THINK/VALIDATE/DOCUMENT/IMPLEMENT prompt templates, output schemas, failure behavior | None of this exists in code | none | `N/A (not yet built)` — entirely Phase 5 |

---

# 14. Document 13 (Architecture Amendments)

Every amendment either (a) resolves to a rule already covered under the document it amended above, or (b) is itself a `PROCESS`/`MANUAL REVIEW` record of a decision. **Amendment 18** (Phase 3 Backend Services Architecture — transaction boundaries, governance read path, note-conversion call path) is the newest entry; every enforcement claim it makes is cross-referenced under Document 7 §8 and Document 10 §5.12 above, each independently re-verified during this audit rather than taken on the amendment's word. No independent enforcement gaps beyond what's already listed.

---

# 15. What Moved — Phase 2 Infrastructure Hardening Sprint (carried forward from Revision 2)

| Rule | Before | After | Amendment |
|---|---|---|---|
| `process.env` centralization (Doc 7 §13) | `CONVENTION` | `LINT-TIME` | Doc 13 §16, Amendment 14 |
| Markdown sanitization (Doc 7 §21) | Missing entirely | `RUNTIME`, proven against real XSS payloads | Doc 13 §17, Amendment 15 |
| Env validation failure path (Doc 11 §9) | `RUNTIME` (not exercised) | `RUNTIME`, test-verified | Doc 13 §18, Amendment 16 |
| CI/CD (Doc 7 §23) | `DOCUMENTED` only | `CI` | Doc 13 §19, Amendment 17 |

---

# 16. What Moved — Phase 3 Backend Services (new this revision)

| Rule | Before (Revision 2) | After (Revision 3) | Evidence |
|---|---|---|---|
| Business logic only in Services (Doc 7 §7) | `N/A (not yet built)` | `RUNTIME`, demonstrated across 6 Services | Doc 7 §7 row above |
| Knowledge/entity updates auditable (Doc 2 §7, Doc 3 §9) | `CONVENTION` (infra existed, unwired) | `RUNTIME`, atomicity live-verified against Postgres | Doc 3 §9 row above |
| Service→Prisma blocked (Doc 7 §8) | `N/A` (no Service existed) | `LINT-TIME`, re-verified live this audit | Doc 7 §8 row above |
| Service→AI-provider blocked (Doc 4 §3, Doc 7 §9) | `CONVENTION` (Services) | `LINT-TIME`, re-verified live this audit | Doc 5/7 §9 rows above |
| Authorization lives in Services (Doc 8 §6, Doc 11 §7) | `N/A (not yet built)` | `RUNTIME`, test-verified in all 6 Service test files | Doc 11 §7 row above |
| All external input validated via Zod (Doc 7 §11) | `N/A` for enforcement | `RUNTIME`, test-verified (15 `parseOrThrow` call sites) | Doc 7 §11 row above |
| Transaction ownership for multi-write operations (Doc 13 §20, Amendment 18 — new rule) | Did not exist as a rule before Phase 3 | `RUNTIME`, live-database-verified (forced-failure rollback proof) | Doc 7 §8 row above |
| `GovernanceRule` sole-writer discipline (Doc 13 §4) | Aspirational (no Service existed) | `RUNTIME`, exhaustively grep-verified | Doc 10 §5.12 row above |
| Unit test coverage (Doc 7 §18) | `N/A` (no tests) | `RUNTIME`, `CI` — 78 tests | Doc 7 §18 row above |

Nine rules moved from "nothing to check yet" or "depends on discipline" to something demonstrated and, in most cases, automatically re-checked on every future change (lint, compile, or CI) — not merely true today by inspection.

---

# 17. Requested Violation Check — Dependency Direction, Repository Abstraction, Transaction Ownership, Validation Ownership, Audit Ownership

Explicit audit against the five categories named in the pre-Phase-4 review prompt. Method: live ESLint checks with deliberate violating files (written, tested, deleted — not committed), and exhaustive `grep` across every Service and Repository file, not inspection of a sample.

| Category | Check performed | Result |
|---|---|---|
| **Dependency direction** | Every Service file's imports scanned for `@/generated/prisma`, `@/lib/db/client`, `@/ai/providers/**`, or another `@/features/*/services/*` | **No violations.** Zero real matches (one false-positive grep hit was prose in a comment, not an import — confirmed by reading the line). ESLint independently blocks all three forbidden import categories, re-verified live |
| **Repository abstraction** | Every Service constructor's dependency types checked for concrete Repository classes vs. `*RepositoryLike` interfaces; every Repository file scanned for imports of another concrete Repository | **No violations.** All 19 constructor parameters across the 6 Services are typed against a `*RepositoryLike` interface (concrete classes appear only as default-parameter *values*, e.g. `= new ProjectRepository()`, never as the parameter's *type*). No Repository imports another Repository — only the shared generic `Repository<T,C,U>` type |
| **Transaction ownership** | Every Service method performing 2+ writes checked for a single enclosing `withTransaction` | **No violations.** Write-call count equals `withTransaction`-wrapped-write count in every file; live-verified atomicity (forced-failure rollback proof, Doc 7 §8 row above) |
| **Validation ownership** | Every Service method accepting `unknown`/free-form input checked for a leading `parseOrThrow` call | **No violations.** 15 call sites, one per input-accepting method; `id`-only methods (`archive`/`restore`/`publish`/`unpublish`) correctly have none |
| **Audit ownership** | Every entity-mutating repository call (`create`/`update`/`archive`/`restore`/`upsert`) checked for a paired `auditLogRepository.record()` call in the same method | **No violations.** Write-call count equals audit-record-call count in every Service file (one apparent mismatch in `NotesService.ts` during the initial grep pass turned out to be a comment referencing `KnowledgeService.create()` in prose, not a real call — re-confirmed by reading the surrounding code) |

**One new finding, not a Service violation but a boundary gap now live because Services exist:** nothing blocks a future `app/**` or `components/**` file from importing a Service directly (e.g. `import { ProjectService } from "@/features/projects/services/ProjectService"` inside `app/`), which would skip the Route Handler layer Document 7 §8's chain specifies. This compiled and linted clean when tested live this audit. It was `N/A` in Revision 2 because no Service existed to import; it is a real, actionable gap now. **Recommendation, not applied** (this audit changes no code): extend the existing `components/**`/`app/**` ESLint block to also cover `@/features/*/services/**`, narrowed if needed once Server Components' legitimate direct-Service-call pattern (if the team wants to allow it) is decided — that's a Phase 4 design question, not a Phase 3 defect.

---

# 18. Summary — Rules Still Enforced Only By Convention

Updated for Phase 3 — items closed this phase are removed; one item is added.

1. **Naming conventions** (Doc 6, most of it) — no automated casing/suffix checks. Now includes a *specific* new instance: nothing lint-enforces "class name ends in `Service`" even though all six current ones comply.
2. **Cross-feature import boundary at the UI-component level** (Doc 5 §20) — no lint rule; still `N/A` in practice since no Component exists yet.
3. **Component → Service direct import, skipping the Route layer** (Doc 7 §8) — **new this revision**, see §17 above. The single most actionable finding in this audit.
4. **No `ts-ignore` without justification, import ordering, catch-block error handling** (Doc 7 §3, §10, §16) — unchanged, still unchecked.
5. **Phase-gating itself** (Doc 9) — unchanged, 100% `PROCESS`, and per the prior revision's note, intentionally so.
6. **Raw SQL soft-delete documentation** (Doc 7 §8, amended) — unchanged, `MANUAL REVIEW` by design (a documentation requirement, not a technical one).
7. **"Business logic only in Services" as a negative constraint** (Doc 7 §7) — the positive claim (Services *do* own the logic) is now `RUNTIME`-demonstrated; the negative claim (nothing else *could*) remains convention-dependent until Route Handlers/Components exist to test against.

Everything **not** on this list that claims `RUNTIME`/`LINT-TIME`/`COMPILE-TIME`/`DATABASE`/`PRISMA`/`CI` enforcement above has been verified working this audit or in Phase 3 itself — against a live Postgres instance, a live ESLint violation, an exhaustive grep, or a real test run — not by inspection alone. The one `RUNTIME` item still marked "not live-tested" is unchanged from Revision 2: the Auth.js magic-link sign-in flow and middleware's actual HTTP-request behavior are implemented and structurally verified, but nobody has run `next dev` and made a real request. This is now squarely in scope for Phase 4, once real routes and pages exist to test against — Document 14 will need a Revision 4 once that happens.

---

END OF DOCUMENT 14
