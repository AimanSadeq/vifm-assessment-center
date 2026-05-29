"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Msg = { role: "interviewer" | "candidate"; text: string };

/**
 * Conversational behavioural-interview stage. The server (cbi/turn) owns the
 * transcript + when to conclude; this component just renders the chat and
 * calls onDone() after the candidate submits (cbi/submit scores it).
 */
export function CbiStage({ token, onDone }: { token: string; onDone: () => void }) {
  const [phase, setPhase] = useState<"intro" | "chat">("intro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [concluded, setConcluded] = useState(false);

  const start = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/prehire/${token}/cbi/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (d.done) return onDone();
    if (!r.ok || !d.message) return setError(d.error || "Couldn't start the interview.");
    setMessages([{ role: "interviewer", text: d.message }]);
    setConcluded(!!d.shouldConclude);
    setPhase("chat");
  };

  const send = async () => {
    const answer = draft.trim();
    if (!answer) return;
    setBusy(true);
    setError(null);
    setMessages((m) => [...m, { role: "candidate", text: answer }]);
    setDraft("");
    const r = await fetch(`/api/prehire/${token}/cbi/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok || !d.message) return setError(d.error || "Couldn't send your answer.");
    setMessages((m) => [...m, { role: "interviewer", text: d.message }]);
    setConcluded(!!d.shouldConclude);
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/prehire/${token}/cbi/submit`, { method: "POST" });
    setBusy(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return setError(d.error || "Couldn't submit the interview.");
    }
    onDone();
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {phase === "intro" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="font-semibold text-[#010131]">Behavioural interview</h2>
            <p className="text-sm text-muted-foreground">
              A short conversational interview. You&apos;ll be asked about real situations
              you&apos;ve handled — describe what happened, what you personally did, and the
              outcome. Answer in your own words; take your time.
            </p>
            <Button onClick={start} disabled={busy} className="w-full">
              {busy ? "Starting…" : "Start interview"}
            </Button>
          </CardContent>
        </Card>
      )}

      {phase === "chat" && (
        <>
          <div className="space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={m.role === "candidate" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                    m.role === "candidate"
                      ? "bg-[#5391D5] text-white"
                      : "border border-input bg-white text-[#010131]"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {concluded ? (
            <Card>
              <CardContent className="space-y-3 pt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  That&apos;s the end of the interview. Submit to finish this step.
                </p>
                <Button onClick={finish} disabled={busy} className="w-full" size="lg">
                  {busy ? "Submitting…" : "Finish & submit"}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                placeholder="Type your answer…"
                disabled={busy}
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5391D5]"
              />
              <Button onClick={send} disabled={!draft.trim() || busy} className="w-full">
                {busy ? "Sending…" : "Send"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
