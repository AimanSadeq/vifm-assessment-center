"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Q = {
  id: string;
  type: string;
  prompt_en: string;
  options_en: string[];
  sequence: (string | number | null)[] | null;
};

/**
 * Competency quiz stage. Owns its own intro → questions flow and calls
 * onDone() once answers are submitted (the orchestrator advances from there).
 */
export function QuizStage({ token, onDone }: { token: string; onDone: () => void }) {
  const [phase, setPhase] = useState<"intro" | "quiz">("intro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  const start = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/prehire/${token}/quiz/start`, { method: "POST" });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (d.done) return onDone();
    if (!r.ok || !d.questions) return setError(d.error || "Couldn't start the assessment.");
    setQuestions(d.questions as Q[]);
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
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return setError(d.error || "Couldn't submit your answers.");
    }
    onDone();
  };

  const allAnswered =
    questions.length > 0 && questions.every((q) => typeof answers[q.id] === "number");

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {phase === "intro" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="font-semibold text-[#010131]">Competency assessment</h2>
            <p className="text-sm text-muted-foreground">
              A short set of questions about the competencies for this role. Answer honestly -
              there are no trick questions. It takes only a few minutes.
            </p>
            <Button onClick={start} disabled={busy} className="w-full">
              {busy ? "Preparing…" : "Start assessment"}
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === "quiz" && (
        <>
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
          <Button onClick={submit} disabled={!allAnswered || busy} className="w-full" size="lg">
            {busy ? "Submitting…" : "Submit answers"}
          </Button>
        </>
      )}
    </div>
  );
}
