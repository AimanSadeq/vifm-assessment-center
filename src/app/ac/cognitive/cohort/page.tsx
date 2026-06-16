import Link from "next/link";
import { ArrowLeft, Users, Sparkles, FileText, BrainCircuit } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { COGNITIVE_SUBTESTS, BAND_LABEL_EN, type PsyBand } from "@/lib/psychometrics/framework";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cognitive · Cohort report" };

type ScaleJson = { key: string; raw: number; normalized: number; band: PsyBand; bandLabel?: string };
type Row = {
  id: string;
  created_at: string;
  taker_name: string | null;
  taker_email: string | null;
  scales: ScaleJson[] | null;
  overall: { normalized: number; band: PsyBand; bandLabel?: string } | null;
  organization?: { name: string } | { name: string }[] | null;
};

/** Resolve the (possibly array-shaped) joined org name. */
function orgName(r: Row): string | null {
  const o = r.organization;
  if (!o) return null;
  return Array.isArray(o) ? o[0]?.name ?? null : o.name ?? null;
}

const BAND_TONE: Record<string, string> = {
  low: "bg-rose-100 text-rose-800 border-rose-300",
  below: "bg-amber-100 text-amber-800 border-amber-300",
  average: "bg-sky-100 text-sky-800 border-sky-300",
  above: "bg-emerald-100 text-emerald-800 border-emerald-300",
  high: "bg-emerald-200 text-emerald-900 border-emerald-400",
};
const DIST_ORDER: PsyBand[] = ["high", "above", "average", "below", "low"];

const subtestName = (key: string): string =>
  COGNITIVE_SUBTESTS.find((s) => s.key === key)?.name_en ?? key;

function bandFromPct(pct: number): PsyBand {
  if (pct >= 80) return "high";
  if (pct >= 65) return "above";
  if (pct >= 45) return "average";
  if (pct >= 30) return "below";
  return "low";
}

type LoadResp = { data: Row[] | null; error: unknown };

async function loadRows(): Promise<Row[] | null> {
  try {
    const sb = createServiceClient();
    const base = "id, created_at, taker_name, taker_email, scales, overall";
    const query = (cols: string) =>
      sb
        .from("psy_results")
        .select(cols)
        .eq("kind", "cognitive")
        .order("created_at", { ascending: false })
        .limit(500);
    // Graceful degradation: try with the client-org join (00105), then the base.
    let res = (await query(base + ", organization:organizations(name)")) as unknown as LoadResp;
    if (res.error) res = (await query(base)) as unknown as LoadResp;
    if (res.error) return null;
    return res.data ?? [];
  } catch {
    return null;
  }
}

export default async function CognitiveCohortPage({ searchParams }: { searchParams?: { org?: string } }) {
  const allRows = await loadRows();
  const orgFilter = searchParams?.org?.trim() || null;
  const rows = allRows && orgFilter ? allRows.filter((r) => orgName(r) === orgFilter) : allRows;

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      <header className="border-b bg-white">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <Link
            href="/ac/cognitive"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Cognitive
          </Link>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#5391D5]" />
            <h1 className="text-xl font-semibold text-[#010131]">Cognitive cohort report</h1>
            <span className="ml-2 rounded-full bg-[#5391D5]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#5391D5]">
              Indicative
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Aggregate cognitive-ability results (numerical / verbal / inductive / deductive reasoning). Tier 1 bands are based on
            raw scores, not local norms.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {rows === null && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>No result store.</strong> Apply migration{" "}
            <code className="text-xs">00065_psychometrics.sql</code> to enable cohort reporting.
          </div>
        )}

        {rows !== null && rows.length === 0 && (
          <div className="rounded-lg border bg-white px-4 py-10 text-center text-sm text-muted-foreground shadow-sm">
            No cognitive results yet.{" "}
            <Link href="/ac/cognitive" className="text-[#5391D5] underline">
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
                href="/ac/cognitive/cohort"
                className={`rounded-full border px-2.5 py-0.5 ${!orgFilter ? "border-[#5391D5] bg-[#5391D5]/10 text-[#5391D5] font-medium" : "text-slate-600 hover:bg-slate-100"}`}
              >
                All
              </Link>
              {clientsList.map((c) => (
                <Link
                  key={c}
                  href={`/ac/cognitive/cohort?org=${encodeURIComponent(c)}`}
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

function gPct(r: Row): number | null {
  if (r.overall && typeof r.overall.normalized === "number") return r.overall.normalized;
  if (r.scales && r.scales.length) {
    return Math.round(r.scales.reduce((a, s) => a + (s.normalized ?? 0), 0) / r.scales.length);
  }
  return null;
}

function CohortBody({ rows }: { rows: Row[] }) {
  const total = rows.length;
  const gValues = rows.map(gPct).filter((v): v is number => v != null);
  const gAvg = gValues.length ? Math.round(gValues.reduce((a, b) => a + b, 0) / gValues.length) : null;

  // Band distribution by overall g.
  const dist = DIST_ORDER.map((b) => ({
    band: b,
    n: rows.filter((r) => {
      const g = gPct(r);
      return g != null && bandFromPct(g) === b;
    }).length,
  }));
  const maxN = Math.max(1, ...dist.map((d) => d.n));

  // Per-subtest averages (across whichever rows have that subtest).
  const subtestAverages = COGNITIVE_SUBTESTS.map((st) => {
    const vals = rows
      .map((r) => r.scales?.find((s) => s.key === st.key)?.normalized)
      .filter((v): v is number => typeof v === "number");
    return {
      key: st.key,
      name: st.name_en,
      avg: vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null,
      n: vals.length,
    };
  });

  return (
    <>
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Tests taken" value={String(total)} />
        <StatCard label="Average g" value={gAvg != null ? `${gAvg}%` : "-"} tone={gAvg != null ? bandFromPct(gAvg) : undefined} />
        <StatCard label="Scored" value={`${gValues.length}/${total}`} />
      </div>

      {/* g distribution */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#010131]">
          <Sparkles className="h-4 w-4 text-[#5391D5]" /> Overall (g) band distribution
        </h2>
        <div className="space-y-2">
          {dist.map((d) => (
            <div key={d.band} className="flex items-center gap-3 text-xs">
              <span className={`w-20 shrink-0 rounded border px-1.5 py-0.5 text-center font-semibold ${BAND_TONE[d.band]}`}>
                {BAND_LABEL_EN[d.band]}
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

      {/* Per-subtest averages */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-[#010131]">Average by subtest</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {subtestAverages.map((s) => (
            <div key={s.key} className="rounded-lg border border-slate-200 p-4 text-center">
              <BrainCircuit className="mx-auto h-4 w-4 text-[#5391D5]" />
              <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-500">{s.name}</p>
              <p className={`mt-1 inline-block rounded-md border px-2 text-xl font-bold ${s.avg != null ? BAND_TONE[bandFromPct(s.avg)] : "text-slate-400"}`}>
                {s.avg != null ? `${s.avg}%` : "-"}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">{s.n > 0 ? `${s.n} assessed` : "no data"}</p>
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
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-3 py-2.5 text-center font-medium">g</th>
                {COGNITIVE_SUBTESTS.map((st) => (
                  <th key={st.key} className="px-3 py-2.5 text-center font-medium">{subtestName(st.key).split(" ")[0]}</th>
                ))}
                <th className="px-4 py-2.5 font-medium">Report</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const g = gPct(r);
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                      {new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-[#111232]">{r.taker_name || <span className="text-slate-400">Anonymous</span>}</td>
                    <td className="px-4 py-2.5 text-slate-500">{r.taker_email || "-"}</td>
                    <td className="px-4 py-2.5 text-slate-500">{orgName(r) ?? <span className="text-slate-300">-</span>}</td>
                    <td className="px-3 py-2.5 text-center">
                      {g != null ? (
                        <span className={`inline-block rounded border px-1.5 py-0.5 text-xs font-bold ${BAND_TONE[bandFromPct(g)]}`}>{g}%</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    {COGNITIVE_SUBTESTS.map((st) => {
                      const v = r.scales?.find((s) => s.key === st.key)?.normalized;
                      return (
                        <td key={st.key} className="px-3 py-2.5 text-center text-slate-600">
                          {typeof v === "number" ? `${v}%` : "-"}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2.5">
                      <a
                        href={`/api/ac/cognitive/${r.id}/report`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#5391D5] hover:underline"
                      >
                        <FileText className="h-3.5 w-3.5" /> Open report
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone ? `inline-block rounded-md border px-2 ${BAND_TONE[tone]}` : "text-[#010131]"}`}>
        {value}
      </p>
    </div>
  );
}
