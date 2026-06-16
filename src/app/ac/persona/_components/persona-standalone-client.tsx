"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Layers, Sparkles, Loader2, CheckCircle2, RotateCcw, ChevronLeft, ChevronRight, AlertTriangle, Download,
} from "lucide-react";
import type { BehavioralCompetency } from "@/lib/scoring/behavioral-items";
import type { BehavioralProfileRow } from "@/lib/scoring/behavioral";
import { startPersonaAction, savePersonaAnswersAction, submitPersonaAction } from "../actions";
import { personaBand, personaBandLabel, PERSONA_BAND_TW } from "@/lib/scoring/persona-bands";

type Lang = "en" | "ar";
type Phase = "intro" | "test" | "result";

const LIKERT = [1, 2, 3, 4, 5];

export function PersonaStandaloneClient({
  competencies,
  redemptionToken = null,
  prefillName,
}: {
  competencies: BehavioralCompetency[];
  /** Voucher redemption token (delegate flow); stamps the result with the client org. */
  redemptionToken?: string | null;
  prefillName?: string;
}) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [lang, setLang] = useState<Lang>("en");
  const [name, setName] = useState(prefillName ?? "");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [profile, setProfile] = useState<BehavioralProfileRow[] | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saving, startSave] = useTransition();
  const [error, setError] = useState("");

  const ar = lang === "ar";
  const tx = (en: string, arabic: string) => (ar ? arabic : en);

  // One cluster per step.
  const steps = useMemo(() => {
    const byCluster = new Map<number, BehavioralCompetency[]>();
    for (const c of competencies) {
      if (!byCluster.has(c.clusterOrder)) byCluster.set(c.clusterOrder, []);
      byCluster.get(c.clusterOrder)!.push(c);
    }
    return Array.from(byCluster.entries()).sort((a, b) => a[0] - b[0]).map(([order, comps]) => ({ order, comps }));
  }, [competencies]);

  const totalItems = useMemo(() => competencies.reduce((n, c) => n + c.items.length, 0), [competencies]);
  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount >= totalItems;

  const begin = async () => {
    setBusy(true); setError("");
    try {
      const res = await startPersonaAction(name, redemptionToken);
      if (!res.ok) { setError(res.error); return; }
      setSessionId(res.sessionId); setPhase("test"); setStep(0);
    } catch { setError("Could not start the Persona assessment."); } finally { setBusy(false); }
  };

  const answer = (itemKey: string, competencyId: string, isReverse: boolean, value: number) => {
    setAnswers((prev) => ({ ...prev, [itemKey]: value }));
    if (!sessionId) return;
    startSave(async () => {
      await savePersonaAnswersAction(sessionId, [{ itemKey, competencyId, rawScore: value, isReverse }]);
    });
  };

  const submit = async () => {
    if (!sessionId) return;
    setBusy(true); setError("");
    try {
      const res = await submitPersonaAction(sessionId);
      if (!res.ok || !res.profile) { setError(res.error || "Could not score."); return; }
      setProfile(res.profile); setPhase("result");
    } catch { setError("Could not score."); } finally { setBusy(false); }
  };

  const reset = () => {
    setPhase("intro"); setSessionId(null); setAnswers({}); setProfile(null); setStep(0); setError("");
  };

  const likertLabel = (v: number) =>
    ar
      ? ["لا أوافق بشدة", "لا أوافق", "محايد", "أوافق", "أوافق بشدة"][v - 1]
      : ["Strongly disagree", "Disagree", "Neither", "Agree", "Strongly agree"][v - 1];

  return (
    <div dir={ar ? "rtl" : "ltr"} className="space-y-5">
      <div>
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-[#010131]">
          <Layers className="h-6 w-6 text-[#5391D5]" /> {tx("Persona", "بيرسونا")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tx(
            "Behavioural Competency Self-Assessment - self-ratings across the 38 competencies (the same framework as the 360).",
            "التقييم الذاتي للجدارات السلوكية - تقييم ذاتي عبر الكفاءات الـ38 (الإطار نفسه المستخدم في تقييم 360).",
          )}
        </p>
      </div>

      {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {phase === "intro" && (
        <div className="space-y-5 rounded-xl border bg-card p-6">
          <div className="rounded-lg border border-[#5391D5] bg-[#5391D5]/5 p-4">
            <p className="font-semibold text-[#010131]">{tx("Self-assessment", "تقييم ذاتي")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {tx(
                `${totalItems} first-person statements, rated 1-5. Takes about 10 minutes. You get a self-profile across the competency clusters at the end.`,
                `${totalItems} عبارة بصيغة المتكلّم، تُقيَّم من 1 إلى 5. تستغرق نحو 10 دقائق. ستحصل على ملف ذاتي عبر مجموعات الجدارات في النهاية.`,
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="min-w-[12rem] flex-1">
              <span className="text-xs font-medium text-slate-500">{tx("Your name (optional)", "اسمك (اختياري)")}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                dir="ltr"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. Sara Al Mansoori"
              />
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">{tx("Language", "اللغة")}</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
                {(["en", "ar"] as Lang[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${lang === l ? "bg-[#5391D5] text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    {l === "en" ? "English" : "العربية"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={begin}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[#010131] px-6 py-3 text-sm font-semibold text-white hover:bg-[#121140] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? tx("Preparing…", "جارٍ التحضير…") : tx("Begin Persona assessment", "ابدأ تقييم بيرسونا")}
          </button>
          <p className="text-xs text-muted-foreground">
            {tx(
              "Running this for a specific person? Open Persona from a candidate so it feeds Succession Readiness.",
              "تُجري هذا التقييم لشخص محدّد؟ افتح بيرسونا من بطاقة المرشّح كي يغذّي جاهزية التعاقب.",
            )}
          </p>
        </div>
      )}

      {phase === "test" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-[#5391D5]" style={{ width: `${Math.round((answeredCount / totalItems) * 100)}%` }} />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">{answeredCount}/{totalItems}</span>
          </div>

          <p className="text-sm font-semibold text-[#010131]">
            {tx("Section", "القسم")} {steps[step].order} / {steps.length}
            {" · "}
            {ar ? steps[step].comps[0]?.clusterNameAr : steps[step].comps[0]?.clusterNameEn}
          </p>

          {steps[step].comps.map((comp) => (
            <section key={comp.acCompetencyId} className="rounded-lg border bg-white p-4">
              <p className="text-sm font-semibold text-[#010131]">{ar ? comp.nameAr : comp.nameEn}</p>
              <div className="mt-3 space-y-3">
                {comp.items.map((it) => (
                  <div key={it.itemKey} className="space-y-1.5">
                    <p className="text-sm">{ar ? it.textAr : it.textEn}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {LIKERT.map((v) => {
                        const selected = answers[it.itemKey] === v;
                        return (
                          <button
                            key={v}
                            type="button"
                            title={likertLabel(v)}
                            onClick={() => answer(it.itemKey, comp.acCompetencyId, it.reverse, v)}
                            className={`min-w-[2.25rem] rounded-md border px-2.5 py-1.5 text-sm transition ${
                              selected ? "border-[#5391D5] bg-[#5391D5] text-white" : "border-border hover:bg-muted"
                            }`}
                          >
                            {v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div className="flex items-center justify-between gap-3">
            <button
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> {tx("Previous", "السابق")}
            </button>
            <span className="text-[11px] text-muted-foreground">
              {saving ? tx("Saving…", "جارٍ الحفظ…") : tx("Answers save automatically", "تُحفظ الإجابات تلقائيًا")}
            </span>
            {step < steps.length - 1 ? (
              <button
                onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
                className="inline-flex items-center gap-1 rounded-md bg-[#010131] px-4 py-2 text-sm font-semibold text-white hover:bg-[#121140]"
              >
                {tx("Next", "التالي")} <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!allAnswered || busy}
                className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {busy ? tx("Scoring…", "جارٍ التقييم…") : tx("Submit", "إرسال")}
              </button>
            )}
          </div>
          {!allAnswered && step === steps.length - 1 && (
            <p className="flex items-center justify-end gap-1 text-end text-[11px] text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              {tx(
                `Answer all ${totalItems} statements to submit (${totalItems - answeredCount} left).`,
                `أجب عن جميع العبارات (${totalItems}) للإرسال (تبقّى ${totalItems - answeredCount}).`,
              )}
            </p>
          )}
        </div>
      )}

      {phase === "result" && profile && (
        <PersonaResult competencies={competencies} profile={profile} name={name.trim()} ar={ar} onReset={reset} sessionId={sessionId} />
      )}
    </div>
  );
}

function PersonaResult({
  competencies, profile, name, ar, onReset, sessionId,
}: {
  competencies: BehavioralCompetency[];
  profile: BehavioralProfileRow[];
  name: string;
  ar: boolean;
  onReset: () => void;
  sessionId: string | null;
}) {
  const tx = (en: string, arabic: string) => (ar ? arabic : en);
  const scoreById = new Map(profile.map((p) => [p.competencyId, p.selfScore]));

  // Group competencies by cluster, attaching the self score where present.
  const clusters = useMemo(() => {
    const byCluster = new Map<number, { nameEn: string; nameAr: string; rows: { name: string; score: number }[] }>();
    for (const c of competencies) {
      const score = scoreById.get(c.acCompetencyId);
      if (score == null) continue;
      if (!byCluster.has(c.clusterOrder)) byCluster.set(c.clusterOrder, { nameEn: c.clusterNameEn, nameAr: c.clusterNameAr, rows: [] });
      byCluster.get(c.clusterOrder)!.rows.push({ name: ar ? c.nameAr : c.nameEn, score });
    }
    return Array.from(byCluster.entries()).sort((a, b) => a[0] - b[0]).map(([order, v]) => ({ order, ...v }));
  }, [competencies, ar, scoreById]);

  const all = profile.map((p) => p.selfScore);
  const overall = all.length ? Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 100) / 100 : 0;

  return (
    <div className="space-y-5 rounded-xl border bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {name ? (
          <p className="text-sm text-slate-500">{tx("Self-profile for", "الملف الذاتي لـ")} <span className="font-semibold text-[#010131]">{name}</span></p>
        ) : <span />}
        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
          {tx("Self-report · indicative", "تقييم ذاتي · استرشادي")}
        </span>
      </div>

      <div>
        <p className="text-[11px] uppercase tracking-wider text-slate-500">{tx("Overall self-rating", "متوسط التقييم الذاتي")}</p>
        <span className={`mt-1 inline-block rounded-lg px-4 py-2 text-2xl font-bold ${PERSONA_BAND_TW[personaBand(overall).key]}`}>{overall.toFixed(2)} / 5 · {personaBandLabel(overall, ar)}</span>
      </div>

      <div className="space-y-5">
        {clusters.map((cl) => {
          const clAvg = cl.rows.reduce((a, b) => a + b.score, 0) / cl.rows.length;
          return (
            <div key={cl.order}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-[#010131]">{ar ? cl.nameAr : cl.nameEn}</p>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PERSONA_BAND_TW[personaBand(clAvg).key]}`}>{clAvg.toFixed(1)} · {personaBandLabel(clAvg, ar)}</span>
              </div>
              <div className="space-y-2">
                {cl.rows.map((r) => (
                  <div key={r.name}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[#010131]">{r.name}</span>
                      <span className="tabular-nums text-muted-foreground">{r.score.toFixed(1)}</span>
                    </div>
                    <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                      <div className="h-2 rounded-full bg-[#5391D5]" style={{ width: `${(r.score / 5) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        {tx(
          "This is an indicative self-report - how you see yourself across the competencies. To turn it into a readiness verdict, run Persona for a named candidate and pair it with a Reflect 360 (others) against a target role.",
          "هذا تقرير ذاتي استرشادي - كيف ترى نفسك عبر الجدارات. لتحويله إلى حكم على الجاهزية، أجرِ بيرسونا لمرشّح محدّد واقرنه بتقييم ريفلكت 360 (الآخرون) مقابل دور مستهدف.",
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {sessionId && (
          <a
            href={`/api/ac/persona/${sessionId}/report`}
            className="inline-flex items-center gap-2 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:bg-[#121140]"
          >
            <Download className="h-4 w-4" /> {tx("Download PDF", "تنزيل التقرير (PDF)")}
          </a>
        )}
        <button onClick={onReset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          <RotateCcw className="h-4 w-4" /> {tx("Start over", "البدء من جديد")}
        </button>
      </div>
    </div>
  );
}
