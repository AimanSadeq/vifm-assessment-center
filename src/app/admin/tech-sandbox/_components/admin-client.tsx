"use client";
// Admin: issue a technical sandbox assessment. Pick an active function directly,
// or paste a JD to get a ranked shortlist (admin confirms), then create a
// token-accessed sitting and copy the candidate link.
import { useState } from "react";
import type { FunctionRow } from "@/lib/technical-sandbox/service";
import { matchJdAction, createSandboxSessionAction } from "../actions";

interface JdMatch {
  functionId: string;
  nodeId: string | null;
  nameEn: string;
  score: number;
  matchedKeywords: string[];
  nodeStatus?: "active" | "inactive";
}

export function AdminClient({ functions }: { functions: FunctionRow[] }) {
  const [functionId, setFunctionId] = useState(functions[0]?.id ?? "");
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [jd, setJd] = useState("");
  const [matches, setMatches] = useState<JdMatch[] | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runMatch() {
    setBusy(true);
    setError(null);
    const res = await matchJdAction(jd);
    setBusy(false);
    if ("error" in res) return setError(res.error);
    setMatches(res.matches as JdMatch[]);
    if (res.matches[0]) {
      const active = functions.find((f) => f.id === res.matches[0].functionId);
      if (active) setFunctionId(active.id);
    }
  }

  async function createSession() {
    setBusy(true);
    setError(null);
    setLink(null);
    const res = await createSandboxSessionAction({
      functionId,
      candidateName: candidateName || undefined,
      candidateEmail: candidateEmail || undefined,
      organizationName: organizationName || undefined,
    });
    setBusy(false);
    if ("error" in res) return setError(res.error);
    setLink(`${window.location.origin}/tech-sandbox/${res.token}`);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-medium text-foreground">Match a job description (optional)</h2>
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          rows={5}
          placeholder="Paste a JD; the engine returns a ranked shortlist for you to confirm."
          className="w-full rounded-md border border-border bg-card p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#5391D5]"
        />
        <button
          onClick={runMatch}
          disabled={busy}
          className="mt-2 rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
        >
          Match
        </button>
        {matches && (
          <ul className="mt-3 space-y-1 text-sm">
            {matches.length === 0 && <li className="text-muted-foreground">No keyword matches.</li>}
            {matches.map((m) => {
              const isActive = functions.some((f) => f.id === m.functionId);
              return (
                <li key={m.functionId} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <span className="text-foreground">
                    {m.nodeId} · {m.nameEn}{" "}
                    <span className="text-xs text-muted-foreground">({Math.round(m.score * 100)}% · {m.matchedKeywords.length} kw)</span>
                    {!isActive && <span className="ml-2 text-xs text-amber-600">not yet built</span>}
                  </span>
                  {isActive && (
                    <button onClick={() => setFunctionId(m.functionId)} className="text-xs text-[#5391D5] hover:underline">
                      Select
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-medium text-foreground">Issue an assessment</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="text-muted-foreground">Function (active)</span>
            <select
              value={functionId}
              onChange={(e) => setFunctionId(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
            >
              {functions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nodeId} · {f.nameEn}
                </option>
              ))}
            </select>
          </label>
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
        <button
          onClick={createSession}
          disabled={busy || !functionId}
          className="mt-3 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Create assessment link
        </button>
        {link && (
          <div className="mt-3 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm">
            <div className="mb-1 font-medium text-emerald-800">Candidate link</div>
            <div className="flex items-center gap-2">
              <input readOnly value={link} className="flex-1 rounded border border-emerald-200 bg-white px-2 py-1 text-xs text-slate-700" />
              <button onClick={() => navigator.clipboard?.writeText(link)} className="rounded bg-emerald-600 px-3 py-1 text-xs text-white">
                Copy
              </button>
            </div>
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
