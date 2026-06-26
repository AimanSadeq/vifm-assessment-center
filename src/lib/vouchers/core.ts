import { createServiceClient } from "@/lib/supabase/server";
import { normalizeCode } from "./codegen";
import type { VoucherDescriptor } from "./descriptor";
import type { ProvisionResult, RedeemerInput, RedeemOutcome } from "./types";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type ProvisionFn<TClaim> = (args: {
  sb: ServiceClient;
  /** the claimed voucher row returned by the claim RPC */
  voucher: TClaim;
  redeemer: RedeemerInput;
  /** normalized code (trimmed + uppercased) */
  code: string;
}) => Promise<ProvisionResult>;

/**
 * Shared redeem engine. Every per-service redeem delegates here:
 *   1) atomically claim a seat via descriptor.claimRpc,
 *   2) run the service-specific provision() (create the assessment/session/candidate),
 *   3) if provision fails, hand the seat back via descriptor.releaseRpc (best-effort).
 *
 * This is the single copy of the claim -> provision -> compensate logic that was
 * duplicated across seven vouchers.ts files (and where Fluent was silently
 * missing the compensation step before 00167).
 */
export type RedeemOptions = {
  /** Customize the claim-failure message (e.g. distinguish "invalid code" from
   *  "fully redeemed" with a follow-up query). Return null to use the default. */
  onClaimFailed?: (args: { sb: ServiceClient; code: string }) => Promise<string | null>;
};

export async function redeemViaDescriptor<TClaim extends object>(
  descriptor: VoucherDescriptor,
  redeemer: RedeemerInput,
  provision: ProvisionFn<TClaim>,
  opts?: RedeemOptions,
): Promise<RedeemOutcome> {
  const code = normalizeCode(redeemer.code);
  if (!code) return { ok: false, error: "Enter a voucher code." };

  const sb = createServiceClient();
  const { data: claimed, error: claimErr } = await sb.rpc(descriptor.claimRpc, { p_code: code });
  if (claimErr) return { ok: false, error: "Could not redeem this code. Please try again." };
  const voucher = (Array.isArray(claimed) ? claimed[0] : claimed) as TClaim | undefined;
  if (!voucher) {
    if (opts?.onClaimFailed) {
      const custom = await opts.onClaimFailed({ sb, code }).catch(() => null);
      if (custom) return { ok: false, error: custom };
    }
    return { ok: false, error: "This code is invalid, expired, or fully used." };
  }

  let result: ProvisionResult;
  try {
    result = await provision({ sb, voucher, redeemer, code });
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : "Could not start." };
  }

  if (!result.ok) {
    if (descriptor.releaseRpc) {
      try {
        await sb.rpc(descriptor.releaseRpc, { p_code: code });
      } catch {
        /* best-effort - the claim already incremented the seat counter */
      }
    }
    return { ok: false, error: result.error };
  }

  const { ok: _ok, ...rest } = result;
  void _ok;
  return { ok: true, ...rest };
}
