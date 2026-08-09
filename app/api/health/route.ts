import { NextResponse } from "next/server";
import { checkDatabaseHealth } from "@/lib/health/checkDatabaseHealth";

// Document 13 §28 (Amendment 26, Phase 7.5 — Production Hardening) —
// deliberately not wrapped in the standard `{success, data}` envelope
// (Document 8 §3): like `/api/auth/**`, this is an infrastructure route for
// orchestrators/load balancers, not a domain API endpoint, and those
// callers expect a plain body + HTTP status. Public (see
// `PUBLIC_PATH_PREFIXES` in `middleware.ts`) — a liveness probe can't
// authenticate, and this endpoint returns no sensitive data.
export async function GET() {
  const databaseHealthy = await checkDatabaseHealth();

  return NextResponse.json(
    { status: databaseHealthy ? "ok" : "unhealthy", database: databaseHealthy },
    { status: databaseHealthy ? 200 : 503 },
  );
}
