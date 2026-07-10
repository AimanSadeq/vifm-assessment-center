import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users, Sparkles, FileText, Layers } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { overallSelfScore, type PersonaScoreRow } from "@/lib/scoring/behavioral";
import { personaBand, personaBandLabel, PERSONA_BAND_TW, type PersonaBandKey } from "@/lib/scoring/persona-bands";

export const dynamic = "force-dynamic";

export const metadata = { title: "Persona® · Cohort report" };

type Session = {
  id: string;
  created_at: string;
  submitted_at: string | null;
  taker_name: string | null;
  status: string;
  organization?: { name: string } | { name: string }[] | null;
};

type Row = Session & { overall: number | null; itemCount: number };

/** Resolve the (possibly array-shaped) joined org name. */
function orgName(r: { organization?: { name: string } | { name: string }[] | null }): string | null {
  const o = r.organization;
  if (!o) return null;
  return Array.isArray(o) ? o[0]?.name ?? null : o.name ?? null;
}

const BAND_BORDER: Record<PersonaBandKey, string> = {
  exceptional: "border-emerald-300",
  proficient: "border-sky-300",
  developing: "border-amber-300",
  requires_focus: "border-orange-300",
  critical: "border-rose-300",
};
const DIST_ORDER: PersonaBandKey[] = ["exceptional", "proficient", "developing", "requires_focus", "critical"];

type LoadResp = { data: Session[] | null; error: unknown };

async function loadRows(orgFilter: string | null): Promise<Row[] | null> {
  try {
    const sb = createServiceClient();
    // When a client is selected, scope by organization_id at the QUERY level so
    // the 500-row cap applies to THIS client's sittings - not a global most-recent
    // 500 slice that (when other clients are busier) truncates or empties the
    // selected client's cohort and skews its count/average/distribution.
    let orgIds: string[] | null = null;
    if (orgFilter) {
      const { data: orgs } = await sb.from("organizations").select("id").eq("name", orgFilter);
      orgIds = (orgs ?? []).map((o) => o.id as string);
      if (orgIds.length === 0) return [];
    }
    const base = "id, created_at, submitted_at, taker_name, status";
    const query = (cols: string) => {
      let q = sb
        .from("behavioral_assessment_sessions")
        .select(cols)
        .eq("status", "submitted")
        .is("candidate_id", null) // standalone (voucher/self-served) runs only
        .order("created_at", { ascending: false })
        .limit(500);
      if (orgIds) q = q.in("organization_id", orgIds);
      return q;
    };
    // Graceful degradation: try with the client-org join (00106), then the base.
    let res = (await query(base + ", organization:organizations(name)")) as unknown as LoadResp;
    if (res.error) res = (await query(base)) as unknown as LoadResp;
    if (res.error) return null;
    const sessions = res.data ?? [];
    if (sessions.length === 0) return [];

    // Overall self-rating per session, ipsative-aware. Range-paginate the response
    // fetch: the API caps a single select at ~1000 rows, so an unpaged fetch would
    // silently drop the answers for most sittings beyond ~4 (the D360 incident).
    const ids = sessions.map((s) => s.id);
    type RespRow = PersonaScoreRow & { session_id: string };
    const responses: RespRow[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from("behavioral_assessment_responses")
        .select("session_id, competency_id, raw_score, is_reverse, item_type, answer_data")
        .in("session_id", ids)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      responses.push(...(data as unknown as RespRow[]));
      if (data.length < PAGE) break;
    }
    const bySession = new Map<string, PersonaScoreRow[]>();
    for (const r of responses) {
      const sid = r.session_id;
      if (!bySession.has(sid)) bySession.set(sid, []);
      bySession.get(sid)!.push(r);
    }
    return sessions.map((s) => {
      const rows = bySession.get(s.id) ?? [];
      return { ...s, overall: overallSelfScore(rows), itemCount: rows.length };
    });
  } catch {
    return null;
  }
}

export default async function PersonaCohortPage({ searchParams }: { searchParams?: { org?: string } }) {
  // Admin-only: this surfaces taker names, client-org names and self-ratings
  // across every organisation (service-role read, RLS bypassed). Middleware only
  // enforces authentication, so without this gate any authenticated non-admin
  // could read cross-tenant PII. Mirrors the sibling results/vouchers/retention
  // pages exactly.
  const caller = await getCurrentCaller();
  if (!caller || caller.role !== "admin") return notFound();

  const orgFilter = searchParams?.org?.trim() || null;
  // Chips come from the UNfiltered set so every client stays selectable; the table
  // rows come from an org-scoped re-query when a client is picked, so the 500-row
  // cap applies to THAT client, not a global most-recent-500 slice.
  const allRows = await loadRows(null);
  const rows = orgFilter ? await loadRows(orgFilter) : allRows;

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <Link
            href="/ac/persona"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Persona®
          </Link>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#5391D5]" />
            <h1 className="text-xl font-semibold text-[#010131]">Persona® cohort report</h1>
            <span className="ml-2 rounded-full bg-[#5391D5]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#5391D5]">
              Self-report
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Aggregate behavioural self-assessment results across the 41 competencies. These are indicative
            self-reports; pair Persona (self) with Reflect 360 (others) against a target role for a readiness verdict.
          </p>
          <Link href="/admin/cohorts" className="mt-2 inline-block text-xs font-medium text-[#5391D5] hover:underline">
            View combined project cohorts (Persona + Logica) →
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {rows === null && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>No result store.</strong> Apply migration{" "}
            <code className="text-xs">00094_behavioral_assessment.sql</code> to enable cohort reporting.
          </div>
        )}

        {rows !== null && rows.length === 0 && (
          <div className="rounded-lg border bg-white px-4 py-10 text-center text-sm text-muted-foreground shadow-sm">
            No Persona results yet.{" "}
            <Link href="/ac/persona" className="text-[#5391D5] underline">
              Run the assessment
            </Link>{" "}
            to populate this report.
          </div>
        )}

        {/* Client filter chips - org-scoped results (each voucher-redeemed run
            carries its client org). */}
        {allRows && allRows.length > 0 && (() => {
          const clientsList = Array.from(new Set(allRows.map(orgName).filter((n): n is string => !!n))).sort();
          if (clientsList.length === 0) return null;
          return (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">Client:</span>
              <Link
                href="/ac/persona/cohort"
                className={`rounded-full border px-2.5 py-0.5 ${!orgFilter ? "border-[#5391D5] bg-[#5391D5]/10 text-[#5391D5] font-medium" : "text-slate-600 hover:bg-slate-100"}`}
              >
                All
              </Link>
              {clientsList.map((c) => (
                <Link
                  key={c}
                  href={`/ac/persona/cohort?org=${encodeURIComponent(c)}`}
                  className={`rounded-full border px-2.5 py-0.5 ${orgFilter === c ? "border-[#5391D5] bg-[#5391D5]/10 text-[#5391D5] font-medium" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {c}
                </Link>
              ))}
            </div>
          );
        })()}

        {rows !== null && rows.length > 0 && <CohortBody rows={rows} />}
      </main>
    </div>
  );
}

function CohortBody({ rows }: { rows: Row[] }) {
  const total = rows.length;
  const scored = rows.filter((r) => r.overall != null);
  const avg = scored.length
    ? Math.round((scored.reduce((a, r) => a + (r.overall ?? 0), 0) / scored.length) * 100) / 100
    : null;

  const dist = DIST_ORDER.map((key) => ({
    key,
    n: scored.filter((r) => personaBand(r.overall as number).key === key).length,
  }));
  const maxN = Math.max(1, ...dist.map((d) => d.n));

  return (
    <>
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Assessments taken" value={String(total)} />
        <StatCard
          label="Average self-rating"
          value={avg != null ? avg.toFixed(2) : "-"}
          bandKey={avg != null ? personaBand(avg).key : undefined}
        />
        <StatCard label="Scored" value={`${scored.length}/${total}`} />
      </div>

      {/* Band distribution */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#010131]">
          <Sparkles className="h-4 w-4 text-[#5391D5]" /> Overall self-rating distribution
        </h2>
        <div className="space-y-2">
          {dist.map((d) => (
            <div key={d.key} className="flex items-center gap-3 text-xs">
              <span className={`w-28 shrink-0 rounded border px-1.5 py-0.5 text-center font-semibold ${PERSONA_BAND_TW[d.key]} ${BAND_BORDER[d.key]}`}>
                {personaBandLabel(bandMid(d.key), false)}
              </span>
              <div className="flex-1 rounded-full bg-slate-100">
                <div
                  className="h-4 rounded-full bg-[#5391D5]"
                  style={{ width: `${(d.n / maxN) * 100}%`, minWidth: d.n > 0 ? "1.25rem" : "0" }}
                />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums text-slate-500">{d.n}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Individual results */}
      <section className="rounded-xl border bg-white shadow-sm">
        <h2 className="border-b px-6 py-4 text-sm font-semibold text-[#010131]">Individual results</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-3 py-2.5 text-center font-medium">Self-rating</th>
                <th className="px-3 py-2.5 text-center font-medium">Band</th>
                <th className="px-3 py-2.5 text-center font-medium">Items</th>
                <th className="px-4 py-2.5 font-medium">Report</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                    {new Date(r.submitted_at ?? r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-[#111232]">{r.taker_name || <span className="text-slate-400">Anonymous</span>}</td>
                  <td className="px-4 py-2.5 text-slate-500">{orgName(r) ?? <span className="text-slate-300">-</span>}</td>
                  <td className="px-3 py-2.5 text-center font-semibold text-[#010131]">{r.overall != null ? r.overall.toFixed(2) : <span className="text-slate-300">-</span>}</td>
                  <td className="px-3 py-2.5 text-center">
                    {r.overall != null ? (
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${PERSONA_BAND_TW[personaBand(r.overall).key]}`}>
                        {personaBandLabel(r.overall, false)}
                      </span>
                    ) : (
                      <span className="text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-500 tabular-nums">{r.itemCount || "-"}</td>
                  <td className="px-4 py-2.5">
                    {r.itemCount > 0 ? (
                      <a
                        href={`/api/ac/persona/${r.id}/report`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#5391D5] hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" /> Open report
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-300">
                        <Layers className="h-3.5 w-3.5" /> -
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/** A representative score inside each band, for labelling the distribution row. */
function bandMid(key: PersonaBandKey): number {
  switch (key) {
    case "exceptional": return 4.75;
    case "proficient": return 4.0;
    case "developing": return 3.0;
    case "requires_focus": return 2.0;
    case "critical": return 1.0;
  }
}

function StatCard({ label, value, bandKey }: { label: string; value: string; bandKey?: PersonaBandKey }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${bandKey ? `inline-block rounded-md px-2 ${PERSONA_BAND_TW[bandKey]}` : "text-[#010131]"}`}>
        {value}
      </p>
    </div>
  );
}
