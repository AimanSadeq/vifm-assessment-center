import { FileText } from "lucide-react";

// Server component (presentational): lists everyone who has taken or been issued
// this role's Role Readiness assessment, with their verdict + a report link.
// Admin-scoped - shows candidates across ALL clients AND direct/sample links
// (the client-portal tracking page only shows one org's candidates, so an
// unassigned sample like the HR-GM seed never appears there).

export type RrCandidateRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
  verdict: string;
  access_token: string;
  completed_at: string | null;
};

function VerdictPill({ v }: { v: string }) {
  if (v === "ready")
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Ready</span>;
  if (v === "not_ready")
    return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Not ready</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">In progress</span>;
}

export function RoleResultsPanel({ candidates }: { candidates: RrCandidateRow[] }) {
  const completed = candidates.filter((c) => c.completed_at).length;
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">Results / candidates</h2>
        <span className="text-xs text-muted-foreground">
          {candidates.length} invited · {completed} completed
        </span>
      </div>
      <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
        Everyone who has taken (or been issued) this role&apos;s assessment - across all clients and direct sample
        links. Open a finished candidate&apos;s report, or copy their apply link to resend.
      </p>
      {candidates.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No candidates yet. Issue a link from the &ldquo;Issue vouchers&rdquo; panel below.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Candidate</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Verdict</th>
                <th className="py-2 pr-3 text-end"></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-foreground">{c.full_name || "(no name yet)"}</div>
                    {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{c.status}</td>
                  <td className="py-2 pr-3"><VerdictPill v={c.verdict} /></td>
                  <td className="py-2 pr-3 text-end">
                    {c.completed_at ? (
                      <a
                        href={`/api/role-readiness/${c.access_token}/report`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#5391D5] hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" /> Report (PDF)
                      </a>
                    ) : (
                      <a
                        href={`/role-readiness/apply/${c.access_token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-semibold text-[#5391D5] hover:underline"
                      >
                        Apply link
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
