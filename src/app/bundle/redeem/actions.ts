"use server";

// Public voucher redemption (no account). The voucher code is the credential;
// the action provisions a bundle_candidate and returns its apply token.
// Reachable because middleware auth-bypasses /bundle/redeem.
import { redeemBundleVoucher } from "@/lib/bespoke/bundle-vouchers";

export async function redeemBundleVoucherAction(input: {
  code: string;
  fullName: string;
  email: string;
}): Promise<{ ok: true; token: string } | { error: string }> {
  return redeemBundleVoucher(input);
}
