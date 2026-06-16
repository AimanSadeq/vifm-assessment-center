"use server";

import { headers } from "next/headers";
import { redeemVoucher } from "@/lib/cognitive/vouchers";

export async function redeemCognitiveVoucherAction(input: {
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
