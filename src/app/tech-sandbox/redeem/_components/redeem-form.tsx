"use client";

import { VoucherRedeemForm } from "@/components/shared/voucher-redeem-form";
import { redeemVoucherAction } from "../actions";

// Thin wrapper over the shared bilingual redeem form (consolidation Phase 2).
// Techno gains the EN/AR toggle; name/email/company are prefilled server-side
// from the voucher row (the safe pattern), passed via initial* props.
export function RedeemForm({
  initialCode,
  initialName,
  initialEmail,
  initialCompany,
}: {
  initialCode?: string;
  initialName?: string;
  initialEmail?: string;
  initialCompany?: string;
}) {
  return (
    <VoucherRedeemForm
      initialCode={initialCode}
      initialName={initialName}
      initialEmail={initialEmail}
      initialCompany={initialCompany}
      companyField="required"
      codePlaceholder="VIFM-TECH-XXXX-XXXX"
      submitLabel={{ en: "Start assessment", ar: "ابدأ التقييم" }}
      onRedeem={async (v) => {
        const res = await redeemVoucherAction({ code: v.code, name: v.name, email: v.email, company: v.company });
        if (!res.ok) return { ok: false, error: res.error };
        return { ok: true, redirectTo: `/tech-sandbox/${res.token}` };
      }}
    />
  );
}
