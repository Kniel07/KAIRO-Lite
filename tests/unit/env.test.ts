import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Document 7 §13, §21 — environment must be validated at startup with a
// clear, non-secret-leaking failure. Document 13 §16-19 (Infrastructure
// Hardening Sprint) — this was previously "implemented, not exercised"
// per the Phase 2 Architecture Compliance Matrix (Document 14); this file
// closes that gap.
//
// `config/env.ts` validates at *module load time* (`export const env =
// loadEnv()`), so each test mutates `process.env` and dynamically
// re-imports the module after `vi.resetModules()` to get a fresh
// evaluation against that mutated environment.

const VALID_ENV = {
  NODE_ENV: "test",
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  AUTH_SECRET: "test-only-secret-value-not-a-real-credential",
  AUTH_URL: "http://localhost:3000",
  RESEND_API_KEY: "re_test_key",
  KAIRO_OWNER_EMAIL: "owner@example.com",
  OPENAI_API_KEY: "sk-test-key",
} as const;

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...VALID_ENV };
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("config/env", () => {
  it("loads successfully with a complete, valid environment", async () => {
    const { env } = await import("@/config/env");
    expect(env.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
    expect(env.OPENAI_API_KEY).toBe(VALID_ENV.OPENAI_API_KEY);
  });

  it("throws when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    await expect(import("@/config/env")).rejects.toThrow(/DATABASE_URL/);
  });

  it("throws when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(import("@/config/env")).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it("throws when AUTH_URL is malformed (not a valid URL)", async () => {
    process.env.AUTH_URL = "not-a-valid-url";
    await expect(import("@/config/env")).rejects.toThrow(/AUTH_URL/);
  });

  it("throws when KAIRO_OWNER_EMAIL is not a valid email", async () => {
    process.env.KAIRO_OWNER_EMAIL = "not-an-email";
    await expect(import("@/config/env")).rejects.toThrow(/KAIRO_OWNER_EMAIL/);
  });

  it("throws listing every missing key when several are absent at once", async () => {
    delete process.env.DATABASE_URL;
    delete process.env.RESEND_API_KEY;
    await expect(import("@/config/env")).rejects.toThrow(
      /DATABASE_URL.*RESEND_API_KEY|RESEND_API_KEY.*DATABASE_URL/,
    );
  });

  it("never includes secret values in the thrown error message (Document 7 §12)", async () => {
    process.env.AUTH_SECRET = "super-secret-value-that-must-never-leak";
    delete process.env.OPENAI_API_KEY;

    let thrown: unknown;
    try {
      await import("@/config/env");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeDefined();
    expect(String(thrown)).not.toContain("super-secret-value-that-must-never-leak");
  });
});
