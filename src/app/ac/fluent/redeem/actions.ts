"use server";

import { headers } from "next/headers";
import { redeemVoucher } from "@/lib/fluent/vouchers";

/**
 * Public voucher redemption (no account). Validates + consumes a seat atomically
 * via the eng_fluent_voucher_claim RPC and returns a redemption token the runner
 * carries. Forensic ip/user_agent captured server-side (never surfaced in admin).
 */
export async function redeemFluentVoucherAction(input: {
  code: string;
  name: string;
  email: string;
  company: string;
}): Promise<{ ok: true; redemptionToken: string } | { ok: false; error: string }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = h.get("user-agent") || null;

  const res = await redeemVoucher({
    code: input.code,
    redeemerName: input.name,
    redeemerEmail: input.email,
    companyName: input.company,
    ip,
    userAgent,
  });
  if (!res.ok) return res;
  return { ok: true, redemptionToken: res.redemptionToken };
}
