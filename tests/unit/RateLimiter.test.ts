import { describe, expect, it, vi } from "vitest";
import { FixedWindowRateLimiter } from "@/lib/rate-limit/RateLimiter";
import { RateLimitedError } from "@/lib/utils/errors";

// Document 13 §28 (Amendment 26, Phase 7.5) — Phase 7 Security Report
// finding S4.

describe("FixedWindowRateLimiter", () => {
  it("allows requests up to the limit within the window", () => {
    const limiter = new FixedWindowRateLimiter(3, 60_000);

    expect(() => limiter.check("user-1")).not.toThrow();
    expect(() => limiter.check("user-1")).not.toThrow();
    expect(() => limiter.check("user-1")).not.toThrow();
  });

  it("throws RateLimitedError once the limit is exceeded within the window", () => {
    const limiter = new FixedWindowRateLimiter(2, 60_000);

    limiter.check("user-1");
    limiter.check("user-1");

    expect(() => limiter.check("user-1")).toThrow(RateLimitedError);
  });

  it("tracks separate windows per key", () => {
    const limiter = new FixedWindowRateLimiter(1, 60_000);

    expect(() => limiter.check("user-1")).not.toThrow();
    expect(() => limiter.check("user-2")).not.toThrow();
    expect(() => limiter.check("user-1")).toThrow(RateLimitedError);
  });

  it("resets the count once the window has elapsed", () => {
    vi.useFakeTimers();
    try {
      const limiter = new FixedWindowRateLimiter(1, 1_000);

      limiter.check("user-1");
      expect(() => limiter.check("user-1")).toThrow(RateLimitedError);

      vi.advanceTimersByTime(1_001);

      expect(() => limiter.check("user-1")).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });
});
