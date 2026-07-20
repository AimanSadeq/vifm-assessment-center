import { createServiceClient } from "@/lib/supabase/server";
import { loadVoucherBlock } from "@/lib/vouchers/status";
import { VoucherBlockedCard } from "@/components/shared/voucher-blocked-card";
import { RedeemForm } from "./_components/redeem-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Redeem Voucher · AI Readiness Compass®" };

// Only the voucher CODE is honoured from the URL. Name/email are NOT pre-filled
// from query params - a crafted link pre-filling someone's PII is a phishing
// vector; the delegate types their own details. Company is derived server-side
// from the voucher's tagged client (safe, not attacker-controlled).
type Props = { searchParams?: { code?: string } };

export default async function RedeemVoucherPage({ searchParams }: Props) {
  const code = searchParams?.code?.trim() || "";

  let company = "";
  // Default to a REAL run: every admin-issued voucher is is_practice=false, so a
  // manual-entry redeem (no prefilled code, status unknown) must not show the
  // "practice run" disclaimer. Only a genuinely practice voucher flips this true.
  let isPractice = false;
  if (code) {
    try {
      const sb = createServiceClient();
      const { data } = await sb
        .from("ara_vouchers")
        .select("client_name, is_practice")
        .eq("code", code.toUpperCase())
        .maybeSingle<{ client_name: string | null; is_practice: boolean | null }>();
      company = data?.client_name || "";
      isPractice = data?.is_practice === true;
    } catch {
      /* tolerant - leave company blank + treat as a real run */
    }
  }

  // Tell the delegate the code is spent/expired/deactivated BEFORE they fill the
  // form in, instead of after submitting it (trial feedback - Amal).
  const block = await loadVoucherBlock("ara", code);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 py-16">
        {block ? (
          <VoucherBlockedCard block={block} code={code} redeemPath="/ara/redeem" />
        ) : (
          <RedeemForm initialCode={code} initialCompany={company} isPractice={isPractice} />
        )}
      </div>
    </div>
  );
}
