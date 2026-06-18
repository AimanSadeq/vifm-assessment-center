"use client";
// Admin - Option 1: DIRECT issuance to people you know. Pick an active function
// (or paste a JD for a ranked shortlist), then either:
//  - issue a single personal link to one candidate, or
//  - import named delegates (paste "Name, email" / upload CSV) -> one personal
//    code + redeem link per delegate, ready to email.
import { useMemo, useRef, useState } from "react";
import type { FunctionRow } from "@/lib/technical-sandbox/service";
import {
  matchJdAction,
  createSandboxSessionAction,
  checkSandboxDbAction,
  emailSandboxLinkAction,
  generateVouchersAction,
  emailVoucherCodesAction,
} from "../actions";

interface JdMatch {
  functionId: string;
  nodeId: string | null;
  nameEn: string;
  score: number;
  matchedKeywords: string[];
  nodeStatus?: "active" | "inactive";
}

type Delegate = { name: string; email: string };
type Assignment = { name: string; email: string; code: string };

function parseDelegates(text: string): Delegate[] {
  const out: Delegate[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // split on comma/tab/semicolon; supports "Name, email" or "email, Name" or pasted columns
    const parts = line.split(/[,\t;]+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    let name = "";
    let email = "";
    for (const p of parts) {
      if (!email && /@/.test(p)) email = p;
      else if (!name) name = p;
    }
    if (!email && parts.length >= 2) email = parts[1];
    if (!name) name = email.split("@")[0] ?? "Delegate";
    // skip header rows
    if (/^name$/i.test(name) && /^e-?mail$/i.test(email)) continue;
    if (email) out.push({ name, email });
  }
  return out;
}

export function AdminClient({ functions }: { functions: FunctionRow[] }) {
  const [functionId, setFunctionId] = useState(functions[0]?.id ?? "");
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [jd, setJd] = useState("");
  const [matches, setMatches] = useState<JdMatch[] | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbStatus, setDbStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  // Named-delegate batch issuance (one personal code + link each).
  const [delegateText, setDelegateText] = useState("");
  const [delegateOrg, setDelegateOrg] = useState("");
  const [delegateMcqPct, setDelegateMcqPct] = useState(0);
  const [delegateBusy, setDelegateBusy] = useState(false);
  const [delegateError, setDelegateError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [emailing, setEmailing] = useState(false);
  const [delegateEmailMsg, setDelegateEmailMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const parsedDelegates = useMemo(() => parseDelegates(delegateText), [delegateText]);
  const redeemUrl = (code: string) => `${origin}/tech-sandbox/redeem?code=${code}`;

  function onDelegateFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      setDelegateText((prev) => (prev ? prev + "\n" : "") + text);
    };
    reader.readAsText(file);
  }

  async function issueDelegates() {
    setDelegateBusy(true);
    setDelegateError(null);
    setAssignments(null);
    setDelegateEmailMsg(null);
    const res = await generateVouchersAction({
      functionId,
      count: parsedDelegates.length,
      organizationName: delegateOrg || undefined,
      delegates: parsedDelegates,
      mcqPct: delegateMcqPct,
    });
    setDelegateBusy(false);
    if ("error" in res) return setDelegateError(res.error);
    setAssignments(res.assignments.length ? res.assignments : null);
  }

  async function emailDelegates(codes: string[]) {
    setEmailing(true);
    setDelegateEmailMsg(null);
    const res = await emailVoucherCodesAction({ codes });
    setEmailing(false);
    if ("error" in res) return setDelegateEmailMsg({ ok: false, text: res.error });
    const failed = res.results.filter((r) => !r.ok);
    setDelegateEmailMsg({
      ok: res.sent > 0,
      text:
        `Emailed ${res.sent} of ${res.total} delegate(s).` +
        (failed.length ? ` Failed: ${failed.map((f) => f.email).join(", ")}.` : ""),
    });
  }

  async function testDb() {
    setBusy(true);
    setDbStatus(null);
    const res = await checkSandboxDbAction();
    setBusy(false);
    if ("error" in res) setDbStatus({ ok: false, msg: res.error });
    else setDbStatus({ ok: true, msg: res.detail ?? "Connected." });
  }

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
    setToken(null);
    setEmailMsg(null);
    const res = await createSandboxSessionAction({
      functionId,
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
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-foreground">SQL sandbox connection</h2>
          <button
            onClick={testDb}
            disabled={busy}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
          >
            Test sandbox DB
          </button>
        </div>
        {dbStatus && (
          <p className={`mt-2 text-sm ${dbStatus.ok ? "text-emerald-700" : "text-red-600"}`}>
            {dbStatus.ok ? "✓ " : "✗ "}
            {dbStatus.msg}
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Verifies SANDBOX_DATABASE_URL is reachable (required for SQL skill blocks).
        </p>
      </section>

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
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-1 font-medium text-foreground">Issue to named delegates</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Import a list of people and issue one personal code + redeem link each (for the function
          selected above). Ready to email per delegate or download as CSV.
        </p>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Delegates - &ldquo;Name, email&rdquo; one per line</span>
          <button type="button" onClick={() => fileRef.current?.click()} className="text-xs text-[#5391D5] hover:underline">
            Upload CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={onDelegateFile} className="hidden" />
        </div>
        <textarea
          value={delegateText}
          onChange={(e) => setDelegateText(e.target.value)}
          rows={6}
          placeholder={"John Smith, john@client.com\nSara Ali, sara@client.com"}
          className="w-full rounded-md border border-border bg-card p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#5391D5]"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {parsedDelegates.length} delegate(s) detected. From Excel: copy the Name and Email columns and
          paste, or Save As CSV and upload.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Client / organization (optional)</span>
            <input value={delegateOrg} onChange={(e) => setDelegateOrg(e.target.value)} className="rounded-md border border-border bg-card px-3 py-2 text-foreground" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">Knowledge (MCQ) section weight</span>
            <select
              value={delegateMcqPct}
              onChange={(e) => setDelegateMcqPct(Number(e.target.value))}
              className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
            >
              <option value={0}>Hands-on only (no knowledge section)</option>
              <option value={20}>20% knowledge · 80% hands-on</option>
              <option value={30}>30% knowledge · 70% hands-on</option>
              <option value={40}>40% knowledge · 60% hands-on</option>
              <option value={50}>50% knowledge · 50% hands-on</option>
              <option value={60}>60% knowledge · 40% hands-on</option>
              <option value={70}>70% knowledge · 30% hands-on</option>
            </select>
          </label>
        </div>
        <button
          onClick={issueDelegates}
          disabled={delegateBusy || !functionId || parsedDelegates.length === 0}
          className="mt-3 rounded-md bg-[#010131] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {delegateBusy ? "Issuing…" : `Issue ${parsedDelegates.length} delegate code(s)`}
        </button>
        {delegateError && <p className="mt-2 text-sm text-red-600">{delegateError}</p>}

        {assignments && (
          <div className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-emerald-800">{assignments.length} delegate code(s) generated</span>
              <div className="flex gap-2">
                <button
                  onClick={() => emailDelegates(assignments.map((a) => a.code))}
                  disabled={emailing}
                  className="rounded bg-emerald-600 px-3 py-1 text-xs text-white disabled:opacity-50"
                >
                  {emailing ? "Emailing…" : `Email ${assignments.length} delegate(s)`}
                </button>
                <button
                  onClick={() => {
                    const csv = "name,email,code,redeem_url\n" + assignments.map((a) => `${a.name},${a.email},${a.code},${redeemUrl(a.code)}`).join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const dl = document.createElement("a");
                    dl.href = URL.createObjectURL(blob);
                    dl.download = "technical-delegate-codes.csv";
                    dl.click();
                  }}
                  className="rounded border border-emerald-300 px-3 py-1 text-xs text-emerald-800"
                >
                  Download CSV (name · email · code · link)
                </button>
              </div>
            </div>
            {delegateEmailMsg && (
              <p className={`mb-2 text-xs ${delegateEmailMsg.ok ? "text-emerald-700" : "text-red-600"}`}>{delegateEmailMsg.text}</p>
            )}
            <div className="max-h-52 overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground"><tr><th className="p-1 text-start">Name</th><th className="p-1 text-start">Email</th><th className="p-1 text-start">Code</th></tr></thead>
                <tbody>
                  {assignments.map((a) => (
                    <tr key={a.code} className="border-t border-emerald-200/60">
                      <td className="p-1">{a.name}</td>
                      <td className="p-1">{a.email}</td>
                      <td className="p-1 font-mono">{a.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-emerald-700">Delegates redeem at <span className="font-mono">{origin}/tech-sandbox/redeem</span></p>
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
