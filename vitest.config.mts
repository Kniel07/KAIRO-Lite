import "dotenv/config";
import { defineConfig } from "vitest/config";
import path from "node:path";

// Document 9 §Phase 7 lists unit/integration/e2e testing. `dotenv/config`
// mirrors `prisma.config.ts`'s existing pattern: local test runs load the
// gitignored dev `.env` so `config/env.ts` (imported transitively by any
// Service/Repository under test, e.g. `ProjectService.test.ts`, Phase 3)
// validates successfully without a live database — nothing under test yet
// performs a real Prisma query. CI instead sets its own job-level dummy
// values (`.github/workflows/ci.yml`), which take precedence there since
// no `.env` file exists in that environment.
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
