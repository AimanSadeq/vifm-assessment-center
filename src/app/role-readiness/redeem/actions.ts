"use server";

// Public voucher redemption (no account). The voucher code is the credential;
// the action provisions an rr_candidate and returns its apply token. Reachable
// because middleware auth-bypasses /role-readiness/redeem.
import { redeemRoleReadinessVoucher } from "@/lib/role-readiness/vouchers";

export async function redeemVoucherAction(input: {
  code: string;
  fullName: string;
  email: string;
}): Promise<{ ok: true; token: string } | { error: string }> {
  return redeemRoleReadinessVoucher(input);
}
