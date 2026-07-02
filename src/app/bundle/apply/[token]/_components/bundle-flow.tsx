"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, ShieldCheck, CheckCircle2, ArrowRight, ClipboardList, Boxes, BrainCircuit, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BundleStage } from "@/lib/bespoke/candidates";

type Phase = "consent" | BundleStage | "done";
type PersonaItem = { itemKey: string; competencyId: string; textEn: string; textAr: string };
type CogItem = { id: string; scale: string; stem: string; options: string[] };

const LIKERT = [
  { v: 1, label: "Strongly disagree" },
  { v: 2, label: "Disagree" },
  { v: 3, label: "Neutral" },
  { v: 4, label: "Agree" },
  { v: 5, label: "Strongly agree" },
];

async function postJson(url: string, body?: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error || "Request failed");
  return j;
}

export function BundleFlow({
  token,
  candidateName,
  bundleName,
  stages,
  hasConsent,
  personaDone,
  cognitiveDone,
  timerMinutes,
  logicaLabel,
}: {
  token: string;
  candidateName: string;
  bundleName: string;
  stages: BundleStage[];
  hasConsent: boolean;
  personaDone: boolean;
  cognitiveDone: boolean;
  timerMinutes: number | null;
  logicaLabel: string;
}) {
  const base = `/api/bundle/${token}`;
  const doneByStage: Record<BundleStage, boolean> = { persona: personaDone, logica: cognitiveDone };

  const firstOpen = (): Phase => {
    const open = stages.find((s) => !doneByStage[s]);
    if (!open) return "done";
    if (!hasConsent) return "consent";
    return open;
  };
  const [phase, setPhase] = useState<Phase>(firstOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local completion tracking so advancing works without a reload.
  const [localDone, setLocalDone] = useState<Record<BundleStage, boolean>>(doneByStage);

  const advance = (from: BundleStage) => {
    const next = { ...localDone, [from]: true };
    setLocalDone(next);
    const open = stages.find((s) => !next[s]);
    setPhase(open ?? "done");
  };

  const stageNumber = (s: BundleStage) => stages.indexOf(s) + 1;

  return (
    <div className="min-h-screen bg-[#FEFFF9]">
      <header className="border-b bg-[#010131] px-6 py-4 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Boxes className="h-5 w-5 text-[#5391D5]" />
          <div>
            <div className="text-sm font-semibold">Bespoke Assessment</div>
            <div className="text-xs text-white/70">{bundleName}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {error && (
          <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {phase === "consent" && (
          <div className="rounded-xl border bg-card p-6">
            <h1 className="text-xl font-semibold text-[#010131]">Welcome, {candidateName}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You have been invited to complete <span className="font-medium text-foreground">{bundleName}</span>. It has{" "}
              {stages.length === 1 ? "one section" : `${stages.length} sections`}
              {stages.includes("persona") && stages.includes("logica")
                ? ": a behavioural self-assessment (Persona) and a reasoning section (Logica)"
                : stages.includes("persona")
                  ? ": a behavioural self-assessment (Persona)"
                  : `: a reasoning section (${logicaLabel})`}
              . Your responses produce a report for the sponsoring organisation.
            </p>
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#5391D5]/5 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#5391D5]" />
              <span>By continuing you consent to taking this assessment and to your results being shared with the sponsoring organisation.</span>
            </div>
            <Button
              onClick={async () => {
                setBusy(true); setError(null);
                try { await postJson(`${base}/consent`); setPhase(stages.find((s) => !localDone[s]) ?? "done"); }
                catch (e) { setError((e as Error).message); }
                finally { setBusy(false); }
              }}
              disabled={busy}
              className="mt-5 gap-2"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} I agree - start
            </Button>
          </div>
        )}

        {phase === "persona" && (
          <PersonaSection base={base} number={stageNumber("persona")} onError={setError} onDone={() => advance("persona")} />
        )}

        {phase === "logica" && (
          <CognitiveSection
            base={base}
            number={stageNumber("logica")}
            label={logicaLabel}
            timerMinutes={timerMinutes}
            onError={setError}
            onDone={() => advance("logica")}
          />
        )}

        {phase === "done" && (
          <div className="rounded-xl border bg-card p-8 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
            <h1 className="mt-3 text-xl font-semibold text-[#010131]">Assessment complete</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Thank you, {candidateName} - your responses have been recorded and shared with the sponsoring organisation.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function PersonaSection({ base, number, onError, onDone }: { base: string; number: number; onError: (m: string | null) => void; onDone: () => void }) {
  const [items, setItems] = useState<PersonaItem[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    postJson(`${base}/persona/start`)
      .then((j) => { if (live) setItems(j.items as PersonaItem[]); })
      .catch((e) => onError((e as Error).message));
    return () => { live = false; };
  }, [base, onError]);

  if (!items) return <Loading label="Preparing the behavioural section…" />;
  const answered = items.filter((i) => answers[i.itemKey]).length;
  const allAnswered = answered === items.length;

  return (
    <div>
      <SectionHeader icon={<ClipboardList className="h-5 w-5" />} title={`Section ${number} · Behavioural (Persona)`}
        sub={`Rate how much each statement describes you. ${answered}/${items.length} answered.`} />
      <div className="space-y-3">
        {items.map((it, idx) => (
          <div key={it.itemKey} className="rounded-lg border bg-card p-4">
            <div className="text-sm text-foreground"><span className="text-muted-foreground">{idx + 1}.</span> {it.textEn}</div>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {LIKERT.map((l) => {
                const on = answers[it.itemKey] === l.v;
                return (
                  <button key={l.v} type="button"
                    onClick={() => setAnswers((p) => ({ ...p, [it.itemKey]: l.v }))}
                    className={`rounded-md border px-1 py-2 text-[10px] font-medium leading-tight transition-colors ${on ? "border-[#5391D5] bg-[#5391D5] text-white" : "border-border hover:bg-muted"}`}>
                    {l.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Button
        className="mt-5 gap-2"
        disabled={!allAnswered || busy}
        onClick={async () => {
          setBusy(true); onError(null);
          try {
            await postJson(`${base}/persona/submit`, { answers: Object.entries(answers).map(([itemKey, rawScore]) => ({ itemKey, rawScore })) });
            onDone();
          } catch (e) { onError((e as Error).message); }
          finally { setBusy(false); }
        }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        {allAnswered ? "Submit behavioural section" : `Answer all (${answered}/${items.length})`}
      </Button>
    </div>
  );
}

function CognitiveSection({
  base, number, label, timerMinutes, onError, onDone,
}: {
  base: string; number: number; label: string; timerMinutes: number | null;
  onError: (m: string | null) => void; onDone: () => void;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [items, setItems] = useState<CogItem[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    let live = true;
    postJson(`${base}/cognitive/start`, { language: "en" })
      .then((j) => {
        if (!live) return;
        setSessionId(j.sessionId as string);
        setItems((j.test?.items ?? []) as CogItem[]);
        if (timerMinutes && timerMinutes > 0) setDeadline(Date.now() + timerMinutes * 60_000);
      })
      .catch((e) => onError((e as Error).message));
    return () => { live = false; };
  }, [base, onError, timerMinutes]);

  const submit = async (auto = false) => {
    if (submittedRef.current || !sessionId) return;
    submittedRef.current = true;
    setBusy(true); onError(null);
    try {
      await postJson(`${base}/cognitive/score`, { sessionId, answers, language: "en" });
      onDone();
    } catch (e) {
      submittedRef.current = false;
      onError(auto ? `Time is up, but the submit failed: ${(e as Error).message}` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // Countdown + auto-submit on expiry.
  useEffect(() => {
    if (deadline == null) return;
    const tick = () => {
      const ms = deadline - Date.now();
      if (ms <= 0) { setRemaining(0); submitRef.current(true); }
      else setRemaining(Math.ceil(ms / 1000));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  if (!items) return <Loading label="Preparing the reasoning section…" />;
  const answered = items.filter((i) => answers[i.id] != null).length;

  return (
    <div>
      <SectionHeader icon={<BrainCircuit className="h-5 w-5" />} title={`Section ${number} · Reasoning (Logica)`}
        sub={`${label}. Choose the best answer for each question. ${answered}/${items.length} answered.`} />
      {remaining != null && (
        <div className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${remaining <= 60 ? "border-rose-300 bg-rose-50 text-rose-700" : "border-border bg-card text-muted-foreground"}`}>
          <Clock className="h-3.5 w-3.5" /> {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")} remaining
        </div>
      )}
      <div className="space-y-3">
        {items.map((it, idx) => (
          <div key={it.id} className="rounded-lg border bg-card p-4">
            <div className="text-sm text-foreground"><span className="text-muted-foreground">{idx + 1}.</span> {it.stem}</div>
            <div className="mt-2 space-y-1.5">
              {it.options.map((opt, oi) => {
                const on = answers[it.id] === oi;
                return (
                  <button key={oi} type="button"
                    onClick={() => setAnswers((p) => ({ ...p, [it.id]: oi }))}
                    className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors ${on ? "border-[#5391D5] bg-[#5391D5]/10" : "border-border hover:bg-muted"}`}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${on ? "border-[#5391D5] bg-[#5391D5]" : "border-muted-foreground"}`}>
                      {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <Button className="mt-5 gap-2" disabled={busy} onClick={() => submit(false)}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Submit reasoning section
      </Button>
    </div>
  );
}

function SectionHeader({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#010131] text-white">{icon}</div>
      <div>
        <h2 className="text-base font-semibold text-[#010131]">{title}</h2>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-card p-6 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}
