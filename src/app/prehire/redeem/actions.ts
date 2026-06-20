"use server";

import { headers } from "next/headers";
import { redeemPrehireVoucher } from "@/lib/prehire/vouchers";

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
  return redeemPrehireVoucher({ ...input, ip, userAgent });
}
