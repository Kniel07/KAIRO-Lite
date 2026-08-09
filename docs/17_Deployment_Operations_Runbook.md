# KAIRO-Lite
## Deployment & Operations Runbook

Generated: during the Pre-Deployment Hardening pass, after the Release Candidate (RC) Review, before Phase 8 (Deployment)
Status: **Derived artifact, not a constitutional document** — same standing as Documents 14, 15, and 16. It operationalizes decisions already made (Documents 1, 2, 9, 11, 16) plus the specific hosting/database/monitoring choices made during the RC follow-up; it does not add, remove, or reinterpret any architectural rule. Update it as the operational picture changes; don't let it drift from what's actually deployed.

---

# 1. Purpose

The RC Review (conducted read-only, ahead of this document) found that several Phase 8 "Deployment" and "Operations" deliverables (Document 9) were entirely undecided rather than partially built: hosting platform, database provider, backup strategy, rollback procedure, and monitoring approach. This document is where those decisions are recorded once made, and where the resulting procedures (migration, rollback, release checklist) live so they exist somewhere other than one person's memory.

Nothing here overrides Document 9, 11, or 16. Where this document and those conflict, the constitutional documents win (Document 7 §25), same rule Document 16 already states for itself.

---

# 2. Confirmed Production Stack

Decided during the Pre-Deployment Hardening pass, following the RC Review's explicit call-out that these were open decisions, not implementation gaps (RC Review §7, "Outstanding Decisions").

| Component | Choice | Rationale |
|---|---|---|
| Hosting / compute | **Vercel** | Already assumed throughout Documents 1, 2, 9, 16; the database-session strategy (Document 11 §6) was specifically built around Next.js's Node.js Middleware runtime, which Vercel supports natively — changing platforms now would mean re-validating that assumption, not just picking a different host. |
| Database | **Neon (serverless Postgres)** | Directly addresses Document 15 DEBT-008 (connection pooling under serverless concurrency was untested); decouples the database from the hosting vendor; strong Prisma compatibility; branching is useful for testing future migrations (including anything touching `searchVector`, per Document 10 §8a) without risking production data. |
| ORM | Prisma (`@prisma/adapter-pg`) | Already implemented — unchanged. |
| Authentication | Auth.js v5 + Resend | Already implemented — unchanged. |
| AI provider | OpenAI | Already implemented — unchanged. |
| Monitoring / error reporting | **Deferred to Phase 8 or immediately post-deployment** | Sentry is the intended choice once added, but is explicitly not being wired in during this pass — no `@sentry/nextjs` dependency has been installed. See §7. |
| Logging | **Vercel's platform log capture, initially** | An explicit decision (Document 15 DEBT-006's exit criteria accepts "a documented decision that console output piped through the hosting platform's own log capture is sufficient" as a valid closure) — not a gap. Revisit if/when log volume or diagnosis needs outgrow what platform capture provides. |
| Rate limiting | **Current in-memory limiter (`lib/rate-limit/RateLimiter.ts`), kept as-is** | An explicit, accepted decision, not an oversight — see §6 for the tradeoff this implies under Vercel's serverless concurrency model. |

---

# 3. Environment Variables — Production Checklist

`config/env.ts` is the single source of truth for what's required; this is the deployment-facing checklist derived from it, including the two checks added during this pass that only activate once `NODE_ENV=production`:

| Variable | Production requirement | Where it comes from |
|---|---|---|
| `NODE_ENV` | `production` | Set automatically by Vercel |
| `DATABASE_URL` | Neon's **pooled** connection string (the `-pooler` hostname suffix) — see §4 | Neon project dashboard |
| `AUTH_SECRET` | A freshly generated secret (`npx auth secret`), never reused from development | Generated once, stored in Vercel's environment variables |
| `AUTH_URL` | Must start with `https://` — **enforced at boot** as of this pass (`config/env.ts`'s production-only `superRefine`, closing Document 15 DEBT-007 / RC Review finding RC3) | The production domain Vercel assigns or the custom domain configured |
| `RESEND_API_KEY` | Production Resend API key | Resend dashboard |
| `EMAIL_FROM` | A verified Resend sending domain — **enforced at boot** in production as of this pass (previously a hardcoded placeholder, `config/app.ts`, RC Review finding RC1) | Verify a domain in Resend first, then set this |
| `KAIRO_OWNER_EMAIL` | The real owner's email (single-user MVP gate, Document 11 §10) | — |
| `OPENAI_API_KEY` | Production OpenAI API key | OpenAI dashboard — **set a spend limit here before deploying**, see §8 |

All variables are set via Vercel's Environment Variables UI (Project Settings → Environment Variables), scoped to the Production environment. Preview deployments (one per PR, Vercel's default behavior once the GitHub repo is connected) should use a separate, non-production `DATABASE_URL` — a Neon branch is the natural fit here, not the same database production writes to.

---

# 4. Migration Procedure

The `searchVector` migration-safety procedure is documented in full in Document 10 §8a — this section does not duplicate it, only cross-references it, since it belongs with the data model it protects.

**Production migration steps, end to end:**

1. Locally, against a Neon branch (not production): `prisma migrate dev --create-only`, then follow Document 10 §8a's review steps before applying.
2. Once the reviewed migration is committed, deploy: `prisma migrate deploy` runs against the real `DATABASE_URL` — this command never diffs or generates new migrations, only applies already-committed ones in order, which is what makes it safe to run unattended (verified live in Phase 7.5, and again structurally true here).
3. Neon's branching feature (§2) means this can be rehearsed against a disposable copy of production data before touching the real database, if a migration is unusually risky.
4. `ci.yml`'s Postgres integration test (added Phase 7.5) exercises the raw-SQL query paths against a real, freshly-migrated database on every push — this is a safety net for the *query* logic, not a substitute for the manual review in Document 10 §8a, which guards the *migration file* itself.

---

# 5. Backup & Restore Strategy

**Decision:** Rely on Neon's built-in point-in-time recovery (PITR) rather than building a separate backup mechanism.

Neon retains a continuous history of database changes (the retention window depends on the plan tier — confirm the specific window on whichever Neon plan is provisioned, since this determines how far back a restore can reach) and supports restoring to any point within that window, either by resetting a branch or creating a new branch at a past point in time.

**Restore procedure:**
1. In the Neon console, select the project and the point in time to restore to.
2. Neon can either reset the current branch to that point (destructive to anything after it) or create a new branch at that point (non-destructive — recommended for verifying a restore before committing to it).
3. Once verified, point `DATABASE_URL` at the restored branch (or promote it) and redeploy.

**What this doesn't cover:** application-level mistakes that are *replicated* before anyone notices (e.g., a bad migration applied and then more writes happen on top of it) still require picking a restore point before the mistake — PITR protects against data loss, not against noticing a problem late. Combined with the Document 10 §8a migration procedure, the intent is to make "a migration mistake happens at all" rare, and PITR is the safety net for when review still misses something.

---

# 6. Rollback Procedure

Two distinct mechanisms — a bad deploy and a bad migration are not the same failure and don't share a fix:

**Deploy rollback (code, not data):**
1. Vercel keeps every previous deployment available; use "Instant Rollback" in the Vercel dashboard (or `vercel rollback` via the CLI) to point production traffic back at the last-known-good deployment immediately.
2. This is fast (seconds) and doesn't touch the database — appropriate for a bad UI change, a broken Route Handler, or a regression that doesn't involve a schema change.

**Migration rollback (data, not just code):**
1. Schema migrations are not automatically reversible the way a Vercel deploy is — rolling back the *code* to a previous deployment while the *database* has already moved to a new schema will break the older code's assumptions.
2. If a migration itself is the problem: restore the database to the point immediately before that migration ran (§5's PITR procedure, via a Neon branch), then roll back the deploy to the version that matches that schema.
3. If a migration is fine but the deployed code using it is broken: a deploy rollback alone is *not* safe unless the previous code version is also compatible with the new schema — check this before rolling back, don't assume it.

**Rollback triggers** *(a starting decision, revisit once real production experience exists):*
- `/api/health` returning non-200 for more than a few minutes
- A spike in `AI_PROVIDER_ERROR`/`UNKNOWN_ERROR` rates in logs (Vercel's log capture, §2) beyond what looks like normal upstream OpenAI flakiness
- Any confirmed data-integrity issue (wrong data returned, a failed migration partially applied)
- User-reported inability to sign in, create, or retrieve their own data

---

# 7. Monitoring, Logging, and Alerting

**Current decision:** Vercel's platform log capture only, at launch. Sentry is the intended next step but is explicitly deferred — no Sentry dependency, configuration, or scaffolding was added during this pass, per the explicit decision to keep this pass focused and add Sentry "during Phase 8, or immediately after deployment."

**What exists today:**
- `GET /api/health` (Phase 7.5) — real database-connectivity check, suitable for an external uptime monitor (e.g., a simple polling service) to watch even before any deeper monitoring is added.
- `lib/logger/index.ts` — structured JSON to `console`, which Vercel captures automatically per deployment/function invocation. No log level filtering, no correlation ID (Document 15 DEBT-006, still open) — accepted as sufficient for initial single-user launch, not closed.

**When Sentry is added later:** it should cover both client-side (React error boundaries — `app/global-error.tsx` and `app/(dashboard)/error.tsx` already exist as the integration points) and server-side (Route Handler / Service exceptions, which currently only reach `lib/logger`'s `console.error`). This is deliberately left as a sized-but-undone task rather than attempted here.

---

# 8. Cost Control

RC Review finding CC1–CC4, restated as concrete setup steps (mostly manual account actions, not code):

1. **OpenAI spend limit — set this before going live.** In the OpenAI account/organization billing dashboard, set a monthly spend cap and a usage alert threshold below it. This is the single highest-value, lowest-effort item in this entire runbook — it's an account setting, not a deployment step, and can be done independently of everything else here.
2. **Resend quota** — confirm the provisioned plan's monthly send limit comfortably exceeds expected magic-link volume for a single user. Very unlikely to be a real constraint at this scale; a five-minute check, not a design problem.
3. **Token usage visibility** — `Message.tokenCount` is already captured on every AI turn (`features/ai/services/AIChatService.ts`). No dashboard exists yet; until one does, a periodic manual query (`SELECT sum("tokenCount") FROM message WHERE "createdAt" > ...`) against the production database is sufficient to sanity-check usage against the OpenAI spend limit in item 1.
4. **Database storage growth** — `AuditLog` is intentionally immutable and append-only (Document 13 §20) — it only grows. Not a concern at current single-user scale; worth a periodic glance at Neon's storage dashboard rather than active alerting for now.

---

# 9. Release Checklist

**Pre-deployment**
- [ ] Neon project created; production database provisioned; pooled connection string obtained for `DATABASE_URL`
- [ ] Vercel project created, GitHub repo connected (this *is* the CD pipeline — Vercel's native Git integration auto-deploys on push to the production branch and creates preview deployments per PR; no custom GitHub Actions deploy step is needed on top of the existing CI workflow)
- [ ] All production environment variables set in Vercel (§3)
- [ ] Resend sending domain verified; `EMAIL_FROM` set to it
- [ ] OpenAI spend limit configured (§8)
- [ ] `prisma migrate deploy` run against the fresh production database (first-time schema setup)

**Deployment**
- [ ] Push to the production branch (or trigger a Vercel deploy) — first real deploy
- [ ] Verify the build succeeded in the Vercel dashboard

**Post-deployment verification**
- [ ] `GET /api/health` returns `200` on the real production URL
- [ ] Security headers present on the live production URL (`curl -sD -` against the real domain — the Phase 7.5 verification ran against `localhost`, this is the first check against the actual deployed instance)
- [ ] Real magic-link sign-in, end to end — the first time this has worked outside this sandboxed environment, since no earlier phase had live email delivery
- [ ] Create a Project, Knowledge entry, Note, and Document; confirm persistence and reload
- [ ] Send a real AI chat request; confirm it reaches OpenAI successfully — the first real test of this path, since this development environment's network egress has never allowed it
- [ ] Confirm rate limiting still behaves as expected under the real Vercel topology (§2 notes the in-memory limiter's known limitation here — this is the first chance to observe it for real, not just accept the risk on paper)

**Rollback triggers:** see §6.

---

# 10. What This Document Deliberately Doesn't Do

- **It doesn't install or configure Sentry.** That's an explicit, named next step (§7), not done here.
- **It doesn't create the actual Vercel or Neon projects.** Those are account-level actions only the project owner can take; this document describes the steps, it doesn't perform them.
- **It doesn't change the rate limiter.** Its in-memory, single-process-scoped nature (Document 15 DEBT-005) is an accepted, explicit tradeoff for MVP scale — this document records that decision, it doesn't revisit the implementation.
- **It isn't a substitute for Document 16.** Document 16 defines what "RC" and "v1.0" mean in product terms; this document is purely operational — how to actually run the thing once those milestones are reached.

---

END OF DOCUMENT 17
