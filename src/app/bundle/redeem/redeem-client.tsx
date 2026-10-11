"use client";

import { Boxes } from "lucide-react";
import { VoucherRedeemForm } from "@/components/shared/voucher-redeem-form";
import { redeemBundleVoucherAction } from "./actions";

// Branding wrapper + the shared redeem form (English only). Name/email are prefilled
// from the voucher row server-side (page.tsx), never from URL params.
export function RedeemClient({
  code,
  emailPrefill,
  namePrefill = "",
}: {
  code: string;
  emailPrefill: string;
  namePrefill?: string;
}) {
  return (
    <div className="min-h-screen bg-[#FEFFF9]">
      <header className="border-b bg-[#010131] px-6 py-4 text-white">
        <div className="mx-auto flex max-w-xl items-center gap-2">
          <Boxes className="h-5 w-5 text-[#5391D5]" />
          <span className="text-sm font-semibold">VIFM Bespoke Assessment</span>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-6 py-10">
        {!code ? (
          <div className="rounded-xl border bg-card p-6 text-center">
            <h1 className="text-lg font-semibold text-[#010131]">Missing voucher code</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Open the link your organisation sent you - it includes the code.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-6">
            <h1 className="text-xl font-semibold text-[#010131]">Start your assessment</h1>
            <p className="mt-1 text-sm text-muted-foreground">Enter your details to begin.</p>
            <div className="mt-4">
              <VoucherRedeemForm
                initialCode={code}
                initialName={namePrefill}
                initialEmail={emailPrefill}
                companyField="hidden"
                codePlaceholder="BND-XXXX-XXXX"
                // Bundles run in English only (scenarios are authored in English and
                // the reasoning stage is served in English), so no AR toggle: choosing
                // Arabic here only translated the form (Ali, SDC pilot, 11 Oct 2026).
                bilingual={false}
                footerNote={{ en: "This assessment is in English.", ar: "This assessment is in English." }}
                submitLabel={{ en: "Start assessment", ar: "ابدأ التقييم" }}
                onRedeem={async (v) => {
                  const res = await redeemBundleVoucherAction({ code: v.code, fullName: v.name, email: v.email });
                  if ("error" in res) return { ok: false, error: res.error };
                  return { ok: true, redirectTo: `/bundle/apply/${res.token}` };
                }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
