import { createServiceClient } from "@/lib/supabase/server";
import { RedeemForm } from "./_components/redeem-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "Redeem Voucher · AI Readiness Compass" };

type Props = { searchParams?: { code?: string; email?: string; name?: string } };

/** Public voucher redemption - no account required (auth-bypassed in middleware).
 *  A one-click invite link carries ?code= (and ?email=); we prefill those and
 *  the company (from the voucher's tagged client) so the delegate just confirms. */
export default async function RedeemVoucherPage({ searchParams }: Props) {
  const code = searchParams?.code?.trim() || "";
  const email = searchParams?.email?.trim() || "";
  const name = searchParams?.name?.trim() || "";

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
        <RedeemForm initialCode={code} initialEmail={email} initialName={name} initialCompany={company} />
      </div>
    </div>
  );
}
