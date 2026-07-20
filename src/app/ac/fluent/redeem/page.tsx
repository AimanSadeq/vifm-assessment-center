import { Languages } from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { VoucherBlockedCard } from "@/components/shared/voucher-blocked-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createServiceClient } from "@/lib/supabase/server";
import { loadVoucherBlock, voucherBlockCopy } from "@/lib/vouchers/status";
import { RedeemForm } from "./_components/redeem-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Redeem a code · VIFM Fluent®" };

type Props = { searchParams?: { code?: string } };

export default async function FluentRedeemPage({ searchParams }: Props) {
  const initialCode = searchParams?.code?.trim() ?? "";

  // Resolve the voucher so we can (a) show the client it's for, and (b) tell the
  // candidate UP FRONT when the code can no longer be used. Status resolution is
  // shared with every other service (src/lib/vouchers/status.ts) so this fix
  // cannot drift apart across the seven redeem pages again.
  const blocked = await loadVoucherBlock("fluent", initialCode);
  let clientName: string | null = null;
  if (initialCode && !blocked) {
    try {
      const sb = createServiceClient();
      const { data } = await sb
        .from("eng_fluent_vouchers")
        .select("client_name")
        .eq("code", initialCode.toUpperCase())
        .maybeSingle<{ client_name: string | null }>();
      clientName = data?.client_name ?? null;
    } catch {
      /* tolerant - the form still validates the code on submit */
    }
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="fluent-hero">
        <div className="mx-auto max-w-3xl px-6 pt-7 pb-20">
          <VifmLogo variant="white" size="sm" />
          <div className="mt-10 max-w-2xl">
            <span className="ara-eyebrow text-[#9CC4EC]">
              <Languages className="h-3 w-3" /> VIFM Fluent® · English placement
            </span>
            <h1 className="ara-numeral mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">
              {blocked ? voucherBlockCopy(blocked).en.title : "Redeem your access code"}
            </h1>
            {clientName && (
              <p className="mt-3 text-sm font-semibold text-[#9CC4EC]">English placement for {clientName}</p>
            )}
            {!blocked && (
              <p className="mt-3 text-base leading-relaxed text-white/75">
                Enter the voucher code your organisation gave you, then take a four-skill,
                CEFR-aligned English placement. No account needed.
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-10 max-w-2xl px-6 pb-16">
        {blocked ? (
          <VoucherBlockedCard block={blocked} code={initialCode} redeemPath="/ac/fluent/redeem" />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your details</CardTitle>
            </CardHeader>
            <CardContent>
              <RedeemForm initialCode={initialCode} />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
