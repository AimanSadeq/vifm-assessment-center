"use client";

import { useEffect, useRef, useState } from "react";
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
  registerInflight,
  onSaveResult,
  registerRetry,
}: {
  token: string;
  isSelf: boolean;
  ar: boolean;
  initial: OpenQuestionValues;
  /** Register a save promise with the parent's submit flush so completion never
   *  fires while a blur-save is still in flight (else the answer is lost). */
  registerInflight?: (p: Promise<unknown>) => void;
  /** Report each save's outcome so the parent submit gate can refuse completion
   *  while one of these answers is unsaved (the rater retries via the inline
   *  "Not saved - retry" control or the parent's Submit). */
  onSaveResult?: (kind: Kind, ok: boolean) => void;
  /** Hand the parent a function that re-saves every currently-failed answer, so
   *  the Submit flow can retry these (the parent has no access to the text). */
  registerRetry?: (fn: () => Promise<void>) => void;
}) {
  const [savingKind, setSavingKind] = useState<Kind | null>(null);
  const [savedKind, setSavedKind] = useState<Kind | null>(null);
  // Set (not a single slot): if two answers fail while offline, each must keep
  // its own "Not saved - retry" control rather than the last failure clobbering
  // the others' indicators.
  const [failedKinds, setFailedKinds] = useState<Set<Kind>>(() => new Set());
  const failedRef = useRef<Set<Kind>>(new Set());
  const lastText = useRef<Record<string, string>>({});
  const tx = (en: string, arabic: string) => (ar ? arabic : en);

  const markFailed = (kind: Kind, failed: boolean) => {
    if (failed) failedRef.current.add(kind);
    else failedRef.current.delete(kind);
    setFailedKinds(new Set(failedRef.current));
  };

  const save = async (kind: Kind, text: string) => {
    lastText.current[kind] = text;
    setSavingKind(kind);
    setSavedKind(null);
    markFailed(kind, false);
    const p = saveReflectOpenResponse({ token, kind, text: text.trim() });
    registerInflight?.(p);
    try {
      // The server action RESOLVES with { ok:false } for lifecycle rejections
      // ("already submitted", "engagement closed", ...) - it only throws for
      // network errors. Checking ok is what stops a rejected save rendering
      // the emerald "Saved" confirmation.
      const res = await p;
      if (res && res.ok === false) {
        markFailed(kind, true);
        onSaveResult?.(kind, false);
      } else {
        setSavedKind(kind);
        onSaveResult?.(kind, true);
      }
    } catch {
      // Surface the failure (previously swallowed silently) so the rater knows
      // their answer did not save and can retry.
      markFailed(kind, true);
      onSaveResult?.(kind, false);
    } finally {
      setSavingKind((k) => (k === kind ? null : k));
    }
  };

  // Expose a "retry every failed answer" handle so the parent's Submit flow can
  // clear open-question failures (its own retry loop can't - it has no text).
  useEffect(() => {
    registerRetry?.(async () => {
      const kinds = Array.from(failedRef.current);
      await Promise.all(kinds.map((k) => save(k, lastText.current[k] ?? "")));
    });
    // save/registerRetry are stable enough for this one-time registration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <span className="text-[11px]">
              {savingKind === q.kind ? (
                <span className="text-muted-foreground">{tx("Saving…", "جارٍ الحفظ…")}</span>
              ) : failedKinds.has(q.kind) ? (
                <button
                  type="button"
                  onClick={() => save(q.kind, lastText.current[q.kind] ?? "")}
                  className="text-rose-600 underline"
                >
                  {tx("Not saved - retry", "لم يُحفظ - أعد المحاولة")}
                </button>
              ) : savedKind === q.kind ? (
                <span className="text-emerald-600">{tx("Saved", "تم الحفظ")}</span>
              ) : null}
            </span>
          </label>
        );
      })}
    </section>
  );
}
