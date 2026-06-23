"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck, CheckCircle2, XCircle, ArrowRight, Download, ClipboardList, Boxes } from "lucide-react";
import { Button } from "@/components/ui/button";

type Phase = "consent" | "persona" | "technical" | "done";
type PersonaItem = { itemKey: string; competencyId: string; textEn: string; textAr: string };
type TechItem = { id: string; stem_en: string; stem_ar: string | null; options_en: string[]; options_ar: string[] | null };
type TechArea = { id: string; name_en: string; name_ar: string | null; items: TechItem[] };

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

export function ApplyFlow({
  token,
  candidateName,
  roleName,
  hasConsent,
  hasTechnical,
  completedSections,
  initialVerdict,
}: {
  token: string;
  candidateName: string;
  roleName: string;
  hasConsent: boolean;
  hasTechnical: boolean;
  completedSections: string[];
  initialVerdict: string;
}) {
  const base = `/api/role-readiness/${token}`;
  const personaDone = completedSections.includes("persona");
  const technicalDone = completedSections.includes("technical");

  const startPhase: Phase = useMemo(() => {
    if ((technicalDone || !hasTechnical) && personaDone) return "done";
    if (!hasConsent) return "consent";
    if (!personaDone) return "persona";
    if (hasTechnical && !technicalDone) return "technical";
    return "done";
  }, [hasConsent, personaDone, technicalDone, hasTechnical]);

  const [phase, setPhase] = useState<Phase>(startPhase);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-[#FEFFF9]">
      <header className="border-b bg-[#010131] px-6 py-4 text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <Boxes className="h-5 w-5 text-[#5391D5]" />
          <div>
            <div className="text-sm font-semibold">Role Readiness Assessment</div>
            <div className="text-xs text-white/70">{roleName}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {error && (
          <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {phase === "consent" && (
          <ConsentCard
            name={candidateName}
            roleName={roleName}
            busy={busy}
            onAgree={async () => {
              setBusy(true); setError(null);
              try { await postJson(`${base}/consent`); setPhase("persona"); }
              catch (e) { setError((e as Error).message); }
              finally { setBusy(false); }
            }}
          />
        )}

        {phase === "persona" && (
          <PersonaSection
            base={base}
            onError={setError}
            onDone={() => setPhase(hasTechnical ? "technical" : "done")}
          />
        )}

        {phase === "technical" && (
          <TechnicalSection base={base} onError={setError} onDone={() => setPhase("done")} />
        )}

        {phase === "done" && <DoneCard base={base} token={token} initialVerdict={initialVerdict} />}
      </main>
    </div>
  );
}

function ConsentCard({ name, roleName, busy, onAgree }: { name: string; roleName: string; busy: boolean; onAgree: () => void }) {
  return (
    <div className="rounded-xl border bg-card p-6">
      <h1 className="text-xl font-semibold text-[#010131]">Welcome, {name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You have been invited to complete the <span className="font-medium text-foreground">{roleName}</span> readiness
        assessment. It has two short sections: a behavioural self-assessment (Persona) and a technical knowledge check.
        Your responses are processed to produce a readiness report for the sponsoring organisation.
      </p>
      <div className="mt-4 flex items-start gap-2 rounded-lg bg-[#5391D5]/5 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#5391D5]" />
        <span>By continuing you consent to taking this assessment and to your results being shared with the sponsoring organisation.</span>
      </div>
      <Button onClick={onAgree} disabled={busy} className="mt-5 gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} I agree - start
      </Button>
    </div>
  );
}

function PersonaSection({ base, onError, onDone }: { base: string; onError: (m: string | null) => void; onDone: () => void }) {
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
      <SectionHeader icon={<ClipboardList className="h-5 w-5" />} title="Section 1 · Behavioural (Persona)"
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

function TechnicalSection({ base, onError, onDone }: { base: string; onError: (m: string | null) => void; onDone: () => void }) {
  const [areas, setAreas] = useState<TechArea[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    postJson(`${base}/technical/start`)
      .then((j) => { if (live) setAreas(j.areas as TechArea[]); })
      .catch((e) => onError((e as Error).message));
    return () => { live = false; };
  }, [base, onError]);

  if (!areas) return <Loading label="Preparing the technical section…" />;
  const allItems = areas.flatMap((a) => a.items);
  const answered = allItems.filter((i) => answers[i.id] != null).length;

  return (
    <div>
      <SectionHeader icon={<Boxes className="h-5 w-5" />} title="Section 2 · Technical knowledge"
        sub={`Choose the best answer for each question. ${answered}/${allItems.length} answered.`} />
      <div className="space-y-5">
        {areas.map((area) => (
          <div key={area.id}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5391D5]">{area.name_en}</div>
            <div className="space-y-3">
              {area.items.map((it, idx) => (
                <div key={it.id} className="rounded-lg border bg-card p-4">
                  <div className="text-sm text-foreground"><span className="text-muted-foreground">{idx + 1}.</span> {it.stem_en}</div>
                  <div className="mt-2 space-y-1.5">
                    {it.options_en.map((opt, oi) => {
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
          </div>
        ))}
      </div>
      <Button
        className="mt-5 gap-2"
        disabled={busy}
        onClick={async () => {
          setBusy(true); onError(null);
          try { await postJson(`${base}/technical/submit`, { answers }); onDone(); }
          catch (e) { onError((e as Error).message); }
          finally { setBusy(false); }
        }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Submit technical section
      </Button>
    </div>
  );
}

type ResultData = {
  verdict: string;
  persona: { scorePct: number | null; passed: boolean | null; threshold: number };
  technical: { scorePct: number | null; passed: boolean | null; threshold: number };
  developmentPlan: { competencies: { name: string; suggestionEn: string }[]; areas: { name: string; suggestionEn: string }[] };
};

function DoneCard({ base, token, initialVerdict }: { base: string; token: string; initialVerdict: string }) {
  const [data, setData] = useState<ResultData | null>(null);
  useEffect(() => {
    fetch(`${base}/result`).then((r) => r.json()).then((j) => setData(j.data ?? null)).catch(() => setData(null));
  }, [base]);

  const verdict = data?.verdict ?? initialVerdict;
  const ready = verdict === "ready";
  return (
    <div className="rounded-xl border bg-card p-6 text-center">
      {ready ? <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" /> : <XCircle className="mx-auto h-12 w-12 text-amber-500" />}
      <h1 className="mt-3 text-xl font-semibold text-[#010131]">
        {ready ? "Ready" : verdict === "not_ready" ? "Not yet ready" : "Assessment complete"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">Thank you - your responses have been recorded.</p>

      {data && (
        <div className="mt-5 grid gap-3 text-left sm:grid-cols-2">
          <ScoreTile label="Behavioural (Persona)" pct={data.persona.scorePct} passed={data.persona.passed} threshold={data.persona.threshold} />
          <ScoreTile label="Technical" pct={data.technical.scorePct} passed={data.technical.passed} threshold={data.technical.threshold} />
        </div>
      )}

      {data && (data.developmentPlan.competencies.length > 0 || data.developmentPlan.areas.length > 0) && (
        <div className="mt-5 rounded-lg border bg-muted/30 p-4 text-left">
          <div className="text-sm font-semibold text-foreground">Development plan</div>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            {data.developmentPlan.competencies.map((c) => (
              <li key={`c-${c.name}`}><span className="font-medium text-foreground">{c.name}:</span> {c.suggestionEn}</li>
            ))}
            {data.developmentPlan.areas.map((a) => (
              <li key={`a-${a.name}`}><span className="font-medium text-foreground">{a.name}:</span> {a.suggestionEn}</li>
            ))}
          </ul>
        </div>
      )}

      <a href={`/api/role-readiness/${token}/report`} target="_blank" rel="noreferrer"
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#5391D5] px-5 py-3 text-sm font-semibold text-white hover:bg-[#5391D5]/90">
        <Download className="h-4 w-4" /> Download report (PDF)
      </a>
    </div>
  );
}

function ScoreTile({ label, pct, passed, threshold }: { label: string; pct: number | null; passed: boolean | null; threshold: number }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-[#010131]">{pct == null ? "-" : `${pct}%`}</span>
        <span className={`text-xs font-medium ${passed ? "text-emerald-600" : passed === false ? "text-amber-600" : "text-muted-foreground"}`}>
          {passed ? "Met" : passed === false ? "Below" : ""} (target {threshold}%)
        </span>
      </div>
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
