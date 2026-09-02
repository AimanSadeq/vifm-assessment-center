"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ARA_DEMOGRAPHICS, type AraDemographics, type AraDemographicDimensionId } from "@/lib/constants/ara-demographics";
import { setAraRespondentDemographics } from "@/lib/ara/respondent-actions";

/**
 * OPTIONAL "about you" block on the respondent form. Feeds the dashboard's
 * Segments view and nothing else: it is not scored, every question can be
 * left blank, and answers are only ever shown as group aggregates of at
 * least ARA_SEGMENT_MIN_N people. Saves on each change (best-effort, like
 * the answers); a respondent who ignores it loses nothing.
 */
export function DemographicsSection({
  token,
  language,
  initial,
}: {
  token: string;
  language: "en" | "ar";
  initial: AraDemographics | null;
}) {
  const rtl = language === "ar";
  const [values, setValues] = useState<AraDemographics>(initial ?? {});

  const set = async (dim: AraDemographicDimensionId, key: string) => {
    const next: AraDemographics = { ...values };
    if (key === "") delete next[dim];
    else next[dim] = key;
    setValues(next);
    const res = await setAraRespondentDemographics(token, next);
    if (!res.ok) toast.error(rtl ? "تعذّر حفظ هذا الاختيار" : "Could not save that choice");
  };

  return (
    <Card dir={rtl ? "rtl" : "ltr"}>
      <CardHeader>
        <CardTitle className="text-base">
          {rtl ? "عنك (اختياري)" : "About you (optional)"}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {rtl
            ? "تساعد هذه الإجابات مؤسستك على قراءة النتائج حسب الشريحة. لا تؤثر في درجتك، ولا تُعرض إلا كمجاميع لمجموعات من ثلاثة أشخاص فأكثر. يمكنك تخطي أي سؤال."
            : "These answers let your organisation read results by group. They do not affect your score and are only shown as aggregates of three or more people. Skip any question you prefer not to answer."}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {ARA_DEMOGRAPHICS.map((dim) => (
            <label key={dim.id} className="block text-sm">
              <span className="mb-1 block font-medium">{rtl ? dim.label_ar : dim.label_en}</span>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={values[dim.id] ?? ""}
                onChange={(e) => set(dim.id, e.target.value)}
              >
                <option value="">{rtl ? "أفضّل عدم الإجابة" : "Prefer not to say"}</option>
                {dim.options.map((o) => (
                  <option key={o.key} value={o.key}>{rtl ? o.ar : o.en}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
