"use client";

import { useState } from "react";
import Link from "next/link";
import { BrainCircuit, Sparkles, Loader2, CheckCircle2, RotateCcw, AlertTriangle, Download, Layers, ArrowRight } from "lucide-react";
import type { PsyTestPublic, PsyResult, ScaleScore } from "@/lib/psychometrics/scoring";
import { COGNITIVE_SUBTESTS } from "@/lib/psychometrics/framework";

type Lang = "en" | "ar";

const BAND_TONE: Record<string, string> = {
  low: "bg-rose-100 text-rose-800",
  below: "bg-amber-100 text-amber-800",
  average: "bg-sky-100 text-sky-800",
  above: "bg-emerald-100 text-emerald-800",
  high: "bg-emerald-200 text-emerald-900",
};

const scaleName = (key: string): string =>
  COGNITIVE_SUBTESTS.find((s) => s.key === key)?.name_en ?? key;
const scaleDesc = (key: string): string =>
  COGNITIVE_SUBTESTS.find((s) => s.key === key)?.desc_en ?? "";

export function PsychometricsClient({
  candidateId, engagementId,
}: {
  candidateId: string | null;
  engagementId: string | null;
}) {
  const [phase, setPhase] = useState<"intro" | "test" | "result">("intro");
  const [lang, setLang] = useState<Lang>("en");
  const [takerName, setTakerName] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [test, setTest] = useState<PsyTestPublic | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<PsyResult | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const start = async () => {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ac/psychometrics", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", language: lang, candidateId, engagementId, takerEmail: null }),
      });
      const d = await res.json();
      if (!res.ok || !d.test) { setError(d.error || "Could not start."); return; }
      setSessionId(d.session_id); setTest(d.test as PsyTestPublic); setAnswers({}); setResult(null); setResultId(null); setPhase("test");
    } catch { setError("Could not start."); } finally { setBusy(false); }
  };

  const submit = async () => {
    if (!test || !sessionId) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/ac/psychometrics", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "score", session_id: sessionId, answers, takerName: takerName.trim() || null, language: lang }),
      });
      const d = await res.json();
      if (!res.ok || !d.result) { setError(d.error || "Could not score."); return; }
      setResult(d.result as PsyResult); setResultId(d.result_id ?? null); setPhase("result");
    } catch { setError("Could not score."); } finally { setBusy(false); }
  };

  const reset = () => { setPhase("intro"); setTest(null); setSessionId(null); setAnswers({}); setResult(null); setResultId(null); setError(""); };

  const total = test ? test.items.length : 0;
  const answered = Object.keys(answers).length;
  const canSubmit = total > 0 && answered === total && !busy;

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="space-y-5">
      <div>
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-[#010131]">
          <BrainCircuit className="h-6 w-6 text-[#5391D5]" /> Psychometrics
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cognitive ability — <strong>indicative</strong> developmental insight, not a norm-referenced or high-stakes score.
          The behavioural instrument is <strong>Persona</strong> (the 38-competency self-assessment).
        </p>
      </div>

      {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {phase === "intro" && (
        <>
        <div className="space-y-5 rounded-xl border bg-card p-6">
          <div className="rounded-lg border border-[#5391D5] bg-[#5391D5]/5 p-4">
            <p className="font-semibold text-[#010131]">Cognitive ability</p>
            <p className="mt-1 text-xs text-muted-foreground">Numerical · verbal · abstract reasoning (timed-style MCQs).</p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex-1 min-w-[12rem]">
              <span className="text-xs font-medium text-slate-500">Your name (optional)</span>
              <input value={takerName} onChange={(e) => setTakerName(e.target.value)} dir="ltr"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. Sara Al Mansoori" />
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-400">Language</span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
                {(["en", "ar"] as Lang[]).map((l) => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium ${lang === l ? "bg-[#5391D5] text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                    {l === "en" ? "English" : "العربية"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={start} disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-[#010131] px-6 py-3 text-sm font-semibold text-white hover:bg-[#121140] disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Preparing…" : "Begin cognitive assessment"}
          </button>
        </div>

        {/* Persona - the behavioural competency self-assessment (38 competencies). */}
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-start gap-3">
            <Layers className="mt-0.5 h-5 w-5 shrink-0 text-[#5391D5]" />
            <div className="min-w-0">
              <p className="font-semibold text-[#010131]">Persona — Behavioural Competency Self-Assessment</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Self-ratings across the 38 competencies (the same framework as the Reflect 360). Feeds the
                succession readiness engine as the &ldquo;self&rdquo; view.
              </p>
            </div>
          </div>
          {candidateId ? (
            <Link href={`/candidate/behavioral/${candidateId}`}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#010131] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#121140]">
              Open Persona <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <p className="mt-4 text-xs text-amber-600">Open this page from a candidate to run Persona (it records against that candidate).</p>
          )}
        </div>
        </>
      )}

      {phase === "test" && test && (
        <div className="space-y-4">
          {test.kind === "cognitive"
            ? test.items.map((item, i) => (
                <section key={item.id} className="rounded-lg border bg-white p-4">
                  <p className="text-sm font-semibold text-[#010131]">{i + 1}. {item.stem}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {item.options.map((opt, oi) => (
                      <label key={oi} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${answers[item.id] === oi ? "border-[#5391D5] bg-[#5391D5]/5" : "border-slate-200 hover:bg-slate-50"}`}>
                        <input type="radio" name={item.id} checked={answers[item.id] === oi}
                          onChange={() => setAnswers((a) => ({ ...a, [item.id]: oi }))} className="accent-[#5391D5]" />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </section>
              ))
            : null}

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{answered}/{total} answered</span>
            <button onClick={submit} disabled={!canSubmit}
              className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {busy ? "Scoring…" : "Submit"}
            </button>
          </div>
        </div>
      )}

      {phase === "result" && result && (
        <div className="space-y-5 rounded-xl border bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {takerName.trim()
              ? <p className="text-sm text-slate-500">Result for <span className="font-semibold text-[#010131]">{takerName.trim()}</span></p>
              : <span />}
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${result.tier === "calibrated" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
              {result.tier === "calibrated" ? "Tier 2 · Norm-referenced" : "Tier 1 · Indicative"}
            </span>
          </div>

          {result.overall && (
            <div className="flex items-center gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-500">Overall (general ability)</p>
                <span className={`mt-1 inline-block rounded-lg px-4 py-2 text-2xl font-bold ${BAND_TONE[result.overall.band]}`}>{result.overall.bandLabel}</span>
                {result.overall.percentile != null && (
                  <span className="ms-2 text-sm font-medium text-slate-500">{Math.round(result.overall.percentile)}th percentile</span>
                )}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {result.scales.map((s: ScaleScore) => (
              <div key={s.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-[#010131]">{scaleName(s.key)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BAND_TONE[s.band]}`}>
                    {s.bandLabel}{s.sten ? ` · sten ${s.sten}` : ""}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-slate-100">
                  <div className="h-2 rounded-full bg-[#5391D5]" style={{ width: `${Math.max(4, s.normalized)}%` }} />
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {scaleDesc(s.key)}
                  {s.percentile != null && <span className="font-medium text-[#5391D5]"> · {Math.round(s.percentile)}th percentile</span>}
                </p>
              </div>
            ))}
          </div>

          {result.validity?.flag && (
            <div className="inline-flex items-start gap-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Response-style check: the profile shows {result.validity.socialDesirability >= 4.5 ? "uniformly high self-ratings" : "high inconsistency"} — interpret with care.
            </div>
          )}

          {result.tier === "calibrated" ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <strong>Norm-referenced</strong> result — scored against the VIFM reference group (percentiles + sten). A screening signal to inform a human decision, never an automatic one.
            </p>
          ) : (
            <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              This is an <strong>indicative</strong> result based on raw scores, not local norms or IRT calibration — for development and self-insight, not a standalone hiring decision.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={reset} className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <RotateCcw className="h-4 w-4" /> Start over
            </button>
            {resultId && (
              <a
                href={`/api/ac/psychometrics/${resultId}/report`}
                className="inline-flex items-center gap-2 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e1b4b]"
              >
                <Download className="h-4 w-4" /> Download report (PDF)
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
