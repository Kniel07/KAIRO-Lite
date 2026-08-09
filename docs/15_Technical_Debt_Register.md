# KAIRO-Lite
## Technical Debt Register

Generated: after Phase 2 (Database) + Infrastructure Hardening Sprint (Document 13 §16-19), before Phase 3
Status: **Derived artifact, not a constitutional document** — same standing as Document 14 (Architecture Compliance Matrix). It records conscious trade-offs already made, not rules to follow. Update it when a trade-off is made or paid down; don't let it silently drift.

---

# 1. Scope

This register contains **only intentional architectural trade-offs** — decisions where a simpler or narrower implementation was chosen on purpose, with a known, nameable cost, in favor of shipping the current phase.

Explicitly **excluded**, per the request that produced this document:

- **Bugs.** None are known. If one is found, it goes in an issue tracker, not here.
- **TODOs already scheduled with a specific phase and file marker.** E.g. `AIOrchestrator.execute()` throwing "not implemented, see Document 4 §3, Phase 5" is normal phased construction, not debt — there's nothing to decide, it's just not built yet. Same for the entire unbuilt Document 8 API surface, Document 12's prompt library, etc.
- **Design decisions with no real cost.** E.g. the bespoke (non-generic) `Repository` shape for `Message`/`AuditLog`/`Settings`/`GovernanceRule` (Document 10 §5) isn't debt — it's the correct shape for those entities, not a shortcut.

Every item below has a concrete piece of evidence from this session (a comment I wrote, a prompt I killed, a limitation I hit) — not a speculative "this could theoretically be a problem."

---

# 2. Register

Sorted by planned phase (Document 9).

---

## DEBT-001 — Repository read methods issue two round-trips, not one

| Field | Value |
|---|---|
| **Description** | Every generic repository's `findMany()` runs `findMany` and `count` as two separate `Promise.all`-parallelized queries, rather than a single query (e.g. via a window function `COUNT(*) OVER()`). |
| **Why deferred** | Document 7 §20 — "avoid premature optimization." Two parallel queries is the simplest correct implementation, and at current (zero) data volume the cost is unmeasurable. |
| **Risk** | Low today; grows with table size and request volume — doubles round-trip count on every paginated list call. |
| **Impact if unaddressed** | Slower list endpoints under real load; extra database connection pressure (compounds with DEBT-007). Not a correctness issue. |
| **Planned phase** | Phase 7 (Quality Assurance — performance review, Document 9). |
| **Owner** | Project owner (single-maintainer project, Document 1 §3). |
| **Exit criteria** | Either benchmark shows it's a non-issue at real Phase 3+ data volumes (close as won't-fix), or repositories switch to a single windowed query. |

---

## DEBT-002 — `sanitizeMarkdown()`'s strip-all-tags approach may be too aggressive

**Status: partially closed (Phase 7.5, Document 13 §28 Amendment 26).** `sanitizeMarkdown()` is now actually wired into `KnowledgeService.create`/`.update` and `DocumentService.create`/`.update` (Phase 7 Security Report finding S3 — it existed but was dead code until now). The aggressiveness limitation described below is unchanged and still open.

| Field | Value |
|---|---|
| **Description** | `lib/markdown/sanitize.ts`'s `sanitizeMarkdown()` strips every HTML-tag-shaped construct from markdown source text, which can mis-fire on legitimate prose containing bare `<`/`>` characters (e.g. `<https://example.com>` autolinks, or literal "x < y" text). Documented as a known limitation directly in the function's own comment when it was written. |
| **Why deferred** | No real Knowledge/Document content exists yet to test against real authored content at scale. Tuning against hypothetical content would be guessing. |
| **Risk** | Medium — could silently mangle legitimate user content, which is a worse failure mode than being caught by a test, because it looks like data corruption rather than a rejected request. Now live in the write path (previously dormant), so this risk is active, not theoretical. |
| **Impact if unaddressed** | User-visible content corruption in Knowledge/Document markdown for prose containing bare `<`/`>`. |
| **Planned phase** | Revisit once real authored content exists to test against (no fixed phase — data-driven, not calendar-driven). |
| **Owner** | Project owner. |
| **Exit criteria** | Test suite (`tests/unit/markdown.test.ts`) extended with real-world-shaped content samples (autolinks, code containing `<`/`>`, nested quotes); either the current approach passes or is replaced with a more surgical HTML-node-level strip (e.g. operating on the parsed mdast tree instead of the raw string). |

---

## DEBT-003 — `searchVector` lives outside the Prisma schema, creating migration-drift risk

**Status: closed (Pre-Deployment Hardening pass, Document 13 §29 Amendment 27).** The exit criteria below is met — the procedure now lives in Document 10 §8a: always `prisma migrate dev --create-only`, manually review the generated SQL for an unexpected `DROP COLUMN "searchVector"` before applying, every time. This had already missed its own documented deadline (Document 16 named it as required "before Beta, not during it") — closed now, later than intended, but closed with the exact shape this entry always described.

| Field | Value |
|---|---|
| **Description** | The Knowledge full-text search column (`searchVector`, a generated `tsvector` column + GIN index, Document 10 §8) is raw SQL appended to the migration file — it is not declarable in `schema.prisma` (Prisma has no native Postgres `tsvector`/generated-column support). This isn't a preference; it's a real limitation I hit directly: running `prisma migrate dev` again after adding it triggered a shadow-database drift prompt, because Prisma's diffing engine sees a database column `schema.prisma` doesn't know about and wants to reconcile it. I killed that interactive prompt rather than let an AI-invoked migration decision run unsupervised. |
| **Why deferred** | No alternative exists within Prisma's current declarative schema language — this is a structural constraint, not a choice I could have avoided by trying harder. |
| **Risk** | High if unmanaged — a future `prisma migrate dev` (run by a human or an AI agent) could accept Prisma's drift-correction suggestion and silently generate a migration that drops `searchVector`, breaking full-text search with no error until someone notices search is empty. |
| **Impact if unaddressed** | Silent, hard-to-diagnose loss of the Search feature (Phase 6) at some future migration. |
| **Planned phase** | Ongoing operational constraint — formalize the safe procedure before Phase 6 (Knowledge & Search) is the first phase to actively rely on `searchVector` in application code. |
| **Owner** | Project owner. |
| **Exit criteria** | A documented migration procedure (e.g., "always run `prisma migrate dev --create-only`, manually review the generated SQL for an unexpected `DROP COLUMN "searchVector"` before applying, every time") added to Document 3 or Document 10 — or, if Prisma ships native generated-column/extension support before then, migrate to that instead and retire this entry. |

---

## DEBT-004 — CI validates schema and build, but never runs against a live database

| Field | Value |
|---|---|
| **Description** | `.github/workflows/ci.yml` (Document 13 §19) runs `prisma validate` and `next build` with dummy environment values and no PostgreSQL service container — deliberately scoped that way, and verified sufficient for that scope by local simulation with Postgres stopped. It does not run `prisma migrate deploy` against a real database, and there are no integration tests that would exercise a repository against live Postgres in CI (only in this session's manual smoke tests, which weren't committed as reusable tests). |
| **Why deferred** | The Infrastructure Hardening Sprint was explicitly scoped to "TypeScript, ESLint, Prettier, Prisma Validate, Next Build" (your own Priority 1 wording) — a live-database CI job was named as "optional, later" in the same request. |
| **Risk** | Medium — a migration that's syntactically valid but fails to apply (e.g. a constraint violation against realistic data shapes) would not be caught until a human runs it manually, same as DEBT-003's drift risk but for ordinary schema changes, not just the raw-SQL column. |
| **Impact if unaddressed** | A broken migration could reach `main` with a green CI run, discovered only when someone actually tries to migrate a real database. |
| **Planned phase** | Phase 7 (Quality Assurance — Document 9 explicitly lists "Integration tests" as a Phase 7 deliverable; this is the CI infrastructure that would run them). |
| **Owner** | Project owner. |
| **Exit criteria** | `ci.yml` gains a `postgres:` service container and a job step that runs `prisma migrate deploy` (not just `validate`) plus at least the repository CRUD smoke test this session ran manually, committed as a real integration test. |

---

## DEBT-005 — No rate limiting on any endpoint

**Status: partially closed (Phase 7.5, Document 13 §28 Amendment 26).** `POST /api/v1/ai/chat` — the highest-cost, highest-abuse-risk endpoint (real per-call OpenAI spend) — is now rate-limited (`lib/rate-limit/RateLimiter.ts`, 20 requests/60s per user). The Auth.js sign-in (magic-link) route remains unlimited; reduced-scope debt below.

| Field | Value |
|---|---|
| **Description** | Document 8 §20 names rate limiting as "Future implementation" for AI, search, and authentication endpoints. The AI endpoint is now covered (Phase 7.5); the Auth.js magic-link sign-in route is not. |
| **Why deferred** | Phase 7.5's authorized scope was specifically "AI endpoint rate limiting" (the Phase 7 audit's highest-cost finding) — extending it to the sign-in route wasn't part of that authorization, and this project's pattern is to not expand a phase's scope past what was explicitly authorized (see Document 13 §27, Amendment 25, for the precedent of holding a scope boundary even when a broader fix would be easy to justify). |
| **Risk** | Low-medium — the sign-in flow is already constrained by the single-user `KAIRO_OWNER_EMAIL` allowlist (`lib/auth/index.ts`'s `signIn` callback rejects every other address before Resend is ever called), which meaningfully narrows the abuse surface versus an open sign-up flow. |
| **Impact if unaddressed** | Nuisance/DoS-adjacent abuse of the sign-in route (repeated magic-link requests) or of `SearchService`'s full-text search endpoint — neither has a real per-call monetary cost like the AI endpoint did. |
| **Planned phase** | Phase 8 (Deployment), if still desired — pinned here since Document 8 left it unscheduled. |
| **Owner** | Project owner. |
| **Exit criteria** | The same `RateLimiterLike` abstraction (`lib/rate-limit/RateLimiter.ts`) applied to the Auth.js sign-in route and/or `/api/v1/search`, with per-route limits appropriate to each. |

---

## DEBT-006 — Structured logger has no log levels, sinks, or correlation IDs beyond `console`

**Status: still open, decision recorded (Pre-Deployment Hardening pass, Document 13 §29 Amendment 27).** Document 17 §7 records the explicit decision to rely on Vercel's platform log capture initially — the "documented decision that console output piped through the hosting platform's own log capture is sufficient" branch of this entry's own exit criteria — satisfying that one clause. Log level configuration and correlation IDs remain unimplemented; not closing this entry, since the harder half of the original criteria is still outstanding.

| Field | Value |
|---|---|
| **Description** | `lib/logger/index.ts` (Document 7 §12) writes structured JSON to `console.log`/`warn`/`error`. It has no configurable log level (everything is emitted), no external sink (e.g. a log aggregation service), and no request-correlation ID threading requests through multiple log lines. |
| **Why deferred** | Adequate for a single-developer, pre-production session where all output is read directly from a terminal. Adding a logging platform integration before there's traffic to observe would be premature (Document 7 §20). |
| **Risk** | Low now; becomes a real observability gap once the app has actual users/traffic and problems need to be diagnosed after the fact rather than watched live. |
| **Impact if unaddressed** | Harder incident diagnosis in production; no way to correlate a single request's logs across the Route → Service → Repository → AuditLog chain. |
| **Planned phase** | Phase 8 (Deployment — Document 9 lists "Monitoring" and "Error reporting" as Phase 8 deliverables; this is the same category). |
| **Owner** | Project owner. |
| **Exit criteria** | A log level configuration (respecting `NODE_ENV`), an external sink integrated (or a documented decision that console output piped through the hosting platform's own log capture is sufficient), and a correlation ID generated per request and threaded through `logger.audit()`/`logger.error()` calls. |

---

## DEBT-007 — Environment validation doesn't vary by `NODE_ENV`

**Status: closed (Pre-Deployment Hardening pass, Document 13 §29 Amendment 27).** `config/env.ts` gained a `superRefine` requiring, only when `NODE_ENV === "production"`: `AUTH_URL` to start with `https://`, and the new `EMAIL_FROM` variable (RC Review finding RC1) to be present. Exit criteria met as originally specified.

| Field | Value |
|---|---|
| **Description** | `config/env.ts`'s Zod schema applies identically regardless of `NODE_ENV` — e.g. `AUTH_URL` only has to be *a* valid URL, not specifically `https://` in production. A `http://localhost:3000` value would pass validation even if `NODE_ENV=production`. |
| **Why deferred** | No production deployment exists yet (Phase 8) — writing environment-specific validation rules before there's a real production environment to validate against risks guessing wrong about what production actually requires. |
| **Risk** | Low-medium — a misconfigured production deployment (e.g. an accidentally-http `AUTH_URL`) would pass startup validation and fail in a less obvious way later, rather than failing fast at boot the way Document 7 §11's validation is supposed to guarantee. |
| **Impact if unaddressed** | A class of production misconfiguration wouldn't be caught by the exact mechanism (`config/env.ts`) built specifically to catch misconfiguration. |
| **Planned phase** | Phase 8 (Deployment). |
| **Owner** | Project owner. |
| **Exit criteria** | `envSchema` gains `NODE_ENV`-conditional refinements (e.g. `AUTH_URL` must start with `https://` when `NODE_ENV === "production"`), and `tests/unit/env.test.ts` gains a case proving it. |

---

## DEBT-008 — No database connection retry/backoff for transient failures

**Status: partially closed (Pre-Deployment Hardening pass, Document 13 §29 Amendment 27).** The hosting decision this entry's exit criteria was waiting on is now made — Vercel + Neon (Document 17 §2) — and `lib/db/client.ts`'s `PrismaPg` adapter now takes an explicit `max: 5` pool-size cap, closing the "no explicit pool size limit" half of this entry. Still open: retry/backoff for transient connection failures, and Neon's own pooled `-pooler` connection endpoint (Document 17 §3-4) needs to actually be used as `DATABASE_URL` at deploy time — a deployment-execution step, not something this repository's code can guarantee on its own.

| Field | Value |
|---|---|
| **Description** | `lib/db/client.ts` constructs a bare `pg.Pool` via `@prisma/adapter-pg` with default settings — no explicit pool size limit, no retry/backoff policy for transient connection failures (e.g. a brief network blip or database restart). |
| **Why deferred** | This session's entire verification happened against a single, always-local, always-on Postgres instance — transient failure handling has never had a real scenario to design against. Building retry logic speculatively risks over-engineering the wrong policy (Document 7 §2). |
| **Risk** | Medium — this is also where DEBT-002-style serverless connection-pool-exhaustion risk (flagged all the way back in the original Phase 0 ingestion report as an open question, and never fully resolved) actually bites: no explicit pool sizing means Vercel's per-invocation connection behavior is whatever `pg.Pool`'s defaults happen to do under serverless concurrency, untested. |
| **Impact if unaddressed** | Under real concurrent serverless load, connection exhaustion or unhandled transient failures could cause request failures that a properly configured pool/retry policy would absorb. |
| **Planned phase** | Phase 8 (Deployment) — this is exactly the "confirm Postgres hosting/pooling strategy" question the original Ingestion Report raised and left as the one open item after the constitution was otherwise finalized. |
| **Owner** | Project owner. |
| **Exit criteria** | ~~A concrete decision on hosting (Vercel Postgres / Neon / Supabase, per the original ingestion report's Q12) drives an explicit pool size configuration~~ — done: Neon chosen, `max: 5` set. Remaining: retry/backoff policy for transient connection failures, and confirming Neon's pooled `-pooler` endpoint is the actual `DATABASE_URL` used in production (Document 17 §3-4). |

---

## DEBT-009 — `npm audit` reports 3 high-severity transitive vulnerabilities (postcss, sharp)

| Field | Value |
|---|---|
| **Description** | `npm audit` reports 3 HIGH-severity advisories, both transitive via `next`: `postcss` (`<=8.5.22` — XSS via unescaped `</style>` in CSS stringification; arbitrary/path-traversal file read via attacker-controlled `sourceMappingURL` in CSS comments) and `sharp` (`<0.35.0` — inherited libvips CVEs). The only fix path is `npm audit fix --force`, which upgrades `next` to `16.3.0` — a breaking major-version change. |
| **Risk-acceptance decision (Phase 7.5, Document 13 §28 Amendment 26)** | **Accepted, not fixed, as of this phase.** Verified both vulnerable code paths are unreachable in this app: `postcss` processes only this project's own trusted CSS at build time (Tailwind's build pipeline) — the app never runs PostCSS against user-supplied or runtime-sourced CSS/comments, so the `sourceMappingURL`/`</style>` injection vectors have no attacker-controlled input to reach them. `sharp` is a transitive dependency of Next.js's built-in image-optimization API, exercised only through the `next/image` component or the `/_next/image` route — confirmed via `grep -rn "next/image\|<Image"` across the entire app that neither is used anywhere; there is no image-upload feature in the MVP (Notes/Knowledge/Documents are markdown/text only). `sharp`'s vulnerable code path is present in `node_modules` but never invoked by any route this app serves. |
| **Why deferred rather than fixed immediately** | The fix requires a `next` major-version upgrade, which is a breaking change needing its own scoped, tested change — not a drop-in patch — and both CVEs are confirmed unreachable today, so there is no active risk to justify rushing it. |
| **Impact if left unaddressed indefinitely** | None while `next/image` and PostCSS-of-untrusted-input stay unused. Becomes real risk the moment either is introduced (e.g. a future image-upload feature, or ingesting user-supplied CSS/theming) — re-evaluate at that point, not before. |
| **Planned phase** | Phase 8 (Deployment) or whenever a `next` major-version upgrade is otherwise on the roadmap — bundle this with that work rather than a standalone forced upgrade. |
| **Owner** | Project owner. |
| **Exit criteria** | Either (a) `next` is upgraded to a version without these transitive vulnerabilities as part of an already-planned major-version bump, verified with a full re-run of `npm audit` plus the existing test/build suite, or (b) `next/image`/PostCSS-of-untrusted-input is introduced, at which point this becomes a blocking finding instead of accepted debt. |

---

# 3. Explicitly Not Debt (checked, rejected)

A few things considered for this register and deliberately left out, with reasoning, so the exclusion is a decision rather than an oversight:

- **`Task` model exists but is unused (RESERVED).** Not debt — it's a documented, intentional placeholder (Document 10 §5.6, Document 13 §6) with its own explicit "do not build on this" status. There is nothing to pay down; the exit criteria is simply "someone decides to un-reserve it," which is a product decision, not a technical one.
- **No Services exist yet.** Not debt — Phase 3 hasn't started. Nothing was skipped; it's next.
- **Phase-gating is process-only, not automated.** Explicitly endorsed as correct in the prior review ("some gates shouldn't be automated"). Not debt by design.
- **GovernanceRule table exists with no runtime enforcement wired up yet.** Already scheduled to Phase 3 by Document 13 §5 (Amendment 4) — excluded per this register's own scope rule.

---

END OF DOCUMENT 15
