"use client";

import { useState } from "react";
import { Languages, Loader2, Sparkles, RotateCcw, BookOpen, PenLine, CheckCircle2 } from "lucide-react";

type Language = "en" | "ar";
type Cefr = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

type ReadingItem = {
  id: string; passage: string; question: string; options: string[]; correct_index: number; cefr: Cefr;
};
type WritingTask = {
  id: string; prompt_en: string; prompt_ar: string | null; cefr_target: Cefr; min_words: number;
};
type FluentTest = { reading: ReadingItem[]; writing: WritingTask; ai_generated: boolean };
type WritingScore = {
  cefr: Cefr; task_achievement: number; coherence: number; lexical_range: number; grammar: number;
  feedback_en: string; feedback_ar: string | null; ai_generated: boolean;
};
type FluentResult = {
  overall_cefr: Cefr; reading_correct: number; reading_total: number; reading_cefr: Cefr; writing: WritingScore;
};

const T = {
  en: {
    start: "Start placement test", starting: "Building your test…", reading: "Reading", writing: "Writing",
    words: "words", min: "min", submit: "Submit for scoring", scoring: "Scoring your writing…",
    yourLevel: "Your indicative level", overall: "Overall", readingScore: "Reading", writingScore: "Writing",
    feedback: "Examiner feedback", startOver: "Start over", correct: "correct",
    crit: { task_achievement: "Task achievement", coherence: "Coherence & cohesion", lexical_range: "Lexical resource", grammar: "Grammar range & accuracy" },
    writeHere: "Write your response here…", pickLang: "Test language", target: "Target",
  },
  ar: {
    start: "ابدأ اختبار تحديد المستوى", starting: "جارٍ إعداد اختبارك…", reading: "القراءة", writing: "الكتابة",
    words: "كلمة", min: "الحد الأدنى", submit: "أرسل للتقييم", scoring: "جارٍ تقييم كتابتك…",
    yourLevel: "مستواك التقريبي", overall: "الإجمالي", readingScore: "القراءة", writingScore: "الكتابة",
    feedback: "ملاحظات المُقيّم", startOver: "ابدأ من جديد", correct: "صحيحة",
    crit: { task_achievement: "تحقيق المهمة", coherence: "الترابط والتماسك", lexical_range: "الثروة اللغوية", grammar: "القواعد ودقتها" },
    writeHere: "اكتب إجابتك هنا…", pickLang: "لغة الاختبار", target: "المستوى المستهدف",
  },
} as const;

const CEFR_TONE: Record<Cefr, string> = {
  A1: "bg-rose-100 text-rose-800 border-rose-300",
  A2: "bg-amber-100 text-amber-800 border-amber-300",
  B1: "bg-sky-100 text-sky-800 border-sky-300",
  B2: "bg-blue-100 text-blue-800 border-blue-300",
  C1: "bg-emerald-100 text-emerald-800 border-emerald-300",
  C2: "bg-emerald-200 text-emerald-900 border-emerald-400",
};

export function FluentClient() {
  const [language, setLanguage] = useState<Language>("en");
  const [phase, setPhase] = useState<"intro" | "test" | "result">("intro");
  const [test, setTest] = useState<FluentTest | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [writing, setWriting] = useState("");
  const [result, setResult] = useState<FluentResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const t = T[language];
  const rtl = language === "ar";

  async function start() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ac/fluent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", language }),
      });
      const data = (await res.json()) as FluentTest;
      setTest(data); setAnswers({}); setWriting(""); setResult(null); setPhase("test");
    } catch {
      setError("Could not build the test. Please try again.");
    } finally { setBusy(false); }
  }

  async function submit() {
    if (!test) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ac/fluent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "score", language,
          reading: test.reading, answers, writingTask: test.writing, writingResponse: writing,
        }),
      });
      const data = (await res.json()) as FluentResult;
      setResult(data); setPhase("result");
    } catch {
      setError("Scoring failed. Please try again.");
    } finally { setBusy(false); }
  }

  function reset() {
    setPhase("intro"); setTest(null); setAnswers({}); setWriting(""); setResult(null); setError("");
  }

  const wordCount = writing.trim() ? writing.trim().split(/\s+/).length : 0;
  const allAnswered = test ? test.reading.every((r) => answers[r.id] != null) : false;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="space-y-5">
      {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {/* ── Intro ── */}
      {phase === "intro" && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">{t.pickLang}:</span>
            <div className="inline-flex overflow-hidden rounded-md border border-slate-300">
              {(["en", "ar"] as const).map((l) => (
                <button key={l} onClick={() => setLanguage(l)}
                  className={`px-3 py-1.5 text-sm font-medium ${language === l ? "bg-[#5391D5] text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                  {l === "en" ? "English" : "العربية"}
                </button>
              ))}
            </div>
          </div>
          <button onClick={start} disabled={busy}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#010131] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#121140] disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? t.starting : t.start}
          </button>
        </div>
      )}

      {/* ── Test ── */}
      {phase === "test" && test && (
        <>
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-4 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <BookOpen className="h-5 w-5 text-[#5391D5]" /> {t.reading}
            </h2>
            <div className="space-y-5">
              {test.reading.map((item, i) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-4">
                  <p dir="ltr" className="text-sm text-[#111232]">{item.passage}</p>
                  <p dir="ltr" className="mt-2 text-sm font-semibold text-[#010131]">{i + 1}. {item.question}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2" dir="ltr">
                    {item.options.map((opt, oi) => (
                      <label key={oi} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                        answers[item.id] === oi ? "border-[#5391D5] bg-[#5391D5]/5" : "border-slate-200 hover:bg-slate-50"
                      }`}>
                        <input type="radio" name={item.id} checked={answers[item.id] === oi}
                          onChange={() => setAnswers((a) => ({ ...a, [item.id]: oi }))}
                          className="accent-[#5391D5]" />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="mb-3 inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <PenLine className="h-5 w-5 text-[#5391D5]" /> {t.writing}
              <span className="ms-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                {t.target} {test.writing.cefr_target}
              </span>
            </h2>
            <p dir="ltr" className="text-sm text-[#111232]">{test.writing.prompt_en}</p>
            {rtl && test.writing.prompt_ar && (
              <p dir="rtl" className="mt-1 text-sm text-slate-600">{test.writing.prompt_ar}</p>
            )}
            <textarea value={writing} onChange={(e) => setWriting(e.target.value)} rows={7}
              placeholder={t.writeHere} dir="ltr"
              className="mt-3 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm text-[#111232] focus:border-[#5391D5] focus:outline-none" />
            <div className="mt-1 text-[11px] text-slate-500">
              {wordCount} {t.words} · {t.min} {test.writing.min_words}
            </div>
          </section>

          <button onClick={submit} disabled={busy || !allAnswered || wordCount < 5}
            className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {busy ? t.scoring : t.submit}
          </button>
        </>
      )}

      {/* ── Result ── */}
      {phase === "result" && result && (
        <div className="rounded-xl border bg-white p-6 shadow-sm space-y-5">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">{t.yourLevel}</p>
              <div className={`mt-1 inline-flex items-center justify-center rounded-xl border-2 px-5 py-3 text-4xl font-bold ${CEFR_TONE[result.overall_cefr]}`}>
                {result.overall_cefr}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="rounded-md border bg-muted/20 p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{t.readingScore}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">{result.reading_correct}/{result.reading_total}</p>
                <p className="text-[10px] text-slate-500">{result.reading_cefr} · {result.reading_correct} {t.correct}</p>
              </div>
              <div className="rounded-md border bg-muted/20 p-3 text-center">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">{t.writingScore}</p>
                <p className={`mt-1 inline-block rounded-md border px-2 text-lg font-bold ${CEFR_TONE[result.writing.cefr]}`}>{result.writing.cefr}</p>
              </div>
            </div>
          </div>

          {/* Writing criteria */}
          <div className="space-y-2">
            {(["task_achievement", "coherence", "lexical_range", "grammar"] as const).map((k) => {
              const v = result.writing[k];
              return (
                <div key={k} className="flex items-center gap-3 text-xs">
                  <span className="w-44 shrink-0">{t.crit[k]}</span>
                  <div className="flex flex-1 gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`h-2 flex-1 rounded-full ${n <= v ? "bg-[#5391D5]" : "bg-slate-200"}`} />
                    ))}
                  </div>
                  <span className="w-8 shrink-0 text-right tabular-nums text-slate-500">{v}/5</span>
                </div>
              );
            })}
          </div>

          {/* Feedback */}
          <div className="rounded-md border border-[#5391D5]/30 bg-[#5391D5]/5 p-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#5391D5]">{t.feedback}</p>
            <p dir="ltr" className="text-sm leading-relaxed text-[#111232]">{result.writing.feedback_en}</p>
            {rtl && result.writing.feedback_ar && (
              <p dir="rtl" className="mt-2 text-sm leading-relaxed text-[#111232]">{result.writing.feedback_ar}</p>
            )}
            {!result.writing.ai_generated && (
              <p className="mt-1 text-[10px] text-amber-600">fallback score (no AI key)</p>
            )}
          </div>

          <button onClick={reset}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <RotateCcw className="h-4 w-4" /> {t.startOver}
          </button>
        </div>
      )}
    </div>
  );
}
