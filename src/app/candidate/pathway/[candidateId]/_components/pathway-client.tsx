"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2, Sparkles, Route, Flag, Target, GraduationCap, RotateCcw, CheckCircle2, Clock,
} from "lucide-react";

type Lang = "en" | "ar";

type Stage = {
  order: number;
  title_en: string; title_ar: string | null;
  focus: string[];
  course_codes: string[];
  rationale_en: string; rationale_ar: string | null;
  milestone_en: string; milestone_ar: string | null;
  outcome_en: string; outcome_ar: string | null;
  estimated_weeks: number;
};
type CourseLite = { code: string | null; title_en: string; title_ar: string | null };
type Pathway = {
  summary_en: string; summary_ar: string | null;
  horizon_weeks: number;
  stages: Stage[];
  ai_generated: boolean;
  on_track: boolean;
  courses?: CourseLite[];
};

const T = {
  en: {
    intro: "Turn your assessed gaps into a sequenced, course-by-course plan. Our AI orders your VIFM courses foundation-first and explains each step.",
    generate: "Generate my pathway", generating: "Designing your pathway…", regenerate: "Regenerate",
    summary: "Overview", horizon: "Total horizon", weeks: "weeks", stage: "Stage",
    focus: "Focus areas", courses: "VIFM courses", rationale: "Why this, now", milestone: "Milestone", outcome: "Target outcome",
    aiBadge: "AI-designed", fallbackBadge: "template (no AI key)",
    onTrackTitle: "You're on track", noCourses: "No VIFM courses are mapped to your current gaps yet — check back after your next assessment.",
    failed: "Could not generate the pathway. Please try again.",
  },
  ar: {
    intro: "حوّل فجواتك المُقيّمة إلى خطة متسلسلة دورة تلو الأخرى. يرتّب الذكاء الاصطناعي دورات VIFM بدءًا من الأساسيات ويشرح كل خطوة.",
    generate: "أنشئ مساري", generating: "جارٍ تصميم مسارك…", regenerate: "إعادة الإنشاء",
    summary: "نظرة عامة", horizon: "المدة الإجمالية", weeks: "أسبوع", stage: "المرحلة",
    focus: "مجالات التركيز", courses: "دورات VIFM", rationale: "لماذا الآن", milestone: "محطة الإنجاز", outcome: "النتيجة المستهدفة",
    aiBadge: "من تصميم الذكاء الاصطناعي", fallbackBadge: "قالب (بدون مفتاح ذكاء اصطناعي)",
    onTrackTitle: "أنت على المسار الصحيح", noCourses: "لا توجد دورات VIFM مرتبطة بفجواتك الحالية بعد — راجع لاحقًا بعد تقييمك التالي.",
    failed: "تعذّر إنشاء المسار. حاول مرة أخرى.",
  },
} as const;

export function PathwayClient({
  candidateId, lang,
}: {
  candidateId: string;
  lang: Lang;
  candidateName: string;
}) {
  const [busy, setBusy] = useState(false);
  const [pathway, setPathway] = useState<Pathway | null>(null);
  const [error, setError] = useState("");

  const t = T[lang];
  const rtl = lang === "ar";
  const L = (en: string, ar: string | null) => (rtl && ar ? ar : en);

  // Resolve a stage's course_codes (codes OR titles) back to catalogue entries.
  const courseByRef = useMemo(() => {
    const m = new Map<string, CourseLite>();
    for (const c of pathway?.courses ?? []) {
      if (c.code) m.set(c.code, c);
      m.set(c.title_en, c);
    }
    return m;
  }, [pathway]);

  async function generate() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ac/pathway", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, language: lang }),
      });
      const data = (await res.json()) as Pathway;
      setPathway(data);
    } catch {
      setError(t.failed);
    } finally { setBusy(false); }
  }

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="space-y-5">
      {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {/* Intro / generate */}
      {!pathway && (
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Route className="mt-0.5 h-6 w-6 shrink-0 text-[#5391D5]" />
            <p className="text-sm text-muted-foreground">{t.intro}</p>
          </div>
          <button onClick={generate} disabled={busy}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#010131] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#121140] disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? t.generating : t.generate}
          </button>
        </div>
      )}

      {/* On-track */}
      {pathway?.on_track && (
        <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
          <p className="mt-2 font-semibold text-[#010131]">{t.onTrackTitle}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{L(pathway.summary_en, pathway.summary_ar)}</p>
        </div>
      )}

      {/* Pathway */}
      {pathway && !pathway.on_track && (
        <>
          {/* Summary header */}
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#5391D5]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#5391D5]">
                <Sparkles className="h-3 w-3" /> {pathway.ai_generated ? t.aiBadge : t.fallbackBadge}
              </span>
              {pathway.horizon_weeks > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
                  <Clock className="h-3 w-3" /> {t.horizon}: {pathway.horizon_weeks} {t.weeks}
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-[#111232]">{L(pathway.summary_en, pathway.summary_ar)}</p>
          </div>

          {pathway.stages.length === 0 && (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground shadow-sm">{t.noCourses}</div>
          )}

          {/* Stage timeline */}
          <div className="space-y-4">
            {pathway.stages.map((s) => (
              <div key={s.order} className="relative rounded-xl border bg-card p-5 shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#010131] text-sm font-bold text-white">
                    {s.order}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-[#010131]">{L(s.title_en, s.title_ar)}</h3>
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                        <Clock className="h-3 w-3" /> ~{s.estimated_weeks} {t.weeks}
                      </span>
                    </div>

                    {/* Focus chips */}
                    {s.focus.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="text-[11px] font-medium text-slate-400">{t.focus}:</span>
                        {s.focus.map((f) => (
                          <span key={f} className="rounded-full border border-[#5391D5]/30 bg-[#5391D5]/5 px-2 py-0.5 text-[11px] text-[#2d5f96]">{f}</span>
                        ))}
                      </div>
                    )}

                    {/* Courses */}
                    {s.course_codes.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                          <GraduationCap className="h-3.5 w-3.5" /> {t.courses}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {s.course_codes.map((ref) => {
                            const c = courseByRef.get(ref);
                            const label = c ? L(c.title_en, c.title_ar) : ref;
                            const code = c?.code ?? null;
                            return code ? (
                              <Link key={ref} href={`/courses/${code}`} target="_blank"
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-[#010131] hover:border-[#5391D5] hover:text-[#5391D5]">
                                {label}
                              </Link>
                            ) : (
                              <span key={ref} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600">
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Rationale / milestone / outcome */}
                    <div className="mt-3 space-y-2 text-sm">
                      <p className="text-[#111232]"><span className="font-semibold text-slate-500">{t.rationale}: </span>{L(s.rationale_en, s.rationale_ar)}</p>
                      <p className="flex items-start gap-1.5 text-[#111232]"><Flag className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" /><span><span className="font-semibold text-slate-500">{t.milestone}: </span>{L(s.milestone_en, s.milestone_ar)}</span></p>
                      <p className="flex items-start gap-1.5 text-[#111232]"><Target className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /><span><span className="font-semibold text-slate-500">{t.outcome}: </span>{L(s.outcome_en, s.outcome_ar)}</span></p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Regenerate */}
          <button onClick={generate} disabled={busy}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            {busy ? t.generating : t.regenerate}
          </button>
        </>
      )}
    </div>
  );
}
