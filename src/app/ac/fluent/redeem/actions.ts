"use server";

import { headers } from "next/headers";
import { redeemVoucher } from "@/lib/fluent/vouchers";

/**
 * Public voucher redemption (no account). Validates + consumes a seat atomically
 * via the eng_fluent_voucher_claim RPC and returns a redemption token the runner
 * carries. Forensic ip/user_agent captured server-side (never surfaced in admin).
 */
// Reasonable email shape check - rejects "not-an-email" while accepting normal
// addresses. Deliberately not RFC-exhaustive; the goal is to stop a voucher
// being spent + a result routed to an address that cannot receive anything
// (trial High #1: an invalid email was accepted and issued a live attempt).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function redeemFluentVoucherAction(input: {
  code: string;
  name: string;
  email: string;
  company: string;
}): Promise<{ ok: true; redemptionToken: string } | { ok: false; error: string }> {
  const email = (input.email ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address so your result can be delivered." };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  const userAgent = h.get("user-agent") || null;

  const res = await redeemVoucher({
    code: input.code,
    redeemerName: input.name,
    redeemerEmail: email,
    companyName: input.company,
    ip,
    userAgent,
  });
  if (!res.ok) return res;
  return { ok: true, redemptionToken: res.redemptionToken };
}
