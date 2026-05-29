"use client";

import { useState } from "react";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2 } from "lucide-react";
import type { PrehireCandidateContext } from "@/lib/prehire/candidate-access";

type Step = "consent" | "intro" | "quiz" | "done";
type Q = {
  id: string;
  type: string;
  prompt_en: string;
  options_en: string[];
  sequence: (string | number | null)[] | null;
};

export function ApplyFlow({ token, ctx }: { token: string; ctx: PrehireCandidateContext }) {
  const hasQuiz = ctx.requisition.stage_config.some((s) => s.kind === "quiz");
  const quizDone = ctx.stages.find((s) => s.kind === "quiz")?.status === "completed";
  const initial: Step = !ctx.candidate.consent_at ? "consent" : quizDone || !hasQuiz ? "done" : "intro";

  const [step, setStep] = useState<Step>(initial);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const consent = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/prehire/${token}/consent`, { method: "POST" });
    setBusy(false);
    if (!r.ok) return setError("Something went wrong. Please try again.");
    setStep(hasQuiz ? "intro" : "done");
  };

  const startQuiz = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/prehire/${token}/quiz/start`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (d.done) return setStep("done");
    if (!r.ok || !d.questions) return setError(d.error || "Couldn't start the assessment.");
    setQuestions(d.questions as Q[]);
    setStep("quiz");
  };

  const submitQuiz = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/prehire/${token}/quiz/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return setError(d.error || "Couldn't submit your answers.");
    }
    setStep("done");
  };

  const allAnswered = questions.length > 0 && questions.every((q) => typeof answers[q.id] === "number");

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
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
        )}

        {step === "consent" && (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <h2 className="font-semibold text-[#010131]">Consent &amp; data processing</h2>
              <p className="text-sm text-muted-foreground">
                As part of this application you&apos;ll complete a short assessment. Your responses
                and results are processed by VIFM on behalf of {ctx.requisition.clientName ?? "the hiring organization"}
                {" "}for the sole purpose of evaluating your application, in line with applicable data-protection law.
                Results are reviewed by a person — no decision is made automatically.
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

        {step === "intro" && (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <h2 className="font-semibold text-[#010131]">Competency assessment</h2>
              <p className="text-sm text-muted-foreground">
                A short set of questions about the competencies for this role. Answer honestly —
                there are no trick questions. It takes only a few minutes.
              </p>
              <Button onClick={startQuiz} disabled={busy} className="w-full">
                {busy ? "Preparing…" : "Start assessment"}
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "quiz" && (
          <div className="space-y-4">
            {questions.map((q, qi) => (
              <Card key={q.id}>
                <CardContent className="space-y-3 pt-6">
                  <p className="text-sm font-medium text-[#010131]">
                    {qi + 1}. {q.prompt_en}
                  </p>
                  {q.type === "pattern_recognition" && q.sequence && (
                    <p className="font-mono text-sm text-[#5391D5]">
                      {q.sequence.map((c) => (c === null ? "?" : c)).join("   ")}
                    </p>
                  )}
                  <div className="space-y-2">
                    {q.options_en.map((opt, oi) => {
                      const selected = answers[q.id] === oi;
                      return (
                        <button
                          key={oi}
                          type="button"
                          onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                          className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
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
            ))}
            <Button onClick={submitQuiz} disabled={!allAnswered || busy} className="w-full" size="lg">
              {busy ? "Submitting…" : "Submit answers"}
            </Button>
          </div>
        )}

        {step === "done" && (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
              <CheckCircle2 className="h-10 w-10 text-[#00843D]" />
              <h2 className="text-lg font-semibold text-[#010131]">Thank you</h2>
              <p className="max-w-sm text-sm text-muted-foreground">
                Your responses have been submitted. The hiring team will review them and be in touch.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
