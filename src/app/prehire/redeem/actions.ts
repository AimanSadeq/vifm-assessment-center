"use server";

import { headers } from "next/headers";
import { redeemPrehireVoucher } from "@/lib/prehire/vouchers";
import { rateLimit } from "@/lib/security/rate-limit";

/**
 * Redeem a Pre-Hire voucher code (public, no account). Captures the request IP +
 * user-agent server-side for the redemption audit row, then provisions a
 * candidate on the voucher's requisition and returns its access token.
 */
export async function redeemPrehireVoucherAction(input: {
  code: string;
  name: string;
  email: string;
  company?: string;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const h = headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const userAgent = h.get("user-agent") || undefined;

  // V-5: throttle the public, no-account redemption per IP to blunt voucher-code
  // guessing / brute-force enumeration (this is the only public write path here).
  // Best-effort per-instance speed-bump - 10 attempts per 15 minutes per IP.
  const rl = rateLimit(`prehire-voucher-redeem:${ip ?? "unknown"}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.allowed) {
    return { ok: false as const, error: "Too many attempts. Please wait a few minutes and try again." };
  }

  return redeemPrehireVoucher({ ...input, ip, userAgent });
}
