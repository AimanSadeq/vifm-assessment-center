"use client";

import { useMemo, useState } from "react";
import { Boxes, FileText, Search, Award } from "lucide-react";
import { InviteManagerDialog } from "@/app/portal/bundle/[id]/_components/invite-manager-dialog";

// Completed bespoke BUNDLE candidates (the one-sitting Persona + Logica flow)
// with their two reports: the Combined report and the High-Potential Profile.
// Mirrors the Role Readiness AllReportsPanel so every bespoke report is
// findable from the same admin page.

export type BundleReportRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  completedAt: string | null;
  bundleName: string;
  clientName: string;
  hasPersona: boolean;
  /** organizations.id - lets the admin invite the manager scoped to the org. */
  orgId: string | null;
};

function fmtDate(s: string | null): string {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
}

export function BundleReportsPanel({ reports }: { reports: BundleReportRow[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return reports;
    return reports.filter((r) =>
      [r.fullName, r.email, r.bundleName, r.clientName]
        .filter(Boolean)
        .some((x) => (x as string).toLowerCase().includes(t)),
    );
  }, [q, reports]);

  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-[#5391D5]" />
          <h2 className="text-sm font-semibold text-foreground">Bundle reports (one-sitting)</h2>
        </div>
        <span className="text-xs text-muted-foreground">{reports.length} completed</span>
      </div>
      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
        Completed bespoke-bundle candidates. Each has a Combined report; sittings that include Persona also
        generate the High-Potential Profile.
      </p>

      {reports.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No completed bundle sittings yet.</p>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search candidate, email, bundle or client…"
              className="w-full bg-transparent text-sm text-foreground outline-none"
            />
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Candidate</th>
                  <th className="py-2 pr-3">Bundle</th>
                  <th className="py-2 pr-3">Client</th>
                  <th className="py-2 pr-3">Completed</th>
                  <th className="py-2 pr-3 text-end">Reports</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-foreground">{r.fullName || "(no name)"}</div>
                      {r.email && <div className="text-xs text-muted-foreground">{r.email}</div>}
                    </td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.bundleName}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.clientName}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">{fmtDate(r.completedAt)}</td>
                    <td className="py-2 pr-3">
                      <div className="flex flex-wrap justify-end gap-3">
                        <a
                          href={`/api/admin/bundle/${r.id}/report`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#5391D5] hover:underline"
                        >
                          <FileText className="h-3.5 w-3.5" /> Combined
                        </a>
                        {r.hasPersona && (
                          <>
                            <a
                              href={`/api/admin/bundle/${r.id}/hipo-report`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#5391D5] hover:underline"
                            >
                              <Award className="h-3.5 w-3.5" /> High-Potential
                            </a>
                            <InviteManagerDialog
                              candidateId={r.id}
                              candidateName={r.fullName || "this candidate"}
                              orgParam={r.orgId ?? undefined}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-3 text-sm text-muted-foreground">
                      No bundle reports match &ldquo;{q}&rdquo;.
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
