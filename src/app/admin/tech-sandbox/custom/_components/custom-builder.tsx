"use client";

import { useMemo, useState } from "react";
import type { CustomBuilderData } from "@/lib/technical-sandbox/service";
import { createCustomSandboxSessionAction, emailSandboxLinkAction } from "../../actions";

const ENGINE_LABEL: Record<string, string> = {
  spreadsheet: "Spreadsheet",
  advanced_spreadsheet: "Advanced spreadsheet",
  logic_input: "Calculation",
  sql: "SQL",
  python: "Python",
};

export function CustomBuilder({ data }: { data: CustomBuilderData }) {
  const allBlockIds = useMemo(
    () => data.pillars.flatMap((p) => p.blocks.map((b) => b.id)),
    [data],
  );

  const [skills, setSkills] = useState<Set<string>>(new Set(data.skills));
  const [blockIds, setBlockIds] = useState<Set<string>>(new Set(allBlockIds));
  const [mcqPct, setMcqPct] = useState(40);
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const toggle = (set: Set<string>, key: string): Set<string> => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const knowledgeOn = mcqPct > 0 && skills.size > 0;
  const handsOnCount = blockIds.size;
  const canIssue = handsOnCount > 0 || knowledgeOn;

  // What the candidate will actually sit (the knowledge weight is ignored when no
  // skills are picked, so the summary reflects the real configuration).
  const summary = (() => {
    const parts: string[] = [];
    if (knowledgeOn) parts.push(`${skills.size} knowledge skill${skills.size === 1 ? "" : "s"} at ${mcqPct}%`);
    if (handsOnCount > 0) parts.push(`${handsOnCount} hands-on task${handsOnCount === 1 ? "" : "s"} at ${knowledgeOn ? 100 - mcqPct : 100}%`);
    if (parts.length === 0) return "Nothing selected yet.";
    return parts.join(" + ");
  })();

  async function issue() {
    setBusy(true);
    setError(null);
    setLink(null);
    setToken(null);
    setEmailMsg(null);
    const res = await createCustomSandboxSessionAction({
      functionId: data.functionId,
      selectedSkills: [...skills],
      selectedBlockIds: [...blockIds],
      mcqPct,
      candidateName: candidateName || undefined,
      candidateEmail: candidateEmail || undefined,
      organizationName: organizationName || undefined,
    });
    setBusy(false);
    if ("error" in res) return setError(res.error);
    setToken(res.token);
    setLink(`${window.location.origin}/tech-sandbox/${res.token}`);
  }

  async function emailLink() {
    if (!token) return;
    setBusy(true);
    setEmailMsg(null);
    const res = await emailSandboxLinkAction({ token });
    setBusy(false);
    if ("error" in res) return setEmailMsg({ ok: false, text: res.error });
    setEmailMsg({ ok: true, text: `Link emailed to ${res.to}.` });
  }

  return (
    <div className="space-y-6">
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

      {/* Candidate + issue */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-medium text-foreground">Issue the custom assessment</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Candidate name</span>
            <input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} className="rounded-md border border-border bg-card px-3 py-2 text-foreground" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Candidate email</span>
            <input type="email" value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} className="rounded-md border border-border bg-card px-3 py-2 text-foreground" />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Organization (optional)</span>
            <input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} className="rounded-md border border-border bg-card px-3 py-2 text-foreground" />
          </label>
        </div>

        <div className="mt-3 rounded-md border border-border bg-muted/40 p-2.5 text-xs text-foreground">
          <span className="text-muted-foreground">This sitting: </span>
          {summary}
        </div>

        <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
          Indicative result - a custom (pick-and-choose) sitting issues no credential. For a
          certified result, issue the full function assessment.
        </div>

        <button
          onClick={issue}
          disabled={busy || !canIssue}
          className="mt-3 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Create custom assessment link
        </button>
        {!canIssue && (
          <p className="mt-2 text-xs text-muted-foreground">
            Pick at least one hands-on task, or select knowledge skills with a knowledge weight above 0.
          </p>
        )}

        {link && (
          <div className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm">
            <div className="mb-1 font-medium text-emerald-800">Candidate link</div>
            <div className="flex items-center gap-2">
              <input readOnly value={link} className="flex-1 rounded border border-emerald-200 bg-white px-2 py-1 text-xs text-slate-700" />
              <button onClick={() => navigator.clipboard?.writeText(link)} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white">
                Copy
              </button>
              {candidateEmail && (
                <button onClick={emailLink} disabled={busy} className="rounded border border-emerald-300 px-3 py-1 text-xs text-emerald-800 disabled:opacity-50">
                  Email to candidate
                </button>
              )}
            </div>
            {emailMsg && (
              <p className={`mt-2 text-xs ${emailMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{emailMsg.text}</p>
            )}
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </section>
    </div>
  );
}
