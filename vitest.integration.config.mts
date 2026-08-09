import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "node:path";

// Document 13 §28 (Amendment 26, Phase 7.5) — separate from
// `vitest.config.mts` (which only ever runs against fakes/mocks) so the
// default `npm test` stays usable without a live database. Run via `npm run
// test:integration`, which requires `DATABASE_URL` to point at a real,
// already-migrated Postgres instance.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
    },
  },
});
