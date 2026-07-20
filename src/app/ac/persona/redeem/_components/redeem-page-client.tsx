"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RedeemForm } from "./redeem-form";

/**
 * Client shell that owns the language state so the hero and the "Your details"
 * card follow the form's EN/AR toggle (trial: Omar - "when selecting Arabic,
 * 'Your Details' and the introduction message on top do not get changed").
 */
export function PersonaRedeemPageClient({ initialCode }: { initialCode: string }) {
  const [lang, setLang] = useState<"en" | "ar">("en");
  const ar = lang === "ar";

  return (
    <>
      <header className="ara-hero relative overflow-hidden" dir={ar ? "rtl" : "ltr"}>
        <div className="mx-auto max-w-3xl px-6 pt-7 pb-20">
          <VifmLogo variant="white" size="sm" />
          <div className="mt-10 max-w-2xl">
            <span className="ara-eyebrow text-accent">
              <Layers className="h-3 w-3" /> {ar ? "‏VIFM Persona®" : "VIFM Persona®"}
            </span>
            <h1 className="ara-numeral mt-4 text-3xl font-semibold leading-tight text-white sm:text-4xl">
              {ar ? "استخدم رمز الوصول الخاص بك" : "Redeem your access code"}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-white/75">
              {ar
                ? "أدخل رمز القسيمة الذي زوّدتك به مؤسستك، ثم أكمل تقييمًا سلوكيًا ذاتيًا قصيرًا. تعرض الشاشة التالية نطاق تقييمك بالضبط - قد يكون الإطار الكامل أو مجموعة مركّزة اختارتها مؤسستك. لا حاجة لحساب."
                : "Enter the voucher code your organisation gave you, then complete a short behavioural self-assessment. The next screen shows exactly what your assessment covers - it may be the full framework or a focused set your organisation chose. No account needed."}
            </p>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto -mt-10 max-w-2xl px-6 pb-16">
        <Card dir={ar ? "rtl" : "ltr"}>
          <CardHeader>
            <CardTitle className="text-base">{ar ? "بياناتك" : "Your details"}</CardTitle>
          </CardHeader>
          <CardContent>
            <RedeemForm initialCode={initialCode} lang={lang} onLangChange={setLang} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
