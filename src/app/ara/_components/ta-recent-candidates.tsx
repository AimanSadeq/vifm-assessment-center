import Link from "next/link";
import { Users, ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { isStaffCaller } from "@/lib/ara/auth-guards";

type Row = {
  id: string;
  created_at: string;
  scope_label: string | null;
  respondent:
    | { name: string; email: string; completed_at: string | null; access_token: string | null }[]
    | null;
};

/**
 * "Review a candidate" list for the Talent-Acquisition landing.
 *
 * Lists the acquisition-lensed personal deep-dives the consultant has issued
 * (engagement_stage='individual' + talent_lens='acquisition'), so after a
 * candidate completes, staff can come straight back to ARC TA and open their
 * results - the review counterpart to the "Assess a candidate" issue card.
 *
 * STAFF-ONLY: /ara is a public, auth-bypassed route, so this must never render
 * candidate names or result links to a non-staff visitor. Renders null unless
 * isStaffCaller() (the results page is independently staff-gated too).
 */
export async function TaRecentCandidates() {
  const staff = await isStaffCaller();
  if (!staff) return null;

  const sb = createServiceClient();
  const { data } = await sb
    .from("ara_assessments")
    .select(
      "id, created_at, scope_label, respondent:ara_respondents(name, email, completed_at, access_token)",
    )
    .eq("engagement_stage", "individual")
    .eq("talent_lens", "acquisition")
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<Row[]>();

  const rows = (data ?? []).map((a) => {
    const r = Array.isArray(a.respondent) ? a.respondent[0] : a.respondent;
    return {
      id: a.id,
      created_at: a.created_at,
      name: r?.name ?? a.scope_label ?? "Candidate",
      email: r?.email ?? null,
      completed: !!r?.completed_at,
      token: r?.access_token ?? null,
    };
  });

  return (
    <section className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <span className="ara-eyebrow text-muted-foreground">
            <Users className="h-3 w-3" /> Your candidates
          </span>
          <h2 className="text-2xl font-semibold text-primary mt-2">Review a candidate</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Candidates you have issued the deep-dive to. Open a completed candidate&apos;s results to
            review their factor-by-factor read.
          </p>
        </div>
        <Link
          href="/ara/consultant"
          className="text-sm text-accent inline-flex items-center gap-1 shrink-0 whitespace-nowrap"
        >
          View all in dashboard <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          No candidates issued yet. Use the &quot;Assess a candidate&quot; card above to issue your first deep-dive.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Candidate</th>
                <th className="px-4 py-2.5 font-medium">Issued</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium text-end">Results</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-2.5">
                    <div className="font-medium text-primary">{row.name}</div>
                    {row.email && <div className="text-[11px] text-muted-foreground">{row.email}</div>}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                    {new Date(row.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.completed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        <CheckCircle2 className="h-3 w-3" /> Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        <Clock className="h-3 w-3" /> In progress
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    {row.completed && row.token ? (
                      <Link
                        href={`/ara/personal/results/${row.token}`}
                        className="inline-flex items-center gap-1 font-medium text-accent"
                      >
                        View results <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
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
