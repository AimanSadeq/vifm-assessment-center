import { createServiceClient } from "@/lib/supabase/server";
import { VoucherBlockedCard } from "@/components/shared/voucher-blocked-card";
import { loadVoucherBlock } from "@/lib/vouchers/status";
import { RedeemClient } from "./redeem-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Redeem · Role Readiness · VIFM" };

export default async function RoleReadinessRedeemPage({
  searchParams,
}: {
  searchParams?: { code?: string };
}) {
  const code = (searchParams?.code ?? "").trim();

  // Prefill the recipient's name/email from the VOUCHER ROW (server-side) - never
  // from URL params, so a crafted link can't pre-fill an arbitrary identity
  // (phishing). Only for an unused individual (single-seat) voucher. Best-effort.
  let namePrefill = "";
  let emailPrefill = "";
  if (code) {
    try {
      const sb = createServiceClient();
      const { data } = await sb
        .from("rr_vouchers")
        .select("recipient_name, recipient_email, max_uses, uses")
        .eq("code", code)
        .maybeSingle<{
          recipient_name: string | null;
          recipient_email: string | null;
          max_uses: number;
          uses: number;
        }>();
      if (data && data.max_uses === 1 && data.uses < data.max_uses) {
        namePrefill = data.recipient_name ?? "";
        emailPrefill = data.recipient_email ?? "";
      }
    } catch {
      /* tolerant - the form still validates the code on submit */
    }
  }

  // Surface an exhausted code before the delegate fills the form in. NOTE:
  // rr_claim_voucher_seat checks seats ONLY - it ignores rr_vouchers.expires_at
  // even though that column exists and is settable - so "no places left" is the
  // only condition that may block here. loadVoucherBlock encodes that exception.
  const blocked = await loadVoucherBlock("roleReadiness", code);
  if (blocked) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <VoucherBlockedCard block={blocked} code={code} redeemPath="/role-readiness/redeem" />
      </div>
    );
  }

  return <RedeemClient code={code} emailPrefill={emailPrefill} namePrefill={namePrefill} />;
}
