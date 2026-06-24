import { createServiceClient } from "@/lib/supabase/server";
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
  if (code) {
    try {
      const sb = createServiceClient();
      const { data } = await sb
        .from("ara_vouchers")
        .select("client_name")
        .eq("code", code.toUpperCase())
        .maybeSingle<{ client_name: string | null }>();
      company = data?.client_name || "";
    } catch {
      /* tolerant - leave company blank */
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-md px-6 py-16">
        <RedeemForm initialCode={code} initialCompany={company} />
      </div>
    </div>
  );
}
