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
  onLangChange,
}: {
  initialCode?: string;
  initialName?: string;
  initialEmail?: string;
  initialCompany?: string;
  onLangChange?: (lang: "en" | "ar") => void;
}) {
  return (
    <VoucherRedeemForm
      initialCode={initialCode}
      initialName={initialName}
      initialEmail={initialEmail}
      initialCompany={initialCompany}
      companyField="optional"
      codePlaceholder="VIFM-TECH-XXXX-XXXX"
      submitLabel={{ en: "Start assessment", ar: "ابدأ التقييم" }}
      onLangChange={onLangChange}
      busyLabel={{
        en: "Preparing your assessment - this can take up to a minute…",
        ar: "جارٍ تجهيز تقييمك - قد يستغرق حتى دقيقة…",
      }}
      busyHint={{
        en: "Your questions are being assembled. Please keep this page open while your assessment is prepared.",
        ar: "يجري تجهيز أسئلتك. يرجى إبقاء هذه الصفحة مفتوحة أثناء تجهيز تقييمك.",
      }}
      onRedeem={async (v) => {
        const res = await redeemVoucherAction({ code: v.code, name: v.name, email: v.email, company: v.company });
        if (!res.ok) return { ok: false, error: res.error };
        return { ok: true, redirectTo: `/tech-sandbox/${res.token}` };
      }}
    />
  );
}
