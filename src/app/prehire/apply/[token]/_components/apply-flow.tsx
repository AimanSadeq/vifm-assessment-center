"use client";

import { useState, useEffect } from "react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import type { PrehireCandidateContext } from "@/lib/prehire/candidate-access";
import type { PrehireStageKind } from "@/types/prehire";
import { QuizStage } from "./quiz-stage";
import { CbiStage } from "./cbi-stage";
import { FluentStage } from "./fluent-stage";
import { DemographicsCard } from "./demographics-card";

// Stages with an interactive candidate-facing UI in this flow, rendered in the
// order the requisition configures them. (assessment_center is run elsewhere and
// is not part of the self-served apply flow yet.)
const INTERACTIVE: PrehireStageKind[] = ["quiz", "cbi", "fluent"];

type DemoResult = {
  composite: number | null;
  recommendation: string;
  perStage: { kind: string; normalized: number | null; passed: boolean | null; cutScore: number | null }[];
};

const REC_LABEL: Record<string, string> = { advance: "Advance", review: "Review", hold: "Hold", incomplete: "Incomplete" };
const REC_TONE: Record<string, string> = {
  advance: "bg-emerald-100 text-emerald-800",
  review: "bg-sky-100 text-sky-800",
  hold: "bg-amber-100 text-amber-800",
  incomplete: "bg-slate-100 text-slate-700",
};
const STAGE_LABEL: Record<string, string> = { quiz: "Competency quiz", fluent: "English placement", cbi: "Behavioural interview" };

export function ApplyFlow({ token, ctx, demo = false }: { token: string; ctx: PrehireCandidateContext; demo?: boolean }) {
  // The interactive stages this requisition asks for, in configured order.
  const stageKinds = ctx.requisition.stage_config
    .map((s) => s.kind)
    .filter((k) => INTERACTIVE.includes(k));

  const completedInit = new Set<PrehireStageKind>(
    ctx.stages.filter((s) => s.status === "completed").map((s) => s.kind)
  );

  const [agreed, setAgreed] = useState(!!ctx.candidate.consent_at);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Set<PrehireStageKind>>(completedInit);
  const [demoDone, setDemoDone] = useState(false);
  const [demoResult, setDemoResult] = useState<DemoResult | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);

  const consent = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/prehire/${token}/consent`, { method: "POST" });
    setBusy(false);
    if (!r.ok) return setError("Something went wrong. Please try again.");
    setAgreed(true);
  };

  const markDone = (k: PrehireStageKind) => setDone((prev) => new Set(prev).add(k));

  // First not-yet-done interactive stage drives what we render.
  const current = stageKinds.find((k) => !done.has(k)) ?? null;
  const allDone = agreed && current === null;

  // Demo only: once every stage is done, pull the composite + per-stage scores
  // so the completion screen shows results on-screen (mirrors the Techno demo).
  useEffect(() => {
    if (!demo || !allDone || demoResult || loadingResult) return;
    setLoadingResult(true);
    fetch(`/api/prehire/${token}/result`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ok) setDemoResult({ composite: d.composite, recommendation: d.recommendation, perStage: d.perStage });
      })
      .finally(() => setLoadingResult(false));
  }, [demo, allDone, demoResult, loadingResult, token]);
  const stepIndex = current ? stageKinds.indexOf(current) + 1 : stageKinds.length;
  // Voluntary equal-opportunity monitoring runs once, AFTER consent and BEFORE
  // the first assessment (decoupled from scoring). Skip + submit both clear it.
  const demoComplete = !!ctx.candidate.demographics_submitted_at || demoDone;

  return (
    <div className="min-h-screen bg-[#F5F7FA]" dir="ltr">
      <header className="bg-[#010131] px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <VifmLogo variant="white" size="sm" />
          <span className="text-xs text-white/60">Pre-employment screening</span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold text-[#010131]">{ctx.requisition.title}</h1>
          <p className="text-sm text-muted-foreground">
            {ctx.requisition.clientName ? `${ctx.requisition.clientName} · ` : ""}
            Hi {ctx.candidate.full_name.split(" ")[0]}, welcome.
          </p>
          {agreed && demoComplete && stageKinds.length > 0 && !allDone && (
            <p className="mt-2 text-xs font-medium text-[#5391D5]">
              Step {stepIndex} of {stageKinds.length}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        {/* Consent gate */}
        {!agreed && (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <h2 className="font-semibold text-[#010131]">Consent &amp; data processing</h2>
              <p className="text-sm text-muted-foreground">
                As part of this application you&apos;ll complete a short assessment. Your responses
                and results are processed by VIFM on behalf of{" "}
                {ctx.requisition.clientName ?? "the hiring organization"} for the sole purpose of
                evaluating your application, in line with applicable data-protection law. Results
                are reviewed by a person - no decision is made automatically.
              </p>
              <div className="flex items-start gap-3">
                <Checkbox id="agree" checked={agree} onCheckedChange={(c) => setAgree(c === true)} />
                <label htmlFor="agree" className="text-sm leading-relaxed">
                  I consent to VIFM processing my assessment data for this application.
                </label>
              </div>
              <Button onClick={consent} disabled={!agree || busy} className="w-full">
                {busy ? "…" : "Agree & continue"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Voluntary equal-opportunity monitoring - BEFORE the assessment */}
        {agreed && !demoComplete && (
          <DemographicsCard token={token} onDone={() => setDemoDone(true)} />
        )}

        {/* Active interactive stage (after consent + the demographics step) */}
        {agreed && demoComplete && current === "quiz" && (
          <QuizStage key="quiz" token={token} onDone={() => markDone("quiz")} />
        )}
        {agreed && demoComplete && current === "cbi" && (
          <CbiStage key="cbi" token={token} onDone={() => markDone("cbi")} />
        )}
        {agreed && demoComplete && current === "fluent" && (
          <FluentStage key="fluent" token={token} onDone={() => markDone("fluent")} />
        )}

        {/* All stages complete - real screening: a thank-you only (the candidate
            never sees their own screening result). */}
        {allDone && demoComplete && !demo && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-[#00843D]" />
              <h2 className="text-lg font-semibold text-[#010131]">Thank you</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Your responses have been submitted. The hiring team will review them and be in
                touch.
              </p>
            </CardContent>
          </Card>
        )}

        {/* DEMO: show results on-screen + a report download (mirrors the Techno demo). */}
        {allDone && demoComplete && demo && (
          <Card>
            <CardContent className="space-y-5 py-8">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-[#00843D]" />
                <h2 className="text-lg font-semibold text-[#010131]">Screening complete</h2>
              </div>

              {!demoResult ? (
                <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Scoring your responses…
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-5">
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Composite signal</div>
                      <div className="mt-1 text-3xl font-bold tabular-nums text-[#010131]">
                        {demoResult.composite ?? "-"}
                        <span className="text-base font-normal text-slate-400">/100</span>
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${REC_TONE[demoResult.recommendation] ?? REC_TONE.incomplete}`}>
                      {REC_LABEL[demoResult.recommendation] ?? demoResult.recommendation}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {demoResult.perStage.map((s) => (
                      <div key={s.kind} className="flex items-center gap-3 text-xs">
                        <span className="w-40 shrink-0 font-medium text-[#010131]">{STAGE_LABEL[s.kind] ?? s.kind}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-[#5391D5]" style={{ width: `${Math.max(0, Math.min(100, s.normalized ?? 0))}%` }} />
                        </div>
                        <span className="w-10 shrink-0 text-right tabular-nums text-slate-600">
                          {s.normalized != null ? Math.round(s.normalized) : "-"}
                        </span>
                        {s.passed != null && (
                          <span className={`w-12 shrink-0 text-right text-[10px] font-semibold ${s.passed ? "text-emerald-600" : "text-amber-600"}`}>
                            {s.passed ? "Pass" : "Below"}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <a
                    href={`/api/prehire/${token}/report`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md bg-[#010131] px-4 py-2 text-sm font-semibold text-white hover:bg-[#121140]"
                  >
                    <Download className="h-4 w-4" /> Download report (PDF)
                  </a>

                  <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-relaxed text-amber-800">
                    Demo view. In a real screening the composite is an advisory signal only - a person always
                    decides - and the report is delivered to the hiring team, not shown to the candidate.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
