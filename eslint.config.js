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
  // `features/`; context retrieval reads via the Repository layer instead.
  {
    files: ["ai/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/features", "@/features/*", "@/features/**"],
              message:
                "ai/ must not depend on features/ (Document 5 §20, Document 13 §4). Read via a Repository instead.",
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
    // subject.
    ignores: ["config/env.ts", "prisma.config.ts", "tests/unit/env.test.ts"],
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
