"use client";

import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";

// Central Reports list for the Bespoke Services section: every COMPLETED Role
// Readiness candidate report, across all roles + clients, searchable so the
// admin can retrieve any one report from a single place. Presentational client
// component (search filter only); the page server-fetches + enriches the rows.

export type BespokeReport = {
  id: string;
  fullName: string | null;
  email: string | null;
  verdict: string;
  accessToken: string;
  completedAt: string | null;
  roleName: string;
  clientName: string;
};

function VerdictPill({ v }: { v: string }) {
  if (v === "ready")
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Ready</span>;
  if (v === "not_ready")
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Not ready</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">Complete</span>;
}

function fmtDate(s: string | null): string {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
}

export function AllReportsPanel({ reports }: { reports: BespokeReport[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return reports;
    return reports.filter((r) =>
      [r.fullName, r.email, r.roleName, r.clientName]
        .filter(Boolean)
        .some((x) => (x as string).toLowerCase().includes(t)),
    );
  }, [q, reports]);

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#5391D5]" />
          <h2 className="text-sm font-semibold text-foreground">Reports</h2>
        </div>
        <span className="text-xs text-muted-foreground">{reports.length} completed</span>
      </div>
      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
        Every completed Bespoke assessment report, across all roles and clients. Search a name, email, role or client
        to retrieve a report.
      </p>

      {reports.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No completed reports yet.</p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search candidate, email, role or client…"
              className="w-full bg-transparent text-sm text-foreground outline-none"
            />
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Candidate</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Verdict</th>
                  <th className="py-2 pr-3">Completed</th>
                  <th className="py-2 pr-3 text-end"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-foreground">{r.fullName || "(no name)"}</div>
                      {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.roleName}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.clientName}</td>
                    <td className="py-2 pr-3"><VerdictPill v={r.verdict} /></td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{fmtDate(r.completedAt)}</td>
                    <td className="py-2 pr-3 text-end">
                      <a
                        href={`/api/role-readiness/${r.accessToken}/report`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#5391D5] hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" /> Report (PDF)
                      </a>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-3 text-sm text-muted-foreground">
                      No reports match &ldquo;{q}&rdquo;.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
