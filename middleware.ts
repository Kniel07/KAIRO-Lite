import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ROUTES } from "@/constants/routes";

// Document 11 §6 mandates database sessions (not JWT), which requires a
// Prisma lookup on every request — not supported on the Edge runtime.
// Next.js 15.5's Node.js Middleware runtime lets middleware run in the
// same runtime as Route Handlers so the Prisma-backed `auth()` check works
// without weakening the session strategy.
export const runtime = "nodejs";

// Document 11 §8 — cheap session-presence check only. Per-resource
// authorization stays in the Service layer (Document 11 §7, Document 7 §8);
// middleware never makes that decision.
//
// Note: Auth.js's own routes live at `/api/auth/**` (fixed by the library),
// not `/api/v1/auth/**` as Document 11 §8's table shorthand suggested —
// this matcher reflects the actual route, matching Document 11's intent.
// Document 13 §28 (Amendment 26, Phase 7.5) — `/api/health` joins the
// public set: a liveness/readiness probe can't authenticate, and the route
// itself returns no sensitive data (Document 11 §8's per-resource
// authorization concern doesn't apply — there's no resource here).
const PUBLIC_PATH_PREFIXES = ["/auth", "/api/auth", "/api/health"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isPublic) {
    return NextResponse.next();
  }

  if (!req.auth) {
    const signInUrl = new URL(ROUTES.signIn, req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
