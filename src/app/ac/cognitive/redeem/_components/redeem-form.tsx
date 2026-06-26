"use client";

import { VoucherRedeemForm } from "@/components/shared/voucher-redeem-form";
import { redeemCognitiveVoucherAction } from "../actions";

// Thin wrapper over the shared bilingual redeem form (consolidation Phase 2).
// Logica gains the EN/AR toggle it lacked; the action layer is unchanged.
export function RedeemForm({ initialCode = "" }: { initialCode?: string }) {
  return (
    <VoucherRedeemForm
      initialCode={initialCode}
      companyField="required"
      codePlaceholder="VIFM-COG-XXXX-XXXX"
      submitLabel={{ en: "Start my cognitive assessment", ar: "ابدأ تقييم القدرات الذهنية" }}
      onRedeem={async (v) => {
        const res = await redeemCognitiveVoucherAction({ code: v.code, name: v.name, email: v.email, company: v.company });
        if (!res.ok) return { ok: false, error: res.error };
        return { ok: true, redirectTo: `/ac/cognitive/take/${res.redemptionToken}` };
      }}
    />
  );
}
