"use client";

import { useMemo, useState } from "react";
import type { CustomBuilderData } from "@/lib/technical-sandbox/service";
import {
  createCustomSandboxSessionsAction,
  emailSandboxLinkAction,
} from "../../actions";

const ENGINE_LABEL: Record<string, string> = {
  spreadsheet: "Spreadsheet",
  advanced_spreadsheet: "Advanced spreadsheet",
  logic_input: "Calculation",
  sql: "SQL",
  python: "Python",
};

type TalentLens = "acquisition" | "development" | null;
type Delegate = { name: string; email: string };
type IssuedLink = { name: string | null; email: string | null; token: string; link: string };

export function CustomBuilder({
  data,
  talentLens = null,
}: {
  data: CustomBuilderData;
  talentLens?: TalentLens;
}) {
  const allBlockIds = useMemo(
    () => data.pillars.flatMap((p) => p.blocks.map((b) => b.id)),
    [data],
  );

  // ── Step 1 (design) state ──
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [skills, setSkills] = useState<Set<string>>(new Set(data.skills));
  const [blockIds, setBlockIds] = useState<Set<string>>(new Set(allBlockIds));
  const [mcqPct, setMcqPct] = useState(40);

  // ── Step 2 (assign) state ──
  const [organizationName, setOrganizationName] = useState("");
  const [delegates, setDelegates] = useState<Delegate[]>([{ name: "", email: "" }]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedLink[] | null>(null);
  const [emailState, setEmailState] = useState<Record<string, { ok: boolean; text: string }>>({});

  const toggle = (set: Set<string>, key: string): Set<string> => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const knowledgeOn = mcqPct > 0 && skills.size > 0;
  const handsOnCount = blockIds.size;
  const canContinue = handsOnCount > 0 || knowledgeOn;

  // What the candidate will actually sit (the knowledge weight is ignored when no
  // skills are picked, so the summary reflects the real configuration).
  const summary = (() => {
    const parts: string[] = [];
    if (knowledgeOn) parts.push(`${skills.size} knowledge skill${skills.size === 1 ? "" : "s"} at ${mcqPct}%`);
    if (handsOnCount > 0) parts.push(`${handsOnCount} hands-on task${handsOnCount === 1 ? "" : "s"} at ${knowledgeOn ? 100 - mcqPct : 100}%`);
    if (parts.length === 0) return "Nothing selected yet.";
    return parts.join(" + ");
  })();

  const lensLabel =
    talentLens === "acquisition"
      ? "Talent Acquisition"
      : talentLens === "development"
        ? "Talent Development"
        : null;

  function updateDelegate(i: number, patch: Partial<Delegate>) {
    setDelegates((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function addDelegate() {
    setDelegates((prev) => [...prev, { name: "", email: "" }]);
  }
  function removeDelegate(i: number) {
    setDelegates((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function issue() {
    setBusy(true);
    setError(null);
    setIssued(null);
    setEmailState({});
    const res = await createCustomSandboxSessionsAction({
      functionId: data.functionId,
      selectedSkills: [...skills],
      selectedBlockIds: [...blockIds],
      mcqPct,
      assessmentTitle: title || undefined,
      organizationName: organizationName || undefined,
      talentLens,
      delegates: delegates
        .map((d) => ({ name: d.name.trim(), email: d.email.trim() }))
        .filter((d) => d.name && d.email),
    });
    setBusy(false);
    if ("error" in res) return setError(res.error);
    setIssued(res.results);
  }

  async function emailLink(token: string) {
    setEmailState((s) => ({ ...s, [token]: { ok: true, text: "Sending..." } }));
    const res = await emailSandboxLinkAction({ token });
    if ("error" in res) {
      setEmailState((s) => ({ ...s, [token]: { ok: false, text: res.error } }));
    } else {
      setEmailState((s) => ({ ...s, [token]: { ok: true, text: `Emailed to ${res.to}.` } }));
    }
  }

  // ──────────────────────────────────────────────────────────────
  // Step 1: design the assessment (no client / delegate yet)
  // ──────────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div className="space-y-6">
        {lensLabel && (
          <div className="rounded-md border border-[#5391D5]/30 bg-[#5391D5]/10 px-3 py-2 text-xs font-medium text-[#010131]">
            {lensLabel} - designing the assessment. You will add the client and delegates after you confirm the design.
          </div>
        )}

        {/* Assessment name/title */}
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="font-medium text-foreground">Assessment name</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Name this custom assessment so you can track it later (e.g. &quot;Treasury analyst screen - Q3&quot;).
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Custom assessment title"
            className="mt-3 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
          />
        </section>

        {/* Knowledge (MCQ) section */}
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium text-foreground">Knowledge section (MCQ)</h2>
            <span className="text-xs text-muted-foreground">
              {skills.size}/{data.skills.length} skills
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick the skills the knowledge questions are drawn from. Set the weight to 0 to skip the
            knowledge section entirely (hands-on only).
          </p>
          {data.skills.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              This function has no knowledge skills declared - hands-on only.
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.skills.map((s) => {
                  const on = skills.has(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSkills((prev) => toggle(prev, s))}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        on ? "border-[#5391D5] bg-[#5391D5]/10 text-[#010131]" : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {on ? "✓ " : ""}
                      {s}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 flex gap-2 text-xs">
                <button type="button" onClick={() => setSkills(new Set(data.skills))} className="text-[#5391D5] hover:underline">
                  Select all
                </button>
                <button type="button" onClick={() => setSkills(new Set())} className="text-[#5391D5] hover:underline">
                  Clear
                </button>
              </div>
              <label className="mt-4 flex items-center gap-3 text-sm">
                <span className="text-muted-foreground">Knowledge weight</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={mcqPct}
                  onChange={(e) => setMcqPct(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-20 text-right font-medium text-foreground">
                  {mcqPct}% knowledge
                </span>
              </label>
              <p className="text-xs text-muted-foreground">
                Hands-on tasks carry the remaining {100 - mcqPct}%.
              </p>
            </>
          )}
        </section>

        {/* Hands-on (sandbox) tasks */}
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-medium text-foreground">Hands-on tasks</h2>
            <span className="text-xs text-muted-foreground">
              {handsOnCount}/{allBlockIds.length} tasks
            </span>
          </div>
          {allBlockIds.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No hands-on tasks for this function.</p>
          ) : (
            <>
              <div className="mt-3 flex gap-2 text-xs">
                <button type="button" onClick={() => setBlockIds(new Set(allBlockIds))} className="text-[#5391D5] hover:underline">
                  Select all
                </button>
                <button type="button" onClick={() => setBlockIds(new Set())} className="text-[#5391D5] hover:underline">
                  Clear
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {data.pillars.map((p) => (
                  <div key={p.id} className="rounded-md border border-border p-3">
                    <h3 className="text-sm font-semibold text-[#121232]">{p.nameEn}</h3>
                    <div className="mt-2 space-y-1.5">
                      {p.blocks.map((b) => {
                        const on = blockIds.has(b.id);
                        return (
                          <label key={b.id} className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={() => setBlockIds((prev) => toggle(prev, b.id))}
                              className="h-4 w-4 rounded border-border"
                            />
                            <span className="text-foreground">{b.nameEn}</span>
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              {ENGINE_LABEL[b.engineType] ?? b.engineType}
                            </span>
                            {b.reviewStatus !== "approved" && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600">
                                {b.reviewStatus}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* Confirm design */}
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="rounded-md border border-border bg-muted/40 p-2.5 text-xs text-foreground">
            <span className="text-muted-foreground">This sitting: </span>
            {summary}
          </div>
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
            Indicative result - a custom (pick-and-choose) sitting issues no credential. For a
            certified result, issue the full function assessment.
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!canContinue}
            className="mt-3 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Confirm design and add delegates
          </button>
          {!canContinue && (
            <p className="mt-2 text-xs text-muted-foreground">
              Pick at least one hands-on task, or select knowledge skills with a knowledge weight above 0.
            </p>
          )}
        </section>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Step 2: assign the client + delegates and issue links
  // ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Confirmed design summary */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-medium text-foreground">{title || "Custom assessment"}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
            {lensLabel && (
              <span className="mt-2 inline-block rounded-full bg-[#5391D5]/10 px-2 py-0.5 text-[10px] font-medium text-[#010131]">
                {lensLabel}
              </span>
            )}
          </div>
          <button
            onClick={() => {
              setStep(1);
              setIssued(null);
              setError(null);
            }}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-muted"
          >
            Edit design
          </button>
        </div>
      </section>

      {/* Client + delegates */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-1 font-medium text-foreground">Assign the assessment</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Add the client and one row per delegate. Each delegate gets their own private link.
        </p>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Client / organization</span>
          <input
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            placeholder="Client organization name"
            className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
          />
        </label>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Delegates</span>
            <span className="text-xs text-muted-foreground">
              {delegates.filter((d) => d.name.trim() && d.email.trim()).length} ready
            </span>
          </div>
          {delegates.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={d.name}
                onChange={(e) => updateDelegate(i, { name: e.target.value })}
                placeholder="Delegate name"
                className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
              <input
                type="email"
                value={d.email}
                onChange={(e) => updateDelegate(i, { email: e.target.value })}
                placeholder="Delegate email"
                className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              />
              <button
                type="button"
                onClick={() => removeDelegate(i)}
                disabled={delegates.length === 1}
                className="shrink-0 rounded-md border border-border px-2.5 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-40"
                aria-label="Remove delegate"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addDelegate}
            className="text-xs font-medium text-[#5391D5] hover:underline"
          >
            + Add delegate
          </button>
          <p className="text-[11px] text-muted-foreground">
            Leave the roster empty to create a single unassigned link you can share manually.
          </p>
        </div>

        <button
          onClick={issue}
          disabled={busy}
          className="mt-4 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Creating..." : "Create assessment links"}
        </button>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>

      {/* Issued links */}
      {issued && issued.length > 0 && (
        <section className="rounded-lg border border-emerald-300 bg-emerald-50 p-4">
          <h2 className="mb-2 font-medium text-emerald-800">
            {issued.length} link{issued.length === 1 ? "" : "s"} created
          </h2>
          <div className="space-y-3">
            {issued.map((r) => (
              <div key={r.token} className="rounded-md border border-emerald-200 bg-white p-3 text-sm">
                <div className="mb-1 font-medium text-slate-800">
                  {r.name ?? "Unassigned link"}
                  {r.email && <span className="ml-2 text-xs font-normal text-slate-500">{r.email}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <input readOnly value={r.link} className="flex-1 rounded border border-emerald-200 bg-white px-2 py-1 text-xs text-slate-700" />
                  <button onClick={() => navigator.clipboard?.writeText(r.link)} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white">
                    Copy
                  </button>
                  {r.email && (
                    <button onClick={() => emailLink(r.token)} className="rounded border border-emerald-300 px-3 py-1 text-xs text-emerald-800">
                      Email
                    </button>
                  )}
                </div>
                {emailState[r.token] && (
                  <p className={`mt-1.5 text-xs ${emailState[r.token].ok ? "text-emerald-700" : "text-red-600"}`}>
                    {emailState[r.token].text}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
