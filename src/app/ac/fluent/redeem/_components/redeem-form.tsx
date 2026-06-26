"use client";

import { VoucherRedeemForm } from "@/components/shared/voucher-redeem-form";
import { redeemFluentVoucherAction } from "../actions";

// Thin wrapper over the shared bilingual redeem form (consolidation Phase 2).
// Fluent gains the EN/AR toggle it lacked; the action layer is unchanged.
export function RedeemForm({ initialCode = "", initialCompany = "" }: { initialCode?: string; initialCompany?: string }) {
  return (
    <VoucherRedeemForm
      initialCode={initialCode}
      initialCompany={initialCompany}
      companyField="required"
      codePlaceholder="VIFM-ENG-XXXX-XXXX"
      submitLabel={{ en: "Start my English placement", ar: "ابدأ اختبار اللغة الإنجليزية" }}
      onRedeem={async (v) => {
        const res = await redeemFluentVoucherAction({ code: v.code, name: v.name, email: v.email, company: v.company });
        if (!res.ok) return { ok: false, error: res.error };
        return { ok: true, redirectTo: `/ac/fluent/take/${res.redemptionToken}` };
      }}
    />
  );
}
