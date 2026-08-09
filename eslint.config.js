const { FlatCompat } = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

module.exports = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "generated/**",
      "public/**",
      "*.config.js",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  // Document 5 §20, §22 / Document 7 §6 — dependency boundary enforcement.
  // "Components never access Prisma. Components never call OpenAI."
  {
    files: ["components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/generated/prisma", "@/generated/prisma/**", "@/lib/db", "@/lib/db/**"],
              message:
                "Components never access Prisma directly (Document 5 §5). Go through a Service.",
            },
            {
              group: ["@/ai/providers", "@/ai/providers/**"],
              message:
                "Components never call an AI provider directly (Document 5 §5). Go through the AI Orchestrator.",
            },
          ],
        },
      ],
    },
  },
  // Document 7 §8 (Phase 3 pre-Phase-4 hardening patch) — "Component →
  // Route → Service → Repository → Prisma. No shortcuts." The Compliance
  // Matrix audit (Document 14 Revision 3, §17-18) found this edge
  // unenforced once Services existed to import: nothing blocked
  // `components/**`/`app/**` from importing a Service directly, skipping
  // the Route Handler layer. `app/api/**` is exempt — Route Handlers are
  // exactly where a Service call belongs.
  {
    files: ["components/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
    ignores: ["app/api/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features/*/services/*", "@/features/*/services/**"],
              message:
                "Components/pages never call a Service directly (Document 7 §8). Go through a Route Handler (app/api/**).",
            },
          ],
        },
      ],
    },
  },
  // Document 5 §20 (amended, Document 13 §4) — `ai/` never depends on
  // `features/`' Services, Components, hooks, or actions; context
  // retrieval reads via the Repository layer instead (`ai/context/` reads
  // `features/*/repositories/**` directly per Document 5 §20's own text:
  // "reads project, knowledge, and conversation data via the Repository
  // layer... directly"). This mirrors the Services-boundary rule below,
  // which is precise about *which* subpath is forbidden rather than
  // blocking all of `features/**` — the original blanket
  // `@/features/**` pattern here was stricter than Document 5 §20 actually
  // specifies, and would have made Phase 5's Context Retrieval
  // unimplementable, since every domain Repository (Project, Knowledge,
  // Conversation, Message, Settings) is feature-owned (Document 13 §3,
  // Amendment 2). Enforcement-only correction; no text change to
  // Document 5 itself, whose prose already said this (Document 13 §24,
  // Amendment 22, per the current ledger numbering).
  {
    files: ["ai/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/features/*/services/*",
                "@/features/*/services/**",
                "@/features/*/components/*",
                "@/features/*/components/**",
                "@/features/*/hooks/*",
                "@/features/*/hooks/**",
                "@/features/*/actions/*",
                "@/features/*/actions/**",
              ],
              message:
                "ai/ must not depend on features/ Services, Components, hooks, or actions (Document 5 §20, Document 13 §4). Read via a feature-owned Repository instead.",
            },
          ],
        },
      ],
    },
  },
  // Document 7 §8 (Phase 3, Document 13 §20) — "Services never access
  // Prisma directly... use a Repository." Narrower than the
  // components/app rule above: Services legitimately need
  // `@/lib/db/transaction` (withTransaction) and `@/lib/db/repositories/**`
  // (constructing repositories), so only the raw client and the generated
  // Prisma types/client are blocked, not all of `lib/db`.
  {
    files: ["features/*/services/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/generated/prisma", "@/generated/prisma/**", "@/lib/db/client"],
              message:
                "Services never access Prisma directly (Document 7 §8). Use a Repository, injected via its constructor.",
            },
            {
              group: ["@/ai/providers", "@/ai/providers/**"],
              message:
                "Services never call an AI provider directly (Document 4 §3). Go through the AI Orchestrator.",
            },
          ],
        },
      ],
    },
  },
  // Document 7 §13 (Infrastructure Hardening Sprint, Document 13 §16-19) —
  // "Never access process.env directly throughout the application.
  // Centralize environment loading." `config/env.ts` is the one sanctioned
  // reader; `prisma.config.ts` is a Prisma-CLI-loaded file that runs before
  // the app's own module graph exists, so it is exempt for the same reason
  // it already imports `dotenv/config` itself.
  {
    files: ["**/*.{ts,tsx}"],
    // `tests/unit/env.test.ts` is exempt too — it specifically tests
    // `config/env.ts`'s validation behavior and must mutate `process.env`
    // directly to set up each fixture. A narrow, documented exception, not
    // a hole: it's the one file whose entire job is exercising this rule's
    // subject. `next.config.ts` joins `prisma.config.ts` for the same
    // reason (Document 13 §28, Amendment 26, Phase 7.5): both run before
    // the app's own module graph exists, so `@/config/env` isn't reachable
    // from them yet.
    ignores: ["config/env.ts", "prisma.config.ts", "next.config.ts", "tests/unit/env.test.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.name='process'][property.name='env']",
          message:
            "Do not access process.env directly (Document 7 §13). Import `env` from @/config/env instead.",
        },
      ],
    },
  },
];
