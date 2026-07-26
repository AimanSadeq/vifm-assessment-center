"use client";

import { useState } from "react";
import { RedeemForm } from "./redeem-form";

/**
 * Client shell that owns the language state so the card header and the
 * single-use warning follow the form's EN/AR toggle (trial: Omar - "when
 * changing the language to Arabic, the header does not change").
 */
export function TechnoRedeemPageClient({
  initialCode,
  initialName,
  initialEmail,
  initialCompany,
}: {
  initialCode: string;
  initialName: string;
  initialEmail: string;
  initialCompany: string;
}) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const ar = lang === "ar";

  return (
    <div className="rounded-lg border border-border bg-card p-6" dir={ar ? "rtl" : "ltr"}>
      <div className="mb-1 text-xs uppercase tracking-wide text-accent">
        {ar ? "‏VIFM · تكنو" : "VIFM · Techno"}
      </div>
      <h1 className="text-lg font-semibold text-foreground">
        {ar ? "استخدم رمز الوصول الخاص بك" : "Redeem your access code"}
      </h1>
      <p className="mb-3 mt-1 text-sm text-muted-foreground">
        {ar
          ? "أدخل رمز القسيمة وبياناتك لبدء التقييم. يبدأ التوقيت عند الضغط على ابدأ."
          : "Enter your voucher code and details to begin the assessment. It is timed once you start."}
      </p>
      <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        {ar
          ? "يمكن استخدام رمز القسيمة مرة واحدة فقط. ابدأ فقط عندما تكون مستعدًا لإكمال التقييم في جلسة واحدة."
          : "Your voucher code can be used only once. Start only when you are ready to complete the assessment in one sitting."}
      </p>
      <RedeemForm
        initialCode={initialCode}
        initialName={initialName}
        initialEmail={initialEmail}
        initialCompany={initialCompany}
        onLangChange={setLang}
      />
    </div>
  );
}
