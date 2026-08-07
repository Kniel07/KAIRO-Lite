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
];
