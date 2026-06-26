"use client";

import { VoucherRedeemForm } from "@/components/shared/voucher-redeem-form";
import { redeemFluentVoucherAction } from "../actions";

// Thin wrapper over the shared redeem form (consolidation Phase 2).
// Fluent is an English placement test, so it runs English-only (bilingual=false):
// no EN/AR toggle. The action layer is unchanged.
export function RedeemForm({ initialCode = "", initialCompany = "" }: { initialCode?: string; initialCompany?: string }) {
  return (
    <VoucherRedeemForm
      initialCode={initialCode}
      initialCompany={initialCompany}
      bilingual={false}
      companyField="required"
      codePlaceholder="VIFM-ENG-XXXX-XXXX"
      submitLabel={{ en: "Start my English placement", ar: "Start my English placement" }}
      onRedeem={async (v) => {
        const res = await redeemFluentVoucherAction({ code: v.code, name: v.name, email: v.email, company: v.company });
        if (!res.ok) return { ok: false, error: res.error };
        return { ok: true, redirectTo: `/ac/fluent/take/${res.redemptionToken}` };
      }}
    />
  );
}
