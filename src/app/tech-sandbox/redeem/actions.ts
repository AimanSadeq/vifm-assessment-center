"use server";
// Public voucher redemption for the technical sandbox (no account). Auth is
// bypassed for /tech-sandbox/* in middleware; the code is validated atomically
// via the technical_sandbox_voucher_claim RPC inside redeemVoucher().
import { redeemVoucher } from "@/lib/technical-sandbox/vouchers";

export async function redeemVoucherAction(input: {
  code: string;
  name: string;
  email: string;
  company: string;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  return redeemVoucher(input);
}
