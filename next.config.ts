import type { NextConfig } from "next";

// Document 13 §28 (Amendment 26, Phase 7.5 — Production Hardening) —
// security headers, applied to every response (Phase 7 Security Report
// finding S1/R1). `next.config.ts` runs before the app's own module graph
// exists, the same reason `prisma.config.ts` is exempt from the
// process.env rule (Document 7 §13) — it reads `process.env.NODE_ENV`
// directly rather than importing `@/config/env`.
const isProduction = process.env.NODE_ENV === "production";

// `script-src`/`style-src` omit 'unsafe-inline' in production: the app has
// no inline <script>, no style={{...}} usage, and no CSS-in-JS (verified by
// grep before writing this policy) — Tailwind compiles to a static
// stylesheet loaded via <link>, and Next.js's __NEXT_DATA__ script tag is
// `type="application/json"`, not executable, so it isn't governed by
// script-src. Development keeps a relaxed policy so Next.js Fast Refresh
// (which injects eval'd/inline scripts and an HMR websocket) keeps working
// locally — only the production build gets the strict policy.
const contentSecurityPolicy = isProduction
  ? [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  : [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self' ws:",
      "frame-ancestors 'none'",
    ].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          // Defense-in-depth alongside frame-ancestors above — older
          // browsers that don't support CSP's frame-ancestors still get
          // clickjacking protection from this header.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // HSTS only makes sense once the deployment actually terminates
          // TLS (Phase 8) — sending it in development, over plain HTTP,
          // would have no effect but is still meaningless noise to ship.
          ...(isProduction
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
