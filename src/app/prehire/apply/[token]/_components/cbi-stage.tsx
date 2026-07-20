"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Msg = { role: "interviewer" | "candidate"; text: string };

/**
 * Conversational behavioural-interview stage. The server (cbi/turn) owns the
 * transcript + when to conclude; this component just renders the chat and
 * calls onDone() after the candidate submits (cbi/submit scores it).
 */
export function CbiStage({ token, onDone, lang = "en" }: { token: string; onDone: () => void; lang?: "en" | "ar" }) {
  const ar = lang === "ar";
  const tr = (en: string, arText: string) => (ar ? arText : en);
  const [phase, setPhase] = useState<"intro" | "chat">("intro");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [concluded, setConcluded] = useState(false);
  // Advisory integrity capture (trial: "this should include a timer, to restrict
  // using an AI agent"): tab-away count/duration, paste count + pasted length,
  // and per-answer thinking time all ride into the stage flags for the
  // recruiter's integrity signal. Advisory only - it never fails the stage.
  const blurCountRef = useRef(0);
  const awayMsRef = useRef(0);
  const pasteCountRef = useRef(0);
  const pasteCharsRef = useRef(0);
  const turnSecondsRef = useRef<number[]>([]);
  const turnStartRef = useRef<number>(0);

  useEffect(() => {
    if (phase !== "chat") return;
    turnStartRef.current = Date.now();
    let awayStart: number | null = null;
    const goneAway = () => { if (awayStart == null) awayStart = Date.now(); };
    const cameBack = () => {
      if (awayStart == null) return;
      const dur = Date.now() - awayStart;
      awayStart = null;
      if (dur < 1500) return;
      blurCountRef.current += 1;
      awayMsRef.current += dur;
    };
    const onVis = () => { if (document.hidden) goneAway(); else cameBack(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", goneAway);
    window.addEventListener("focus", cameBack);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", goneAway);
      window.removeEventListener("focus", cameBack);
    };
  }, [phase]);

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
    if (!r.ok || !d.message) return setError(d.error || tr("Couldn't start the interview.", "تعذّر بدء المقابلة."));
    setMessages([{ role: "interviewer", text: d.message }]);
    setConcluded(!!d.shouldConclude);
    setPhase("chat");
  };

  const send = async () => {
    const answer = draft.trim();
    if (!answer) return;
    turnSecondsRef.current.push(Math.round((Date.now() - turnStartRef.current) / 1000));
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
    turnStartRef.current = Date.now();
  };

  const finish = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/prehire/${token}/cbi/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        integrityFlags: {
          blurCount: blurCountRef.current,
          awayMs: awayMsRef.current,
          pasteCount: pasteCountRef.current,
          pasteChars: pasteCharsRef.current,
          turnSeconds: turnSecondsRef.current,
        },
      }),
    });
    setBusy(false);
    // Idempotent completion: a lost response may already have completed the
    // stage server-side - a second click must advance, not loop on an error.
    if (r.status === 409) return onDone();
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      return setError(d.error || tr("Couldn't submit the interview.", "تعذّر إرسال المقابلة."));
    }
    onDone();
  };

  return (
    <div className="space-y-4" dir={ar ? "rtl" : "ltr"}>
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {phase === "intro" && (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <h2 className="font-semibold text-[#010131]">{tr("Behavioural interview", "مقابلة سلوكية")}</h2>
            <p className="text-sm text-muted-foreground">
              {tr(
                "A short conversational interview. You'll be asked about real situations you've handled - describe what happened, what you personally did, and the outcome. Answer in your own words; take your time.",
                "مقابلة حوارية قصيرة. ستُسأل عن مواقف حقيقية تعاملت معها - صِف ما حدث، وما فعلته أنت شخصيًا، والنتيجة. أجب بأسلوبك الخاص، وخذ وقتك."
              )}
            </p>
            <Button onClick={start} disabled={busy} className="w-full">
              {busy ? tr("Starting…", "جارٍ البدء…") : tr("Start interview", "ابدأ المقابلة")}
            </Button>
            <p className="text-center text-[11px] text-slate-400">
              {tr("Integrity monitoring is on - answer in your own words.", "المراقبة النزاهية مفعّلة - أجب بكلماتك الخاصة.")}
            </p>
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
                  {tr("That's the end of the interview. Submit to finish this step.", "انتهت المقابلة. أرسِل لإنهاء هذه الخطوة.")}
                </p>
                <Button onClick={finish} disabled={busy} className="w-full" size="lg">
                  {busy ? tr("Scoring your interview - this can take a minute…", "جارٍ تقييم مقابلتك - قد يستغرق دقيقة…") : tr("Finish & submit", "إنهاء وإرسال")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              <textarea
                id="prehire-cbi-answer"
                name="prehire-cbi-answer"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onPaste={(e) => {
                  const len = e.clipboardData?.getData("text")?.length ?? 0;
                  pasteCountRef.current += 1;
                  pasteCharsRef.current += len;
                }}
                rows={4}
                placeholder={tr("Type your answer…", "اكتب إجابتك…")}
                disabled={busy}
                className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#5391D5]"
              />
              <Button onClick={send} disabled={!draft.trim() || busy} className="w-full">
                {busy ? tr("Sending…", "جارٍ الإرسال…") : tr("Send", "إرسال")}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
