import { prisma } from "@/lib/db/client";

// Document 13 §28 (Amendment 26, Phase 7.5 — Production Hardening) — Phase 7
// Production Readiness Report finding R2: no health-check endpoint existed.
// Lives directly under `lib/` (not `lib/db/repositories/`) because it is
// infrastructure, not a domain repository — the one place besides
// `lib/db/client.ts` itself that touches `prisma` outside the
// Repository/Service chain, the same way `AIOrchestrator`'s
// `createAIOrchestrator()` factory is the one sanctioned place besides
// `ai/providers/` that constructs a concrete provider.
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
