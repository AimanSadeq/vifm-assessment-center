"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Lang = "en" | "ar";

type Q = {
  id: string;
  type: string;
  prompt_en: string;
  prompt_ar?: string | null;
  options_en: string[];
  options_ar?: string[] | null;
  sequence: (string | number | null)[] | null;
};

/**
 * Competency quiz stage. Owns its own intro -> questions flow and calls onDone()
 * once answers are submitted (the orchestrator advances from there). Bilingual:
 * the start route already ships prompt_ar / options_ar, so an Arabic sitting
 * renders them (and RTL). Answer options are a real radiogroup for a11y.
 */
export function QuizStage({ token, onDone, lang = "en" }: { token: string; onDone: () => void; lang?: Lang }) {
  const [phase, setPhase] = useState<"intro" | "quiz">("intro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  // Two-step submit: each stage is final, so a stray click must not end it
  // (trial: "the quiz submits on the first click, with no confirmation step").
  const [confirming, setConfirming] = useState(false);
  const saveKey = `ph-quiz-${token}`;

  // In-progress answers survive an accidental back/refresh - the server
  // re-serves the same stored deck, so restored ids still match.
  useEffect(() => {
    if (phase !== "quiz") return;
    try { sessionStorage.setItem(saveKey, JSON.stringify(answers)); } catch { /* best-effort */ }
  }, [phase, answers, saveKey]);

  const ar = lang === "ar";
  const tr = (en: string, arText: string) => (ar ? arText : en);
  const qPrompt = (q: Q) => (ar && q.prompt_ar ? q.prompt_ar : q.prompt_en);
  const qOptions = (q: Q) => (ar && Array.isArray(q.options_ar) && q.options_ar.length ? q.options_ar : q.options_en);

  const start = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/prehire/${token}/quiz/start`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (d.done) return onDone();
    if (!r.ok || !d.questions) return setError(d.error || tr("Couldn't start the assessment.", "تعذّر بدء التقييم."));
    setQuestions(d.questions as Q[]);
    try {
      const raw = sessionStorage.getItem(saveKey);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, number>;
        if (saved && typeof saved === "object") setAnswers(saved);
      }
    } catch { /* corrupt blob - start clean */ }
    setPhase("quiz");
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/prehire/${token}/quiz/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setBusy(false);
    // Idempotent completion: a lost response may already have completed the
    // stage server-side - a second click must advance, not error.
    if (r.status === 409) {
      try { sessionStorage.removeItem(saveKey); } catch { /* best-effort */ }
      return onDone();
    }
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return setError(d.error || tr("Couldn't submit your answers.", "تعذّر إرسال إجاباتك."));
    }
    try { sessionStorage.removeItem(saveKey); } catch { /* best-effort */ }
    onDone();
  };

  const allAnswered =
    questions.length > 0 && questions.every((q) => typeof answers[q.id] === "number");

  return (
    <div className="space-y-4" dir={ar ? "rtl" : "ltr"}>
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {phase === "intro" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="font-semibold text-[#010131]">{tr("Competency assessment", "تقييم الكفاءات")}</h2>
            <p className="text-sm text-muted-foreground">
              {tr(
                "A short set of questions about the competencies for this role. Answer honestly - there are no trick questions. It takes only a few minutes.",
                "مجموعة قصيرة من الأسئلة حول الكفاءات المطلوبة لهذا الدور. أجب بصدق - لا توجد أسئلة خادعة. لن يستغرق الأمر سوى دقائق."
              )}
            </p>
            <Button onClick={start} disabled={busy} className="w-full">
              {busy ? tr("Preparing…", "جارٍ التحضير…") : tr("Start assessment", "ابدأ التقييم")}
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === "quiz" && (
        <>
          {questions.map((q, qi) => {
            const opts = qOptions(q);
            const labelId = `q-${q.id}-label`;
            return (
              <Card key={q.id}>
                <CardContent className="space-y-3 pt-6">
                  <p id={labelId} className="text-sm font-medium text-[#010131]">
                    {qi + 1}. {qPrompt(q)}
                  </p>
                  {q.type === "pattern_recognition" && q.sequence && (
                    <p
                      dir="ltr"
                      className="font-mono text-sm text-[#5391D5]"
                      aria-label={tr("Number sequence with a missing value", "متتالية أرقام بها قيمة ناقصة")}
                    >
                      {q.sequence.map((c) => (c === null ? "?" : c)).join("   ")}
                    </p>
                  )}
                  <div className="space-y-2" role="radiogroup" aria-labelledby={labelId}>
                    {opts.map((opt, oi) => {
                      const selected = answers[q.id] === oi;
                      return (
                        <button
                          key={oi}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                          className={`w-full rounded-md border px-3 py-2 text-start text-sm transition-colors ${
                            selected
                              ? "border-[#5391D5] bg-[#5391D5]/10 font-medium text-[#010131]"
                              : "border-input hover:bg-muted"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {!confirming ? (
            <Button onClick={() => setConfirming(true)} disabled={!allAnswered || busy} className="w-full" size="lg">
              {tr("Submit answers", "إرسال الإجابات")}
            </Button>
          ) : (
            <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-center text-sm text-amber-800">
                {tr("Submit your answers? You can't change them afterwards.", "هل تريد إرسال إجاباتك؟ لا يمكن تغييرها بعد الإرسال.")}
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setConfirming(false)} disabled={busy} className="flex-1">
                  {tr("Keep reviewing", "متابعة المراجعة")}
                </Button>
                <Button onClick={submit} disabled={busy} className="flex-1">
                  {busy ? tr("Submitting…", "جارٍ الإرسال…") : tr("Yes, submit", "نعم، أرسل")}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
