import { defineConfig } from "vitest/config";
import path from "node:path";

// Document 9 §Phase 7 lists unit/integration/e2e testing; this minimal
// config exists ahead of that phase specifically to cover the
// security-critical markdown sanitizer and env validation (Infrastructure
// Hardening Sprint, Document 13 §16-19) — not a general test suite yet.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
