"use client";

import { VoucherRedeemForm } from "@/components/shared/voucher-redeem-form";
import { redeemPrehireVoucherAction } from "../actions";

// Thin wrapper over the shared bilingual redeem form (consolidation Phase 2).
// Pre-Hire gains the EN/AR toggle; name/email are never prefilled from the URL
// (phishing guard) - only code + company come in (server-derived). Action layer
// (incl. the per-IP rate limit) is unchanged.
export function RedeemForm({ initialCode, initialCompany }: { initialCode: string; initialCompany: string }) {
  return (
    <VoucherRedeemForm
      initialCode={initialCode}
      initialCompany={initialCompany}
      companyField="optional"
      codePlaceholder="VIFM-HIRE-XXXX-XXXX"
      submitLabel={{ en: "Begin screening", ar: "ابدأ الفرز" }}
      onRedeem={async (v) => {
        const res = await redeemPrehireVoucherAction({ code: v.code, name: v.name, email: v.email, company: v.company });
        if (!res.ok) return { ok: false, error: res.error };
        return { ok: true, redirectTo: `/prehire/apply/${res.token}` };
      }}
    />
  );
}
