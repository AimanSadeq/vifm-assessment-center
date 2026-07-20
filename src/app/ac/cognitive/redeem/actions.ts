"use server";

import { headers } from "next/headers";
import { redeemVoucher } from "@/lib/cognitive/vouchers";

// Server-side email shape check BEFORE the seat claim (trial: Asaad - the
// same gap he flagged on Fluent and Persona; Fluent's action got this first).
// An invalid address must never consume a voucher seat.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function redeemCognitiveVoucherAction(input: {
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
