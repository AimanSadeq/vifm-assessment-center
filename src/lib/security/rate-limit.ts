/**
 * Best-effort in-process sliding-window rate limiter, keyed by an arbitrary
 * string (typically a client IP).
 *
 * NOT a distributed limiter: on a multi-instance deploy each instance keeps its
 * own window, so it caps abuse per-instance rather than globally. It is a cheap
 * brute-force speed-bump in front of public, no-account write endpoints (e.g.
 * voucher redemption) - not a hard security boundary. Pair it with a CAPTCHA or
 * a shared store (Redis) when a stronger guarantee is required. Memory is
 * bounded by opportunistically pruning expired keys.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  /** Whether this request is within the limit (and counted). */
  allowed: boolean;
  /** Milliseconds until the current window resets (0 when allowed). */
  retryAfterMs: number;
};

/**
 * Record a hit against `key` and report whether it is within `limit` per
 * `windowMs`. The first hit in a window is always allowed; the (limit+1)-th hit
 * inside the same window is rejected until the window resets.
 */
export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number; now?: number }
): RateLimitResult {
  const now = opts.now ?? Date.now();

  // Opportunistic prune so the map can't grow without bound under key churn.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }

  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }
  if (cur.count >= opts.limit) {
    return { allowed: false, retryAfterMs: cur.resetAt - now };
  }
  cur.count += 1;
  return { allowed: true, retryAfterMs: 0 };
}
