"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Voluntary equal-opportunity self-identification, shown after consent and
 * BEFORE the assessment so it's visibly decoupled from scoring. Every field is
 * optional; "Skip" and "prefer not to say" are first-class. Used by VIFM only in
 * aggregate to monitor fairness (the 4/5ths rule) - never per-individual, never
 * by assessors, never in the score.
 */

type Opt = { value: string; label: string; label_ar: string };
const GENDERS: Opt[] = [
  { value: "male", label: "Male", label_ar: "ذكر" },
  { value: "female", label: "Female", label_ar: "أنثى" },
  { value: "prefer_not_to_say", label: "Prefer not to say", label_ar: "أفضّل عدم الإجابة" },
];
const AGE_BANDS: Opt[] = [
  { value: "under_25", label: "Under 25", label_ar: "أقل من 25" },
  { value: "25_34", label: "25–34", label_ar: "25–34" },
  { value: "35_44", label: "35–44", label_ar: "35–44" },
  { value: "45_54", label: "45–54", label_ar: "45–54" },
  { value: "55_plus", label: "55 or older", label_ar: "55 فأكثر" },
  { value: "prefer_not_to_say", label: "Prefer not to say", label_ar: "أفضّل عدم الإجابة" },
];
const NATIONALITY: Opt[] = [
  { value: "national", label: "National / citizen", label_ar: "مواطن" },
  { value: "expatriate", label: "Expatriate / resident", label_ar: "وافد / مقيم" },
  { value: "prefer_not_to_say", label: "Prefer not to say", label_ar: "أفضّل عدم الإجابة" },
];

function Field({ id, label, value, onChange, options, ar }: { id: string; label: string; value: string; onChange: (v: string) => void; options: Opt[]; ar: boolean }) {
  return (
    <label className="block" htmlFor={id}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <select
        id={id}
        name={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5391D5]"
      >
        <option value="">-</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{ar ? o.label_ar : o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function DemographicsCard({ token, onDone, lang = "en" }: { token: string; onDone: () => void; lang?: "en" | "ar" }) {
  const ar = lang === "ar";
  const tr = (en: string, arText: string) => (ar ? arText : en);
  const [gender, setGender] = useState("");
  const [ageBand, setAgeBand] = useState("");
  const [nationality, setNationality] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async (body: Record<string, string>) => {
    setBusy(true);
    try {
      await fetch(`/api/prehire/${token}/demographics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      /* optional step - never block on failure */
    } finally {
      setBusy(false);
      onDone();
    }
  };

  return (
    <Card dir={ar ? "rtl" : "ltr"}>
      <CardContent className="space-y-4 pt-6">
        <div>
          <h2 className="font-semibold text-[#010131]">{tr("Optional: equal-opportunity monitoring", "اختياري: رصد تكافؤ الفرص")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ar ? (
              <>هذه الخطوة اختيارية تمامًا ولا تُستخدم <strong>أبدًا</strong> في تقييمك ولا يطّلع عليها من يراجع نتيجتك. تستخدمها VIFM بشكل تجميعي فقط للتحقق من عدالة الفرز للجميع. نسألها الآن، قبل أن تبدأ، لأسباب إدارية بحتة - ولا يمكن أن تؤثر على نتيجتك. يمكنك تخطيها.</>
            ) : (
              <>This is completely voluntary and is <strong>never</strong> used in your assessment or
              seen by the people reviewing it. VIFM uses it only in aggregate to check the screening
              is fair to everyone. We ask it now, before you begin, purely for administrative reasons -
              it <strong>cannot</strong> influence your result. You can skip it.</>
            )}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field id="prehire-eeo-gender" label={tr("Gender", "الجنس")} value={gender} onChange={setGender} options={GENDERS} ar={ar} />
          <Field id="prehire-eeo-age" label={tr("Age", "العمر")} value={ageBand} onChange={setAgeBand} options={AGE_BANDS} ar={ar} />
          <Field id="prehire-eeo-nationality" label={tr("Nationality", "الجنسية")} value={nationality} onChange={setNationality} options={NATIONALITY} ar={ar} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => send({ gender, age_band: ageBand, nationality_group: nationality })}
            disabled={busy}
          >
            {busy ? tr("Saving…", "جارٍ الحفظ…") : tr("Submit", "إرسال")}
          </Button>
          <Button variant="ghost" onClick={() => send({})} disabled={busy}>
            {tr("Skip", "تخطي")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
