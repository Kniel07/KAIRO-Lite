import { describe, expect, it, vi } from "vitest";

// Document 13 §28 (Amendment 26, Phase 7.5) — Phase 7 Production Readiness
// Report finding R2. Mocks `@/lib/db/client` the same way other unit tests
// mock `@/lib/db/transaction` — no live database in the unit suite.

const queryRawMock = vi.fn();

vi.mock("@/lib/db/client", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRawMock(...args),
  },
}));

describe("checkDatabaseHealth", () => {
  it("returns true when the query succeeds", async () => {
    queryRawMock.mockResolvedValueOnce([{ "?column?": 1 }]);
    const { checkDatabaseHealth } = await import("@/lib/health/checkDatabaseHealth");

    await expect(checkDatabaseHealth()).resolves.toBe(true);
  });

  it("returns false when the query throws", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("connection refused"));
    const { checkDatabaseHealth } = await import("@/lib/health/checkDatabaseHealth");

    await expect(checkDatabaseHealth()).resolves.toBe(false);
  });
});
