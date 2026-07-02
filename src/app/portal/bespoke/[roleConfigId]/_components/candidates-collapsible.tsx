"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export type Cand = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  verdict: string;
  access_token: string;
  completed_at: string | null;
};

const verdictPill = (v: string) => {
  if (v === "ready") return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Ready</span>;
  if (v === "not_ready") return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Not ready</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">In progress</span>;
};

// The candidate roster for a bespoke programme, collapsed by default so the
// client sees the summary count first and expands to view the list.
export function CandidatesCollapsible({ candidates, completed }: { candidates: Cand[]; completed: number }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border bg-card p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <h2 className="text-sm font-semibold">
          Candidates{" "}
          <span className="font-normal text-muted-foreground">
            ({candidates.length}
            {completed ? ` · ${completed} completed` : ""})
          </span>
        </h2>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open &&
        (candidates.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No candidates invited yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Candidate</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Verdict</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-foreground">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{c.status}</td>
                  <td className="py-2 pr-3">{verdictPill(c.verdict)}</td>
                  <td className="py-2 pr-3 text-end">
                    {c.completed_at ? (
                      <a href={`/api/role-readiness/${c.access_token}/report`} target="_blank" rel="noreferrer"
                        className="text-xs font-semibold text-[#5391D5] hover:underline">Report (PDF)</a>
                    ) : (
                      <a href={`/role-readiness/apply/${c.access_token}`} target="_blank" rel="noreferrer"
                        className="text-xs font-semibold text-[#5391D5] hover:underline">Apply link</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </div>
  );
}
