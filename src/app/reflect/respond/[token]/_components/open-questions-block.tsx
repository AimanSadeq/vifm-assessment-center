"use client";

import { useState } from "react";
import { saveReflectOpenResponse } from "@/lib/reflect/rater-actions";

type Kind = "strengths" | "development" | "example" | "advice" | "other";
export type OpenQuestionValues = Record<Kind, string>;

const QUESTIONS: { kind: Kind; en: string; enSelf: string; ar: string; arSelf: string }[] = [
  {
    kind: "strengths",
    en: "What are this person's most significant strengths? Please give specific examples.",
    enSelf: "What are your most significant strengths? Please give specific examples.",
    ar: "ما أبرز نقاط قوة هذا الشخص؟ يُرجى ذكر أمثلة محددة.",
    arSelf: "ما أبرز نقاط قوّتك؟ يُرجى ذكر أمثلة محددة.",
  },
  {
    kind: "development",
    en: "In which areas would you most encourage this person to develop or improve?",
    enSelf: "In which areas would you most like to develop or improve?",
    ar: "ما المجالات التي تشجّع هذا الشخص على تطويرها أو تحسينها؟",
    arSelf: "ما المجالات التي ترغب في تطويرها أو تحسينها؟",
  },
  {
    kind: "example",
    en: "Describe a specific situation in which this person demonstrated exceptional leadership or collaboration.",
    enSelf: "Describe a specific situation in which you demonstrated exceptional leadership or collaboration.",
    ar: "صف موقفًا محددًا أظهر فيه هذا الشخص قيادة أو تعاونًا استثنائيًا.",
    arSelf: "صف موقفًا محددًا أظهرتَ فيه قيادة أو تعاونًا استثنائيًا.",
  },
  {
    kind: "advice",
    en: "What ONE piece of advice would help this person be more effective in their role?",
    enSelf: "What ONE piece of advice would help you be more effective in your role?",
    ar: "ما النصيحة الواحدة التي تساعد هذا الشخص على أن يكون أكثر فاعلية في دوره؟",
    arSelf: "ما النصيحة الواحدة التي تساعدك على أن تكون أكثر فاعلية في دورك؟",
  },
  {
    kind: "other",
    en: "Is there anything else you would like to share that wasn't covered above?",
    enSelf: "Is there anything else you would like to share that wasn't covered above?",
    ar: "هل هناك أي شيء آخر تودّ مشاركته ولم تتم تغطيته أعلاه؟",
    arSelf: "هل هناك أي شيء آخر تودّ مشاركته ولم تتم تغطيته أعلاه؟",
  },
];

/**
 * The five open-ended questions (migration 00101). Self-contained: each answer
 * autosaves on blur via saveReflectOpenResponse (no debounce/flush needed - blur
 * fires before the form's submit-confirm step). Sits alongside Start/Stop/
 * Continue, not replacing it.
 */
export function OpenQuestionsBlock({
  token,
  isSelf,
  ar,
  initial,
}: {
  token: string;
  isSelf: boolean;
  ar: boolean;
  initial: OpenQuestionValues;
}) {
  const [savingKind, setSavingKind] = useState<Kind | null>(null);
  const [savedKind, setSavedKind] = useState<Kind | null>(null);
  const tx = (en: string, arabic: string) => (ar ? arabic : en);

  const save = async (kind: Kind, text: string) => {
    setSavingKind(kind);
    setSavedKind(null);
    try {
      await saveReflectOpenResponse({ token, kind, text: text.trim() });
      setSavedKind(kind);
    } catch {
      /* best-effort; the consultant can chase a missing verbatim */
    } finally {
      setSavingKind(null);
    }
  };

  return (
    <section className="space-y-4" dir={ar ? "rtl" : "ltr"}>
      <div>
        <h2 className="text-lg font-semibold text-[#010131]">{tx("In your own words", "بكلماتك الخاصة")}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {tx(
            "Specific, behavioural examples are the most useful part of this feedback. All questions are optional.",
            "الأمثلة السلوكية المحددة هي أكثر أجزاء هذه التغذية الراجعة فائدة. جميع الأسئلة اختيارية.",
          )}
        </p>
      </div>
      {QUESTIONS.map((q) => {
        const label = ar ? (isSelf ? q.arSelf : q.ar) : isSelf ? q.enSelf : q.en;
        return (
          <label key={q.kind} className="block">
            <span className="text-sm font-medium text-[#010131]">{label}</span>
            <textarea
              defaultValue={initial[q.kind]}
              onBlur={(e) => save(q.kind, e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder={tx("Optional - write as much or as little as you like.", "اختياري - اكتب بقدر ما تشاء.")}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#5391D5] focus:outline-none"
            />
            <span className="text-[11px] text-muted-foreground">
              {savingKind === q.kind ? tx("Saving…", "جارٍ الحفظ…") : savedKind === q.kind ? tx("Saved", "تم الحفظ") : ""}
            </span>
          </label>
        );
      })}
    </section>
  );
}
