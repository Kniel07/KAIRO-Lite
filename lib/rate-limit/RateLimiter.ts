import { RateLimitedError } from "@/lib/utils/errors";

// Document 13 §28 (Amendment 26, Phase 7.5 — Production Hardening) — Phase 7
// Security Report finding S4: no application-level rate limit existed on
// any route, most importantly the AI endpoint, which calls a paid,
// quota-limited external provider on every request.
//
// Cross-cutting (not owned by a single feature), lives in `lib/` per
// Document 13 §3 — same placement rule as `lib/logger/`, `lib/markdown/`.

export interface RateLimiterLike {
  /** Throws `RateLimitedError` if `key` has exceeded its limit; otherwise
   * records one more request against it. */
  check(key: string): void;
}

interface Window {
  count: number;
  resetAt: number;
}

/**
 * In-memory fixed-window limiter — sufficient for the single-user,
 * single-process MVP deployment target (Document 11 §2). Known limitation,
 * deliberately accepted rather than engineered around prematurely: an
 * in-memory store does not survive a process restart and does not
 * coordinate across multiple instances. Worth revisiting only if either
 * changes (e.g. a horizontally-scaled or serverless-per-request deployment
 * target), not before.
 */
export class FixedWindowRateLimiter implements RateLimiterLike {
  private readonly windows = new Map<string, Window>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string): void {
    const now = Date.now();
    const existing = this.windows.get(key);

    if (!existing || existing.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
      return;
    }

    if (existing.count >= this.limit) {
      const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
      throw new RateLimitedError(`Too many AI requests. Try again in ${retryAfterSeconds}s.`);
    }

    existing.count += 1;
  }
}

// Document 4 §7 context — the AI endpoint is the only route in the MVP with
// a real per-call external cost, so it's the only one rate-limited. 20
// requests / 60s is generous for a single interactive user, while still
// bounding worst-case provider spend from a stuck client retry loop or a
// scripting mistake.
const AI_CHAT_LIMIT = 20;
const AI_CHAT_WINDOW_MS = 60_000;

export const aiChatRateLimiter: RateLimiterLike = new FixedWindowRateLimiter(
  AI_CHAT_LIMIT,
  AI_CHAT_WINDOW_MS,
);
