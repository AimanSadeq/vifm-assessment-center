"use client";

import { useState } from "react";
import { Loader2, CheckCircle2, RotateCcw, GraduationCap, AlertCircle, ShieldCheck, ExternalLink } from "lucide-react";
import { TECH_DOMAINS, TECH_LEVELS } from "@/lib/competencies/technical-framework";
import type { PublicTechTest, TechResult } from "@/lib/ai/technical-assessment";

type Phase = "intro" | "test" | "result";

// The score response augments TechResult with the certification outcome.
type ScoredResult = TechResult & {
  passedCut?: boolean | null;
  cutPct?: number | null;
  credentialCode?: string | null;
};

const LEVEL_TONE: Record<number, string> = {
  1: "bg-rose-100 text-rose-800 border-rose-300",
  2: "bg-amber-100 text-amber-800 border-amber-300",
  3: "bg-sky-100 text-sky-800 border-sky-300",
  4: "bg-blue-100 text-blue-800 border-blue-300",
  5: "bg-emerald-100 text-emerald-800 border-emerald-300",
};

export function TechAssessmentClient() {
  const [phase, setPhase] = useState<Phase>("intro");
  const [domainKey, setDomainKey] = useState<string>("");
  const [test, setTest] = useState<PublicTechTest | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<ScoredResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start(key: string) {
    setBusy(true);
    setError("");
    setDomainKey(key);
    try {
      const res = await fetch("/api/ac/tech-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", domainKey: key }),
      });
      const raw = (await res.json()) as PublicTechTest & { session_id?: string };
      setSessionId(raw.session_id ?? null);
      setTest(raw);
      setAnswers({});
      setResult(null);
      setPhase("test");
    } catch {
      setError("Couldn't build the assessment. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!test) return;
    setBusy(true);
    setError("");
    try {
      const payload = sessionId
        ? { action: "score", sessionId, answers }
        : { action: "score", domainKey: test.domain_key, domainName: test.domain_name, items: test.items, aiGenerated: test.ai_generated, answers };
      const res = await fetch("/api/ac/tech-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as ScoredResult;
      setResult(data);
      setPhase("result");
    } catch {
      setError("Scoring failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhase("intro");
    setTest(null);
    setSessionId(null);
    setAnswers({});
    setResult(null);
    setDomainKey("");
    setError("");
  }

  const allAnswered = !!test && test.items.length > 0 && test.items.every((i) => answers[i.id] != null);

  return (
    <div className="space-y-5">
      {error && <div className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

      {phase === "intro" && (
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#010131]">Choose a technical domain</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A short, indicative assessment of your technical proficiency in one domain. About 8 questions.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TECH_DOMAINS.map((d) => (
              <button
                key={d.key}
                onClick={() => start(d.key)}
                disabled={busy}
                className="flex flex-col gap-1 rounded-xl border border-slate-200 p-4 text-start transition-colors hover:border-[#5391D5] hover:bg-[#5391D5]/5 disabled:opacity-60"
              >
                <span className="font-semibold text-[#010131]">{d.name}</span>
                <span className="text-[11px] leading-snug text-muted-foreground">{d.skills.slice(0, 3).join(" · ")}…</span>
              </button>
            ))}
          </div>
          {busy && (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Building your assessment…
            </p>
          )}
        </div>
      )}

      {phase === "test" && test && (
        <>
          <div className="rounded-xl border bg-white p-5 shadow-sm">
            <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-[#010131]">
              <GraduationCap className="h-5 w-5 text-[#5391D5]" /> {test.domain_name}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Answer all {test.items.length} questions. Your answer key is graded on the server.
            </p>
          </div>
          {test.items.map((item, i) => (
            <section key={item.id} className="rounded-xl border bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {item.skill}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-slate-400">{item.difficulty}</span>
              </div>
              <p className="text-sm font-semibold text-[#010131]">{i + 1}. {item.question}</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {item.options.map((opt, oi) => (
                  <label
                    key={oi}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                      answers[item.id] === oi ? "border-[#5391D5] bg-[#5391D5]/5" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={item.id}
                      checked={answers[item.id] === oi}
                      onChange={() => setAnswers((a) => ({ ...a, [item.id]: oi }))}
                      className="accent-[#5391D5]"
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </section>
          ))}
          <button
            onClick={submit}
            disabled={busy || !allAnswered}
            className="inline-flex items-center gap-2 rounded-md bg-[#047857] px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {busy ? "Scoring…" : "Submit for scoring"}
          </button>
        </>
      )}

      {phase === "result" && result && (
        <div className="space-y-5 rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">
                {result.certified ? "Certified proficiency" : "Indicative proficiency"} · {result.domain_name}
              </p>
              <div className={`mt-1 inline-flex items-center justify-center rounded-xl border-2 px-5 py-3 text-2xl font-bold ${LEVEL_TONE[result.proficiency.level]}`}>
                {result.proficiency.level}/5 · {result.proficiency.label}
              </div>
            </div>
            <div className="rounded-md border bg-muted/20 p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Score</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{result.correct}/{result.total}</p>
              <p className="text-[10px] text-slate-500">{result.pct}%</p>
            </div>
          </div>

          {/* Certified outcome: credential issued, or below the cut-score. */}
          {result.certified && result.passedCut && result.credentialCode && (
            <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800">
                <ShieldCheck className="h-4 w-4" /> Technical Proficiency credential issued
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                You scored {result.pct}%, at or above the {result.cutPct}% cut-score for this domain. Your
                credential is verifiable below.
              </p>
              <a
                href={`/verify/${result.credentialCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
              >
                <ExternalLink className="h-3.5 w-3.5" /> View &amp; verify credential
              </a>
            </div>
          )}
          {result.certified && result.passedCut === false && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-rose-800">
                <AlertCircle className="h-4 w-4" /> Below the certification cut-score
              </p>
              <p className="mt-1 text-xs text-rose-700">
                You scored {result.pct}%. This domain certifies at {result.cutPct}%. Keep developing and
                re-take the certified assessment — no credential is issued below the standard.
              </p>
            </div>
          )}

          {/* Per-skill breakdown */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">By skill</p>
            <div className="space-y-1.5">
              {result.perSkill.map((s) => (
                <div key={s.skill} className="flex items-center gap-3 text-xs">
                  <span className="w-56 shrink-0 truncate">{s.skill}</span>
                  <div className="flex flex-1 gap-1">
                    {Array.from({ length: s.total }).map((_, n) => (
                      <span key={n} className={`h-2 flex-1 rounded-full ${n < s.correct ? "bg-[#5391D5]" : "bg-slate-200"}`} />
                    ))}
                  </div>
                  <span className="w-10 shrink-0 text-right tabular-nums text-slate-500">{s.correct}/{s.total}</span>
                </div>
              ))}
            </div>
          </div>

          {result.certified ? (
            <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
              <span>
                Certified assessment. Every item was reviewed and approved by a subject-matter expert and scored
                against a documented cut-score, server-side. A credential is issued only at or above the standard.
                Levels: {TECH_LEVELS.join(" · ")}.
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Indicative only. This short, {result.ai_generated ? "AI-authored" : "placeholder"} assessment signals technical
                proficiency for development — it is not a certified qualification and issues no credential. Items should be
                human-reviewed and calibrated before any high-stakes use. Levels: {TECH_LEVELS.join(" · ")}.
              </span>
            </div>
          )}

          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" /> Assess another domain
          </button>
        </div>
      )}
    </div>
  );
}
