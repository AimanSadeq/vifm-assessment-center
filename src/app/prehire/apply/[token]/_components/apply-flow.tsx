"use client";

import { useState } from "react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
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

export function ApplyFlow({ token, ctx }: { token: string; ctx: PrehireCandidateContext }) {
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
  const stepIndex = current ? stageKinds.indexOf(current) + 1 : stageKinds.length;

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
          {agreed && stageKinds.length > 0 && !allDone && (
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
                are reviewed by a person — no decision is made automatically.
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

        {/* Active interactive stage */}
        {agreed && current === "quiz" && (
          <QuizStage key="quiz" token={token} onDone={() => markDone("quiz")} />
        )}
        {agreed && current === "cbi" && (
          <CbiStage key="cbi" token={token} onDone={() => markDone("cbi")} />
        )}
        {agreed && current === "fluent" && (
          <FluentStage key="fluent" token={token} onDone={() => markDone("fluent")} />
        )}

        {/* All stages complete */}
        {allDone && (
          <>
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
            {!ctx.candidate.demographics_submitted_at && !demoDone && (
              <DemographicsCard token={token} onDone={() => setDemoDone(true)} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
