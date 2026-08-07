# KAIRO-Lite
## Release Roadmap

Generated: after Phase 2 (Database) + Infrastructure Hardening Sprint, before Phase 3
Status: **Derived artifact, not a constitutional document** — same standing as Document 14 and Document 15. It maps Document 9's implementation phases onto product-facing milestones; it does not add, remove, or reinterpret any phase, deliverable, or exit criterion Document 9 already defines. Update it as phases close; don't let it drift from Document 9.

---

# 1. Purpose

Document 9 sequences *implementation* phases (0–9) by technical dependency. This document is the bridge from that sequence to *release* milestones — the checkpoints where "is this done" has a product-facing answer, not just a phase-exit-criteria answer. It exists because "Phase 6 is done" and "users can search their knowledge base" are different claims, and only the second one is what a release note would say.

Nothing here overrides Document 9. Where the two conflict, Document 9 wins (Document 7 §25).

---

# 2. Milestones

| Milestone | Implementation Phases | Scope | Exit Criteria |
|---|---|---|---|
| **Alpha** | Phase 3 (Backend Services) + Phase 4 (Frontend) | Core CRUD across Project/Knowledge/Note/Document via real Services (`ProjectService`, `KnowledgeService`, `NotesService`, `DocumentService`, `SearchService`, `GovernanceService` — Doc 9 Phase 3), with authorization and audit integration wired in (closing the "audit infrastructure exists but nothing calls it" gap Document 14 flagged). Full navigation across Dashboard/Projects/Knowledge/Notes/Documents/Search/Settings with real forms, tables, empty/loading/error states (Doc 9 Phase 4). | Doc 9 Phase 3 + Phase 4 exit criteria both met ("Services tested," "Full navigation operational") **and**, going beyond phase-exit into product terms: a real user can sign in via magic link (closing the "auth flow implemented, not live-tested" item from Document 14 §12), create a Project, capture a Note, and see it persist and reload — end to end, not per-layer. |
| **Beta** | Phase 5 (AI Layer) + Phase 6 (Knowledge & Search) | AI Orchestrator fully implemented against Document 12's four modes (THINK/VALIDATE/DOCUMENT/IMPLEMENT), OpenAI provider wired, context retrieval live. Full-text search (Document 13 §2) wired through a `SearchService`/`SearchRepository` — this is also DEBT-003's deadline: the `searchVector` migration-drift procedure (Document 15) must be formalized *before* this milestone, not during it. Tags API and Conversations API (Document 8 §9a, §14a) implemented. | Doc 9 Phase 5 + Phase 6 exit criteria ("AI requests execute through Orchestrator only," "Knowledge retrieval operational") **and** the Document 1 §11 acceptance criteria "AI has project context" and "Knowledge is searchable" are independently demonstrable, not just architecturally true. |
| **RC** (Release Candidate) | Phase 7 (Quality Assurance) + Phase 8 (Deployment) | Unit/integration/e2e tests, accessibility/performance/security review (Doc 9 Phase 7). Vercel deployment configured, production Postgres hosting decided (closing DEBT-008), CI/CD extended to run against a live database (closing DEBT-004), monitoring and error reporting added (Doc 9 Phase 8). Every Phase-7/8-tagged item in Document 15 is either closed or explicitly re-deferred with updated exit criteria — silently carrying debt past its planned phase isn't acceptable, re-scoping it on purpose is. | Doc 9 Phase 7 + Phase 8 exit criteria ("All critical paths tested," "Successful production deployment") **and** Document 14 (Architecture Compliance Matrix) regenerated one more time, showing the CI/live-database and rate-limiting/logging/env-validation items from Document 15 moved out of `CONVENTION`/`MISSING` the same way the Infrastructure Hardening Sprint closed the first batch. |
| **v1.0** | — (milestone, not a phase) | All Document 1 §11 acceptance criteria met, together, in production: users can manage projects; knowledge is searchable; AI has project context; projects preserve history; the system is deployed on Vercel. | Document 1 §11's list, verified item by item — not asserted, the same standard this whole review process has held every other claim to. |
| **Post-v1.0** | Phase 9 (Future Expansion) | Multi-user support, Knowledge Graph, embeddings/semantic search, plugin system, workflow automation, background jobs, notifications, analytics, local AI providers (Doc 9 Phase 9 — unchanged, explicitly out of MVP scope per Document 1 §10). | Not defined here — Phase 9 has no committed scope yet by design. |

---

# 3. What This Document Deliberately Doesn't Do

- **It doesn't add new exit criteria Document 9 doesn't already have.** Every "Exit Criteria" cell above either quotes Document 9 directly or names a Document 1 §11 acceptance criterion — nothing invented.
- **It doesn't turn Document 15's debt items into blockers for their assigned phase.** DEBT-002 (markdown stripping) is scoped to Phase 3 because that's when it needs real content to test against — it's a thing to *check* during Alpha, not a thing that prevents Alpha from shipping if it's still open.
- **It doesn't pre-commit Phase 9 scope.** Document 1 §10 already lists what's out of MVP scope; this document repeats that boundary rather than trying to plan past it.
- **It isn't a project-management tool.** No dates, no percentage-complete, no burndown — Document 9's phase-dependency ordering already governs sequencing; this document only adds the product-facing framing on top.

---

END OF DOCUMENT 16
