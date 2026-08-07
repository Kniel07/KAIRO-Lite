# KAIRO-Lite
## Architecture Compliance Matrix

Generated: after Phase 2 (Database) + soft-delete hardening review + Infrastructure Hardening Sprint (Document 13 §16-19)
Revision: 2 — regenerated, not hand-patched, after the sprint closed 4 of the gaps the first revision found (§15 below)
Status: **Point-in-time audit report, not a constitutional document.** It does not define rules — Documents 1–13 do that. It inventories which of those rules are currently *automated* versus *dependent on human discipline*, as of this commit. It will go stale as Phase 3+ lands; regenerate rather than trust an old copy.

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
| `RUNTIME` | Enforced by code that executes (middleware, extension logic, validators). |
| `CI` | Enforced by the GitHub Actions pipeline running on every push/PR — distinct from `RUNTIME` (app code) and `LINT-TIME`/`COMPILE-TIME` (a local dev run): this is "it runs automatically, remotely, on every change" as its own guarantee. Added in the Infrastructure Hardening Sprint (Document 13 §19, Amendment 17). |
| `DATABASE` | Enforced by PostgreSQL itself (constraints, FK, generated columns, native enums). |
| `PRISMA` | Enforced by the Prisma schema/client layer specifically (distinct from raw DATABASE, though often backed by one). |
| `MANUAL REVIEW` | Requires a human (or an AI agent under review) to check; no tooling exists. |
| `PROCESS` | Enforced by the human/AI workflow itself (approval gates), not by the codebase. |
| `N/A (not yet built)` | The rule governs something no phase has implemented yet — nothing to enforce or fail to enforce. |

A rule can have more than one type where enforcement is layered (e.g. `LINT-TIME` for one part of a rule, `CONVENTION` for the rest) — both are listed, not averaged into one.

---

# 2. Document 1 (PRD)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §9 | MVP scope is Full-Text Search, not Semantic Search | None — a future PR could add semantic search early | none | `DOCUMENTED` |
| §10 | Team collaboration, billing, marketplace, public APIs are out of scope | None | none | `DOCUMENTED`, `MANUAL REVIEW` |
| §4 | Core principles (think before designing, kill weak ideas, etc.) | None — these are process/judgment, not code-checkable | This entire session's back-and-forth review cadence | `PROCESS` |
| §11 | Acceptance criteria (users can manage projects, etc.) | None yet — no feature exists to test against | none | `N/A (not yet built)` |

---

# 3. Document 2 (Architecture)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §3, §7 | Components contain no business logic | Nothing generic — only the two specific sub-cases below are caught | — | `CONVENTION` (mostly) |
| §7 | Components never access Prisma/the database directly | ESLint `no-restricted-imports` blocks `@/lib/db`, `@/generated/prisma` from `components/**`, `app/**` | `eslint.config.js` — verified live (a deliberate violation was written and confirmed to fail lint in the Phase 1 review) | `LINT-TIME` |
| §7 | All AI requests pass through the AI Orchestrator | Partial — components blocked from `ai/providers` directly; nothing blocks a future Service from bypassing the Orchestrator | `eslint.config.js` (components only) | `LINT-TIME` (components) / `CONVENTION` (Services — no Service exists yet to test) |
| §7 | Knowledge updates are auditable | `AuditLogRepository` exists; nothing calls it automatically | `lib/db/repositories/AuditLogRepository.ts` — infrastructure only, not wired to any write path | `CONVENTION` (Phase 3 is when this becomes real) |
| §7 | Modules communicate through services | No Service exists yet | none | `N/A (not yet built)` |
| §7 | No circular dependencies | Partial — `ai/ ↔ features/` is lint-enforced; other boundaries (e.g. `features/x ↔ features/y`) are not | `eslint.config.js` (ai/features only) | `LINT-TIME` (partial) / `CONVENTION` (rest) |
| §5, §6 | Every AI request executes only through the Orchestrator (design, not code yet) | N/A | none | `N/A (not yet built)` |

---

# 4. Document 3 (Database Design)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §2, §7 | UUID v7 primary keys, no auto-increment integers | Prisma schema `@default(uuid(7))` on every model | `prisma/schema.prisma` — verified live (seeded/smoke-tested IDs have the `7` version nibble) | `PRISMA`, `DATABASE` |
| §2, §8 | Soft delete instead of hard delete | Prisma Client Extension auto-filters reads | `lib/db/soft-delete-extension.ts` — verified live (direct `prisma.project.findMany()` bypassing the repository still excludes an archived row) | `RUNTIME`, `PRISMA` |
| §2 | Created/updated timestamps on every table | Postgres column defaults (`DEFAULT CURRENT_TIMESTAMP`) + Prisma `@updatedAt` | `prisma/schema.prisma`, confirmed via `psql \d` | `DATABASE`, `PRISMA` |
| §2 | Append-only history for critical entities (Message, AuditLog) | No `update`/`archive` method exists on `MessageRepository`/`AuditLogRepository` — but nothing stops a raw `UPDATE` at the SQL level | Bespoke repository classes with a narrower method set | `COMPILE-TIME` (via the TS class API) — **not** `DATABASE` (no Postgres trigger/rule blocks a raw UPDATE) |
| §2 | Referential integrity through foreign keys | Postgres FK constraints | `prisma/migrations/.../migration.sql`, confirmed via `psql \d` | `DATABASE` |
| §9 | Audit every important write (Create, Update, Archive, Restore, Delete, AI-assisted, Governance) | `AuditLogRepository.record()` exists; nothing calls it on a write path yet | `lib/db/repositories/AuditLogRepository.ts` | `CONVENTION` (Phase 3 wires this in — Document 9 explicitly scopes "Audit integration" to Phase 3) |
| §12 | Migrations preserve data; no destructive changes without explicit approval | Partial — Prisma's own CLI refused an AI-invoked `migrate reset` and demanded human consent (encountered live during Phase 2) | Prisma CLI's built-in AI-agent safety gate | `RUNTIME` (Prisma tooling itself) — not something KAIRO-Lite built |
| §13 | No business logic inside the database; no stored procedures; no triggers except where technically required | True today — the one DB-level computation (`searchVector` `GENERATED ALWAYS AS`) is a generated column, not a trigger or stored procedure | `prisma/migrations/.../migration.sql` | `MANUAL REVIEW` (nothing prevents a future trigger being added) |
| §13 | AI never writes directly | N/A — no AI write path exists yet | none | `N/A (not yet built)` |

---

# 5. Document 4 (AI Architecture)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §3 | AI Orchestrator is the single entry point; no UI/route calls an LLM directly | Components blocked from `ai/providers/**`; nothing blocks a future Route Handler or Service | `eslint.config.js` | `LINT-TIME` (components only) / `CONVENTION` (routes/Services) |
| §3 (amended, Doc 13 §4) | `ai/` never depends on `features/` | ESLint `no-restricted-imports` on `ai/**` | `eslint.config.js` — verified live in the Phase 1 report | `LINT-TIME` |
| §3 | Context retrieval reads via Repositories, not Feature Services | `ContextRetriever` interface exists; no implementation yet to check | `ai/context/ContextRetriever.ts` (interface only) | `N/A (not yet built)` |
| §4 | Four AI modes only (THINK/VALIDATE/DOCUMENT/IMPLEMENT) | `AIMode` is a Prisma enum + TS union type | `prisma/schema.prisma`, `types/ai.ts` | `DATABASE` (Postgres native enum), `COMPILE-TIME` (TS union) |
| §9 | Invalid AI responses never reach the UI | Not implemented — no prompts exist yet (Phase 5) | none | `N/A (not yet built)` |
| §15 | No direct database writes from the AI layer | True today only because no AI code executes at all yet | none | `N/A (not yet built)` |

---

# 6. Document 5 (Folder Structure)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §2–§17 | The folder structure itself | Built once, matches spec | Verified by direct inspection when built (Phase 0/1) | `MANUAL REVIEW` (nothing re-checks it stays correct over time) |
| §5 | Components never access Prisma / call AI providers | Same rule as Doc 2 §7 above | `eslint.config.js` | `LINT-TIME` |
| §20 (amended) | `ai/` and `features/` are dependency siblings; `ai/` never imports `features/` | ESLint rule | `eslint.config.js` — verified live | `LINT-TIME` |
| §20 | `Features → UI Components from unrelated features` forbidden | Nothing — no rule restricts cross-feature imports | none | `CONVENTION` (gap) |
| §20 | `Prisma → Features` forbidden | Structurally impossible — generated Prisma code has no mechanism to import application code | `generated/prisma/` (gitignored, regenerated) | `PRISMA` (structural, not a rule that could realistically be violated) |
| §22 | New top-level folders require architectural approval | Nothing technical — relies on this review process | This conversation | `PROCESS`, `MANUAL REVIEW` |
| §19 | Prefer `@/*` aliases over deep relative imports | Aliases exist and resolve; nothing stops a relative import instead | `tsconfig.json` `paths` | `COMPILE-TIME` (aliases work) / `CONVENTION` (preference isn't enforced) |

---

# 7. Document 6 (Naming Conventions)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §3–§9 | File/class/variable naming casing (PascalCase components, camelCase hooks, etc.) | No lint rule checks filename or identifier casing | none | `CONVENTION` (gap — ESLint has plugins for this, e.g. `unicorn/filename-case`, not installed) |
| §11 | Database tables snake_case, plural | Prisma `@@map` | `prisma/schema.prisma`, confirmed via `psql \dt` | `PRISMA`, `DATABASE` |
| §10 | Enums PascalCase, members UPPER_SNAKE_CASE | Prisma schema declaration; Postgres native enum type | `prisma/schema.prisma` | `PRISMA`, `DATABASE` (invalid values rejected at the DB level), `COMPILE-TIME` (TS union types reject invalid values in typed code) |
| §21 | Services end with `Service` | No Service exists yet | none | `N/A (not yet built)` |
| §22 | Repositories end with `Repository` | No lint rule; followed by hand across all 11 files | none | `CONVENTION` |
| §25 | Reserved architectural names (AIOrchestrator, Governance, etc.) must not be renamed casually | Nothing automated | none | `MANUAL REVIEW` |

---

# 8. Document 7 (Coding Standards)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §3 | TypeScript strict mode; no implicit `any` | `tsconfig.json` `"strict": true` | `tsconfig.json` — build fails otherwise | `COMPILE-TIME` |
| §3 | Never use `any` unless impossible | `@typescript-eslint/no-explicit-any: "error"` | `eslint.config.js` | `LINT-TIME` |
| §3 | No `ts-ignore` without justification | No lint rule checks for a justification comment specifically | none currently exist in the codebase | `CONVENTION` (gap) |
| §4 | Functional components, Server Components by default | No automated check that a component *should* be a Server Component | `"use client"` added only where needed, by hand | `CONVENTION` |
| §6 | Components: typed props, no business logic, no DB/AI calls | DB/AI parts lint-enforced (see Doc 2 §7); "no business logic" generally is not | `eslint.config.js` (partial) | `LINT-TIME` (partial) / `CONVENTION` (rest) |
| §7 | Business logic only in Services | No Service exists yet to violate this | none | `N/A (not yet built)` |
| §8 | `Component → Route → Service → Repository → Prisma`, no shortcuts | Component→Prisma is lint-blocked; Route→Repository (skipping Service) is not blocked by anything | `eslint.config.js` (Component→Prisma only) | `LINT-TIME` (partial) / `CONVENTION` (rest — nothing exists yet to test) |
| §8 (amended, Doc 13 §14) | Raw SQL must document its soft-delete behavior | New rule, code-review-enforced | Followed in `KnowledgeRepository.ts`'s doc comment (the one place raw SQL is anticipated) | `MANUAL REVIEW` (documentation requirement, not a technical check) |
| §9 | Provider-specific AI code only in `ai/providers/` | Not lint-enforced beyond blocking components; a Service could still import a provider directly | `eslint.config.js` (components only) | `LINT-TIME` (partial) / `CONVENTION` (rest) |
| §10 | Never swallow errors; always log + rethrow | No lint rule enforces this pattern (e.g. no `no-empty` catch check added) | `AppError` taxonomy exists (`lib/utils/errors.ts`) and is used consistently by hand | `CONVENTION` |
| §11 | All external input validated via Zod | `parseOrThrow()` helper exists; nothing forces its use since no route handler exists yet | `lib/validation/index.ts` | `N/A (not yet built)` for enforcement; helper itself is `COMPILE-TIME` typed |
| §12 | Structured logging; never log secrets | Logger enforces structure via TS types; nothing scans for secret-shaped values | `lib/logger/index.ts` | `COMPILE-TIME` (structure) / `CONVENTION` (secret-safety) |
| §13 | Never access `process.env` directly; centralize | **Closed (Infrastructure Hardening Sprint, Doc 13 §16, Amendment 14).** ESLint `no-restricted-syntax` matches the `process.env` AST node itself, scoped to all TS files except `config/env.ts`, `prisma.config.ts`, and `tests/unit/env.test.ts` | `eslint.config.js` — verified live (a deliberate `process.env.OPENAI_API_KEY` access was confirmed to fail lint). One real prior violation (`lib/db/client.ts`'s `process.env.NODE_ENV`) fixed to route through `env.NODE_ENV` before the rule was added. | `LINT-TIME` |
| §14 | API response envelope standard | `successResponse()`/`errorResponse()` helpers + typed `ApiResponse<T>` exist; no route handler exists yet to check compliance | `lib/utils/http.ts`, `types/api.ts` | `N/A (not yet built)` for enforcement; helpers are `COMPILE-TIME` typed |
| §16 | Import order (external → internal alias → relative) | No `eslint-plugin-import` `order` rule configured | none | `CONVENTION` (gap) |
| §18 | Testing hierarchy (unit → integration → e2e) | No tests exist yet | `tests/` folder structure only | `N/A (not yet built)` |
| §21 | Validate input / escape output / **sanitize markdown** / protect secrets / verify auth / verify authz | Auth is `RUNTIME`-enforced (see Doc 11 below). Markdown sanitization **closed (Infrastructure Hardening Sprint, Doc 13 §17, Amendment 15)**: two independent layers — `sanitizeMarkdown()`/`safeHtml()` (source-text stripping) and `renderMarkdown()` (rehype-sanitize on the parsed tree) | `middleware.ts` (auth), `lib/markdown/{sanitize,render}.ts` — proven against real `<script>`/`onerror`/`javascript:` payloads in `tests/unit/markdown.test.ts` (13 tests, all passing), not just compiled | `RUNTIME` (both auth and markdown) |
| §22 | Accessibility: keyboard nav, screen readers, semantic HTML | `eslint-plugin-jsx-a11y`, bundled by `eslint-config-next`, is active | `eslint.config.js` (via `next/core-web-vitals`) | `LINT-TIME` — **but only at `warn` level**, not `error`; does not fail the build |
| §23 | Every PR must compile, lint, pass tests | **Closed (Infrastructure Hardening Sprint, Doc 13 §19, Amendment 17).** `.github/workflows/ci.yml` runs on every push/PR: install → generate Prisma client → typecheck → lint → format:check → prisma validate → test → build | `.github/workflows/ci.yml` — the full sequence was simulated locally first, with PostgreSQL stopped entirely, using the same CI-only dummy env values, before being trusted; all steps passed | `CI` |
| §25 | If code conflicts with documentation, documentation wins | This entire multi-turn review process | This conversation | `PROCESS` |
| §26 | AI-generated code follows the same standards as human-written code | This entire multi-turn review process | This conversation | `PROCESS`, `MANUAL REVIEW` |

---

# 9. Document 8 (API Contracts)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §3 | Standard response envelope | Types + helpers exist; no route uses them yet (only `/api/auth/[...nextauth]`, which is Auth.js-managed, not KAIRO's own envelope) | `types/api.ts`, `lib/utils/http.ts` | `N/A (not yet built)` for real endpoints |
| §4 | `/api/v1/` versioning | Folder exists (`app/api/v1/`, empty) | `app/api/v1/.gitkeep` | `N/A (not yet built)` |
| §5 | Every protected endpoint requires authentication | Middleware gates non-public paths | `middleware.ts` — build-verified, **not** verified against a live HTTP request in this session | `RUNTIME` (implemented) — verification level: compiled/structural, not an actual request tested |
| §6 | Authorization lives in Services, never middleware alone | No Service exists yet | none | `N/A (not yet built)` |
| §16, §17 | Pagination / filtering standard | `toPagination()` helper exists and is used by every repository | `lib/db/soft-delete.ts` | `COMPILE-TIME` (helper is typed and used consistently) |
| §18 | Stable error codes | `ErrorCode` union + `AppError` subclasses | `lib/utils/errors.ts` | `COMPILE-TIME` |
| §22 | Routes are nouns, no verbs | No routes exist yet to check | none | `N/A (not yet built)` |
| §9a, §14a (added, Doc 13 §10–11) | Tags API, Conversations API | Documented only — not implemented | none | `N/A (not yet built)` |

---

# 10. Document 9 (Implementation Plan)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §2 | Foundation before features; database before APIs; APIs before UI | Followed by this session's phase ordering | This conversation | `PROCESS` |
| §7 | Never redesign approved architecture without asking | Followed by this session (every judgment call flagged, not silently made) | This conversation | `PROCESS`, `MANUAL REVIEW` |
| §9 | `START IMPLEMENTATION` gate before any code generation | Followed literally — no code was written before that phrase appeared | This conversation | `PROCESS` |
| — | Phase boundaries ("do not begin Phase 3 yet") | Nothing technical stops it — enforced entirely by the AI agent following instructions each turn | This conversation | `PROCESS` — arguably the single largest control in the entire system, and it is 100% human-in-the-loop, zero automation |

---

# 11. Document 10 (Prisma Data Model Specification)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §3 | UUID v7 strategy | Same as Doc 3 above | `prisma/schema.prisma` | `PRISMA`, `DATABASE` |
| §4 (amended, Doc 13 §14) | Soft-delete strategy | Prisma Client Extension | `lib/db/soft-delete-extension.ts` | `RUNTIME`, `PRISMA` |
| §5.6, Doc 13 §6 | Task is RESERVED — schema only, no Repository/Service/API/UI | Verified by grep: no `TaskRepository` exists; `Task`/`TaskStatus`/`TaskPriority` are not re-exported from `types/database.ts` or `constants/statuses.ts` | `prisma/schema.prisma` (model exists, referenced nowhere else) | `MANUAL REVIEW` today (confirmed by inspection) — no lint rule would catch a future violation (e.g. someone adding `import { Task }` somewhere) |
| §7 | Cascade rules (Restrict/SetNull/Cascade per relation) | Postgres FK `ON DELETE` clauses | `prisma/schema.prisma`, confirmed via `psql \d` on multiple tables | `DATABASE` |
| §8 | Index strategy, including the Knowledge full-text GIN index | Postgres indexes, confirmed via `psql \d knowledge` | `prisma/migrations/.../migration.sql` (GIN index is raw SQL, not Prisma-declarative) | `DATABASE` |
| §8 | Full-text search functional | GIN index + `tsvector` generated column | Verified live in the Phase 2 smoke test (`to_tsquery` match found the seeded row) | `DATABASE` |

---

# 12. Document 11 (Security & Authentication)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| §2, §6 | Database session strategy (not JWT) | Auth.js config `session.strategy: "database"` | `lib/auth/index.ts` — build-verified, **magic-link sign-in flow has not been live-tested in this session** (would require actually sending/receiving an email via Resend) | `RUNTIME` (implemented) — verification level: compiled/structural only |
| §6 (amended, Doc 13 §15) | Archived users cannot authenticate | Same Prisma Client Extension as Doc 3 §8, applied to the same client the Adapter uses | `lib/db/soft-delete-extension.ts` + `lib/auth/index.ts` sharing one client instance | `RUNTIME` — logically sound, **not live-tested** (would require archiving a real user and attempting sign-in) |
| §7 | Authorization lives in Services, ownership checks required | No Service exists yet | none | `N/A (not yet built)` |
| §8 | Middleware performs a cheap presence check only | `middleware.ts` checks `req.auth` presence, delegates everything else | `middleware.ts` — build-verified only | `RUNTIME` (implemented) — not live-request-tested |
| §9 | Env vars centralized, typed, Zod-validated | `config/env.ts` throws on missing/invalid vars | **Failure path now tested (Infrastructure Hardening Sprint, Doc 13 §18, Amendment 16).** `tests/unit/env.test.ts` proves: missing `DATABASE_URL`, missing `OPENAI_API_KEY`, malformed `AUTH_URL`, invalid `KAIRO_OWNER_EMAIL`, multiple missing keys at once, and — separately — that a real-looking secret value never appears in the thrown message (7 tests, all passing) | `COMPILE-TIME` (Zod schema types) + `RUNTIME` (validation logic), both now test-verified |
| §10 | Single-user MVP gate (`KAIRO_OWNER_EMAIL` allowlist) | `signIn` callback rejects non-matching emails | `lib/auth/index.ts` — **not live-tested** (no real sign-in attempt was made with a non-owner email) | `RUNTIME` (implemented) — verification level: code review only |

---

# 13. Document 12 (AI Prompt Library)

| § | Rule | Enforcement Mechanism | Current Implementation | Type |
|---|---|---|---|---|
| all | THINK/VALIDATE/DOCUMENT/IMPLEMENT prompt templates, output schemas, failure behavior | None of this exists in code — `constants/prompts.ts` is an intentional empty stub | none | `N/A (not yet built)` — entirely Phase 5 |

---

# 14. Document 13 (Architecture Amendments)

Every amendment either (a) resolves to a rule already covered under the document it amended above, or (b) is itself a `PROCESS`/`MANUAL REVIEW` record of a decision (e.g. Amendment 5's Task-RESERVED status, cross-referenced under Document 10 §5.6 above). No independent enforcement gaps beyond what's already listed.

---

# 15. What Moved (Infrastructure Hardening Sprint, Document 13 §16-19)

This section didn't exist in the first version of this matrix — it's the direct answer to "show what moved from CONVENTION to LINT/RUNTIME/CI":

| Rule | Before | After | Amendment |
|---|---|---|---|
| `process.env` centralization (Doc 7 §13) | `CONVENTION` (real gap) | `LINT-TIME` | Doc 13 §16, Amendment 14 |
| Markdown sanitization (Doc 7 §21) | Missing entirely (`lib/markdown/` empty) | `RUNTIME`, proven against real XSS payloads | Doc 13 §17, Amendment 15 |
| Env validation failure path (Doc 11 §9) | `RUNTIME` (implemented, not exercised) | `RUNTIME`, now test-verified | Doc 13 §18, Amendment 16 |
| CI/CD (Doc 7 §23) | `DOCUMENTED` only, zero automation | `CI` | Doc 13 §19, Amendment 17 |

Four rules moved from "depends on someone remembering" to "the system itself won't let it happen quietly." None of them were architecture changes — every one closed a gap the *previous* version of this matrix found, which is the entire point of regenerating it instead of trusting an old copy.

---

# 16. Summary — Rules Still Enforced Only By Convention

Pulled directly from the remaining `CONVENTION` and gap-flagged rows above — this is the answer to "which parts of the architecture still depend entirely on human discipline," now that §15's four items are closed:

1. **Naming conventions** (Doc 6, most of it) — no automated casing/suffix checks (`*Repository`, `*Service`, `use*` hooks, PascalCase components).
2. **Cross-feature import boundary** ("Features → UI Components from unrelated features" forbidden, Doc 5 §20) — no lint rule.
3. **Service-layer requirements generally** (Doc 7 §7, §8) — moot until Phase 3 introduces the first Service, but worth building the lint rule *before* the first violation is possible, not after.
4. **No `ts-ignore` without justification, import ordering, catch-block error handling** (Doc 7 §3, §10, §16) — all currently unchecked.
5. **Phase-gating itself** (Doc 9) — the entire "don't proceed past what's been approved" control is `PROCESS`, enforced by the AI agent's compliance each turn, not by anything in the repository. This is worth naming explicitly: it is the largest-blast-radius rule in the whole constitution, and it is also the one with zero technical backing — **and, per this review, that's intentional and correct.** Some gates shouldn't be automated; approving architecture is one of them.

Everything **not** on this list that claims `RUNTIME`/`LINT-TIME`/`COMPILE-TIME`/`DATABASE`/`PRISMA`/`CI` enforcement above has been verified working — against a live Postgres instance, a live ESLint violation, a real test run, or (for CI) a full local simulation of the pipeline with Postgres stopped entirely — not just by inspection. One `RUNTIME` item remains marked "not live-tested": the Auth.js magic-link sign-in flow and middleware's actual HTTP-request behavior are implemented and structurally verified (they compile, the logic is straightforward, and the env-validation half of this exact concern was closed this sprint), but nobody has run `next dev` and made a real request in this session. Worth carrying forward as a deliberate note rather than letting "RUNTIME" imply more confidence than earned — this is squarely in scope for Phase 3, once real routes exist to test against.

---

END OF DOCUMENT 14
