import { timingSafeEqual } from "crypto";

/**
 * Constant-time comparison for shared secrets (CRON_SECRET bearer tokens,
 * the x-ara-internal server-to-server header). Avoids the timing side-channel
 * of a plain `===` on a secret. Returns false unless both inputs are non-empty
 * and equal - so an unset/empty secret can never be matched by an empty header.
 *
 * Node runtime only (uses node:crypto); all callers are nodejs route handlers.
 */
export function timingSafeStrEqual(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch; an unavoidable length check
  // gates that. The secret's length is not meaningfully sensitive.
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
