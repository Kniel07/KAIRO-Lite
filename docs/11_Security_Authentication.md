# KAIRO-Lite
## Security & Authentication

Version: 1.0
Status: Proposed (Amendment — pending approval)
Resolves: Ingestion Report Critical Q1 (auth library/strategy), Q2 (User model — see Document 10 §5.1)

---

# 1. Alignment With Existing Principles

This document does not introduce new architectural layers. It fills the "future implementation" placeholder left explicitly by Document 8 §5 ("Future implementation — NextAuth/Auth.js — Session-based authentication") and satisfies Document 1 §9's MVP requirement for Authentication, Document 2's Application Layer "Authentication" service, and Document 7 §21's mandatory security checklist.

Document 8 §5 already commits to **session-based** authentication (not JWT/stateless tokens) — that single line is the tie-breaker used below to resolve the NextAuth-vs-Auth.js ambiguity.

---

# 2. Authentication Architecture

```
Browser
  │
Auth.js (App Router route handler: /app/api/auth/[...nextauth])
  │
Prisma Adapter
  │
User / Account / Session / VerificationToken (Document 10 §5.1, §6)
  │
PostgreSQL
```

Session strategy: **database sessions** (not JWT), directly satisfying Doc 8 §5's explicit "Session-based authentication" requirement. The Prisma Adapter persists sessions in the `Session` table (Doc 10 §6).

---

# 3. Library & Version

**Chosen: Auth.js v5** (the current name for the NextAuth.js project; packages `next-auth@5` + `@auth/prisma-adapter`).

Rationale:
- Auth.js v5 is the actively maintained line for Next.js App Router (Doc 5 §3 mandates App Router).
- Database session strategy is a first-class, supported mode — matches Doc 8 §5 without workarounds.
- Doc 6 §15's example env var `NEXTAUTH_SECRET` is a v4 convention; this document amends that example to `AUTH_SECRET` (v5 convention) — see §9 and the formal amendment in Document 13 §3 (env var naming carve-out).

This resolves Ingestion Report Contradiction #2 (NextAuth vs. Auth.js naming) in favor of a single, explicit library and version.

---

# 4. Provider Strategy

**Chosen: Email (magic link) provider via Resend**, no password provider.

Rationale — consistent with existing documents, not a new invention:
- Doc 7 §21 mandates minimizing attack surface ("protect secrets," "verify authentication"); eliminating password storage removes an entire class of risk (no `passwordHash`, no hashing library, no password-reset flow to build).
- Resend was already part of the approved tech stack but unused by any of Documents 1–9 until now — magic-link delivery is exactly the kind of transactional email Resend exists for, giving it a concrete, documented role (resolves Ingestion Report Q11).
- Doc 1 §3 states the primary user is a single person (Kniel); passwordless email auth is the simplest mechanism that still satisfies Doc 1 §9's "Authentication" MVP requirement.

OAuth providers (Google, GitHub, etc.) are **not** implemented in MVP. Because the `Account` adapter model (Doc 10 §6) already exists as a library requirement, adding an OAuth provider later is a config-only change — zero schema migration needed. This satisfies Doc 3 §12's migration-safety principle in advance.

---

# 5. User Model

Fully specified in Document 10 §5.1. Summary: `email`, `name`, `image`, `emailVerified`, `role` (`OWNER` | `MEMBER`), plus standard fields. No `passwordHash` field exists — intentionally, per §4 above.

---

# 6. Session Lifecycle

| Property | Value | Rationale |
|---|---|---|
| Strategy | `database` | Doc 8 §5 |
| Session max age | 30 days | Standard Auth.js default; no document specifies otherwise |
| Session update age | 24 hours (sliding refresh) | Standard Auth.js default |
| Sign-in flow | User submits email → Resend sends magic link → link redeems `VerificationToken` → `Session` row created |
| Sign-out | Deletes the `Session` row (server-side revocation, stronger than JWT expiry-only logout) |

---

# 7. Authorization Rules

Per Doc 7 §8 and Doc 8 §6: **authorization lives in Services, never in middleware alone.**

Pattern for every mutating Service method:
```
1. Resolve session (via Auth.js server helper) → currentUser
2. Load target resource
3. Assert resource.ownerId === currentUser.id (or resource.authorId, resource.userId — entity-appropriate)
4. Proceed, or throw a FORBIDDEN error (Doc 8 §18 error code)
```

MVP has exactly one role in practice (`OWNER`); the `role` field exists so this same check pattern extends to role-based rules in Doc 9 Phase 9 without restructuring the Service layer.

---

# 8. Middleware & Protected Routes

`middleware.ts` (root, per Doc 5 §2) performs a **cheap presence check only** — it confirms a valid session exists, then delegates the real authorization decision to the Service layer (§7). This split is required by Doc 8 §6: "Authorization belongs inside Services. Never rely solely on middleware."

| Route group | Protection |
|---|---|
| `/app/(dashboard)/**` | Requires session; redirect to `/auth/signin` if absent |
| `/app/api/v1/**` (except `/api/v1/auth/**`) | Requires session; returns `401 UNAUTHORIZED` envelope (Doc 8 §3, §18) if absent |
| `/app/auth/**` | Public |
| `/app/api/auth/**` (Auth.js internal routes) | Public (library-managed) |
| Health check (if added) | Public |

---

# 9. Environment Variables

| Variable | Purpose | Note |
|---|---|---|
| `DATABASE_URL` | Postgres connection | Doc 6 §15 |
| `AUTH_SECRET` | Auth.js v5 session/token encryption | **Amends** Doc 6 §15's `NEXTAUTH_SECRET` example — see Document 13 §3 |
| `AUTH_URL` | Canonical app URL for Auth.js callbacks | v5 convention |
| `RESEND_API_KEY` | Magic-link email delivery | Doc 6 §15 |
| `KAIRO_OWNER_EMAIL` | Single-user allowlist gate (see §10) | Filled Gap, this document |
| `OPENAI_API_KEY` | AI provider | Doc 6 §15 |

All accessed only through the centralized config loader (`config/auth.ts`, per Doc 5 §13 and Doc 7 §13 — "never access `process.env` directly").

---

# 10. Single-User MVP Strategy (resolves Ingestion Report Critical Q1)

Doc 1 §3 states the primary user is personal use by Kniel; Doc 1 §9 still lists Authentication as required MVP scope. These are not in conflict — the resolution is a **gated single tenant**, not "no auth":

- `KAIRO_OWNER_EMAIL` (env var) holds the one allowed email address.
- Auth.js `signIn` callback rejects any email that doesn't match `KAIRO_OWNER_EMAIL`, before a magic link is even sent.
- Exactly one `User` row is expected to exist in MVP (`role: OWNER`), created on first successful sign-in.
- Every Service's ownership check (§7) still runs normally — the data model and authorization code are already multi-user-shaped, only the sign-in gate is single-tenant.

This means Phase 9's multi-user expansion (Doc 9) requires deleting one allowlist check, not rebuilding auth.

---

# 11. Future Multi-User Expansion

Reserved, not built now (Doc 1 §10 "Out of Scope: Team collaboration" still applies to MVP):

- Remove the `KAIRO_OWNER_EMAIL` gate in the `signIn` callback.
- Activate `role: MEMBER` distinctions in the §7 authorization checks.
- Add OAuth providers (Account model already supports it, §4).
- Introduce resource sharing using `Project.visibility` (already specified in Document 10 §5.2) and, if needed, an explicit sharing/membership table — that table is **not** specified here, since it is out of scope until Phase 9 is formally opened.

---

# 12. Security Checklist Cross-Reference

Confirms this document satisfies every applicable line of Doc 7 §21:

| Doc 7 §21 requirement | How satisfied |
|---|---|
| Validate input | Zod at every Auth.js callback boundary and Service entry (Doc 7 §11, unchanged) |
| Escape output / sanitize markdown | Unchanged, owned by `lib/markdown/` (Doc 5 §7) |
| Protect secrets | All secrets in env vars, loaded via `config/`, never hardcoded or logged (Doc 7 §12, §13) |
| Verify authentication | Middleware §8 |
| Verify authorization | Service-layer checks §7 |

---

END OF DOCUMENT 11
