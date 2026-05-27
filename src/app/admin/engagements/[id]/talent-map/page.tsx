export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Grid3x3, TrendingUp, Users, Award, Layers } from "lucide-react";
import {
  scoreBand,
  nineBoxCell,
  meanOrNull,
  heatmapTone,
  PERFORMANCE_DOMAINS,
  POTENTIAL_DOMAINS,
  SUCCESSION_META,
  SUCCESSION_ORDER,
  type TalentBand,
  type SuccessionKey,
  type NineBoxCell,
} from "@/lib/scoring/talent-map";

type Props = { params: { id: string } };

type DomainRef = { name: string; sort_order: number } | null;
type ClusterRef = { competency_domains: DomainRef } | null;
type CompetencyRef = { name: string; competency_clusters: ClusterRef } | null;

type ConsensusRow = {
  candidate_id: string;
  competency_id: string;
  final_score: number;
  competencies: CompetencyRef;
};

type OarRow = {
  candidate_id: string;
  overall_score: number;
  recommendation: "ready_now" | "ready_with_development" | "not_ready";
};

type CandidateRow = { id: string; full_name: string; email: string | null };

// Domain tints for the heatmap column groups (matches the H1/H2 palette).
const DOMAIN_TINT: Record<string, string> = {
  THINKING: "bg-blue-50 text-blue-700",
  RESULTS: "bg-emerald-50 text-emerald-700",
  PEOPLE: "bg-orange-50 text-orange-700",
  SELF: "bg-violet-50 text-violet-700",
};

const TONE_CLASSES: Record<NineBoxCell["tone"], { border: string; bg: string; label: string }> = {
  emerald: { border: "border-emerald-300", bg: "bg-emerald-50", label: "text-emerald-800" },
  sky: { border: "border-sky-300", bg: "bg-sky-50", label: "text-sky-800" },
  slate: { border: "border-slate-300", bg: "bg-slate-50", label: "text-slate-700" },
  amber: { border: "border-amber-300", bg: "bg-amber-50", label: "text-amber-800" },
  rose: { border: "border-rose-300", bg: "bg-rose-50", label: "text-rose-800" },
};

const SUCCESSION_TONE: Record<string, { bar: string; chip: string }> = {
  emerald: { bar: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-800" },
  amber: { bar: "bg-amber-500", chip: "bg-amber-100 text-amber-800" },
  rose: { bar: "bg-rose-500", chip: "bg-rose-100 text-rose-800" },
  slate: { bar: "bg-slate-400", chip: "bg-slate-100 text-slate-700" },
};

type Placed = {
  id: string;
  name: string;
  performance: number;
  potential: number;
  perfBand: TalentBand;
  potBand: TalentBand;
};

export default async function TalentMapPage({ params }: Props) {
  const engagementId = params.id;

  let engName = "";
  let orgName = "-";
  let targetRole: string | null = null;
  let status = "";
  let candidates: CandidateRow[] = [];
  let consensus: ConsensusRow[] = [];
  let oarRows: OarRow[] = [];

  try {
    const sb = createServiceClient();

    const engRes = (await sb
      .from("engagements")
      .select("id, name, status, target_role, organizations(name)")
      .eq("id", engagementId)
      .maybeSingle()) as {
      data: {
        name: string;
        status: string;
        target_role: string | null;
        organizations: { name: string } | { name: string }[] | null;
      } | null;
    };
    if (!engRes.data) return notFound();
    engName = engRes.data.name;
    status = engRes.data.status;
    targetRole = engRes.data.target_role;
    const org = engRes.data.organizations;
    orgName = Array.isArray(org) ? org[0]?.name ?? "-" : org?.name ?? "-";

    const [candRes, consRes, oarRes] = await Promise.all([
      sb
        .from("candidates")
        .select("id, full_name, email")
        .eq("engagement_id", engagementId)
        .order("full_name"),
      sb
        .from("consensus_ratings")
        .select(
          "candidate_id, competency_id, final_score, " +
            "competencies(name, competency_clusters(competency_domains(name, sort_order)))"
        )
        .eq("engagement_id", engagementId),
      sb
        .from("overall_assessment_ratings")
        .select("candidate_id, overall_score, recommendation")
        .eq("engagement_id", engagementId),
    ]);
    candidates = (candRes.data as CandidateRow[] | null) ?? [];
    consensus = (consRes.data as unknown as ConsensusRow[] | null) ?? [];
    oarRows = (oarRes.data as OarRow[] | null) ?? [];
  } catch {
    return notFound();
  }

  const domainOf = (row: ConsensusRow): string | null =>
    row.competencies?.competency_clusters?.competency_domains?.name ?? null;

  // ---- Per-candidate axis maths for the 9-box -----------------------------
  const scoresByCand = new Map<string, ConsensusRow[]>();
  for (const r of consensus) {
    if (!scoresByCand.has(r.candidate_id)) scoresByCand.set(r.candidate_id, []);
    scoresByCand.get(r.candidate_id)!.push(r);
  }

  const placed: Placed[] = [];
  const unscored: CandidateRow[] = [];
  for (const c of candidates) {
    const rows = scoresByCand.get(c.id) ?? [];
    if (rows.length === 0) {
      unscored.push(c);
      continue;
    }
    const all = rows.map((r) => r.final_score);
    const perf =
      meanOrNull(
        rows.filter((r) => PERFORMANCE_DOMAINS.includes((domainOf(r) ?? "") as never)).map((r) => r.final_score)
      ) ?? meanOrNull(all)!;
    const pot =
      meanOrNull(
        rows.filter((r) => POTENTIAL_DOMAINS.includes((domainOf(r) ?? "") as never)).map((r) => r.final_score)
      ) ?? meanOrNull(all)!;
    placed.push({
      id: c.id,
      name: c.full_name,
      performance: perf,
      potential: pot,
      perfBand: scoreBand(perf),
      potBand: scoreBand(pot),
    });
  }

  // 9-box grid buckets, keyed [potBand][perfBand].
  const grid: Record<TalentBand, Record<TalentBand, Placed[]>> = {
    high: { low: [], med: [], high: [] },
    med: { low: [], med: [], high: [] },
    low: { low: [], med: [], high: [] },
  };
  for (const p of placed) grid[p.potBand][p.perfBand].push(p);

  // ---- Succession buckets from OAR ----------------------------------------
  const oarByCand = new Map(oarRows.map((o) => [o.candidate_id, o]));
  const succession: Record<SuccessionKey, CandidateRow[]> = {
    ready_now: [],
    ready_with_development: [],
    not_ready: [],
    unassessed: [],
  };
  for (const c of candidates) {
    const oar = oarByCand.get(c.id);
    succession[(oar?.recommendation as SuccessionKey) ?? "unassessed"].push(c);
  }

  // ---- Skills heatmap matrix ----------------------------------------------
  const compMeta = new Map<string, { name: string; domain: string; domainSort: number }>();
  for (const r of consensus) {
    if (compMeta.has(r.competency_id)) continue;
    const d = r.competencies?.competency_clusters?.competency_domains;
    compMeta.set(r.competency_id, {
      name: r.competencies?.name ?? "(unknown)",
      domain: d?.name ?? "OTHER",
      domainSort: d?.sort_order ?? 99,
    });
  }
  const orderedComps = Array.from(compMeta.entries())
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => a.domainSort - b.domainSort || a.name.localeCompare(b.name));

  // Domain column-group runs (orderedComps is already domain-contiguous).
  const domainGroups: { domain: string; span: number }[] = [];
  for (const comp of orderedComps) {
    const last = domainGroups[domainGroups.length - 1];
    if (last && last.domain === comp.domain) last.span += 1;
    else domainGroups.push({ domain: comp.domain, span: 1 });
  }

  const scoreAt = new Map<string, number>(); // `${candId}:${compId}` -> score
  for (const r of consensus) scoreAt.set(`${r.candidate_id}:${r.competency_id}`, r.final_score);
  const compAvg = new Map<string, number>();
  for (const comp of orderedComps) {
    const vals = candidates
      .map((c) => scoreAt.get(`${c.id}:${comp.id}`))
      .filter((v): v is number => typeof v === "number");
    const m = meanOrNull(vals);
    if (m !== null) compAvg.set(comp.id, m);
  }

  // ---- Summary stats ------------------------------------------------------
  const readyNow = succession.ready_now.length;
  const stars = grid.high.high.length;
  const avgOar = meanOrNull(oarRows.map((o) => o.overall_score));
  const hasScores = placed.length > 0;

  return (
    <div className="space-y-6">
      <BackLink href={`/admin/engagements/${engagementId}`} label="Back to engagement" />

      {/* Header */}
      <div className="rounded-md border bg-gradient-to-r from-[#010131] to-[#121140] text-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Grid3x3 className="h-8 w-8 text-[#5391D5] shrink-0" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-white/70">Talent Map</p>
            <h1 className="text-2xl font-bold leading-tight">{engName}</h1>
            <p className="text-sm text-white/80 mt-0.5">
              {orgName}
              {targetRole ? ` · Target role: ${targetRole}` : ""} ·{" "}
              <span className="capitalize">{status}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Candidates" value={String(candidates.length)} />
        <StatCard icon={<Award className="h-4 w-4" />} label="Ready Now" value={String(readyNow)} tone="emerald" />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label="Stars (high/high)" value={String(stars)} tone="sky" />
        <StatCard
          icon={<Layers className="h-4 w-4" />}
          label="Avg OAR"
          value={avgOar !== null ? `${avgOar.toFixed(1)}/5` : "-"}
        />
      </div>

      {/* 9-box grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Grid3x3 className="h-4 w-4 text-[#5391D5]" />
            Nine-box: performance vs potential
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Performance = RESULTS + PEOPLE scores. Potential = THINKING + SELF scores. Both on the 1-5 consensus scale.
          </p>
        </CardHeader>
        <CardContent>
          {!hasScores ? (
            <EmptyNote text="No consensus scores recorded yet - the grid populates once wash-up ratings are finalised." />
          ) : (
            <div className="flex gap-2">
              {/* Y axis label */}
              <div className="flex items-center">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl] rotate-180">
                  Potential &rarr;
                </span>
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-3 gap-2">
                  {(["high", "med", "low"] as TalentBand[]).map((pot) =>
                    (["low", "med", "high"] as TalentBand[]).map((perf) => {
                      const cell = nineBoxCell(pot, perf);
                      const t = TONE_CLASSES[cell.tone];
                      const people = grid[pot][perf];
                      return (
                        <div
                          key={`${pot}-${perf}`}
                          className={`rounded-md border ${t.border} ${t.bg} p-3 min-h-[120px] flex flex-col`}
                        >
                          <p className={`text-xs font-bold ${t.label}`}>{cell.label}</p>
                          <p className="text-[10px] text-muted-foreground mb-2 leading-snug">{cell.action}</p>
                          <div className="mt-auto flex flex-wrap gap-1">
                            {people.map((p) => (
                              <span
                                key={p.id}
                                title={`${p.name} - performance ${p.performance.toFixed(1)}, potential ${p.potential.toFixed(1)}`}
                                className="rounded-full bg-white/80 border px-2 py-0.5 text-[11px] font-medium text-[#010131]"
                              >
                                {p.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                {/* X axis label */}
                <p className="mt-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Performance &rarr;
                </p>
              </div>
            </div>
          )}
          {unscored.length > 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Not plotted (no scores yet): {unscored.map((c) => c.full_name).join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Succession readiness */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-[#5391D5]" />
            Succession readiness
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Pipeline for {targetRole ? `the ${targetRole} role` : "the target role"}, by overall assessment recommendation.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pipeline bar */}
          {candidates.length > 0 && (
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              {SUCCESSION_ORDER.map((key) => {
                const n = succession[key].length;
                if (n === 0) return null;
                const pct = (n / candidates.length) * 100;
                return (
                  <div
                    key={key}
                    className={SUCCESSION_TONE[SUCCESSION_META[key].tone].bar}
                    style={{ width: `${pct}%` }}
                    title={`${SUCCESSION_META[key].label}: ${n}`}
                  />
                );
              })}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SUCCESSION_ORDER.map((key) => {
              const meta = SUCCESSION_META[key];
              const people = succession[key];
              return (
                <div key={key} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SUCCESSION_TONE[meta.tone].chip}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-lg font-bold tabular-nums">{people.length}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground leading-snug">{meta.blurb}</p>
                  <ul className="mt-2 space-y-0.5">
                    {people.map((c) => (
                      <li key={c.id} className="truncate text-xs text-foreground/90">
                        {c.full_name}
                      </li>
                    ))}
                    {people.length === 0 && <li className="text-xs text-muted-foreground">-</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Skills heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#5391D5]" />
            Cohort skills heatmap
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Consensus competency scores across the cohort. Greener is stronger; redder needs development.
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {orderedComps.length === 0 || candidates.length === 0 ? (
            <EmptyNote text="No competency scores to chart yet." />
          ) : (
            <table className="w-full border-separate border-spacing-0.5 text-sm">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-10 bg-card text-left text-xs font-semibold align-bottom pe-2 min-w-[140px]"
                  >
                    Candidate
                  </th>
                  {domainGroups.map((g, i) => (
                    <th
                      key={i}
                      colSpan={g.span}
                      className={`text-[10px] font-semibold uppercase tracking-wide rounded-t px-1 py-0.5 ${DOMAIN_TINT[g.domain] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {g.domain}
                    </th>
                  ))}
                </tr>
                <tr>
                  {orderedComps.map((comp) => (
                    <th
                      key={comp.id}
                      className="text-[10px] font-medium text-muted-foreground px-1 pb-1 align-bottom max-w-[64px]"
                      title={comp.name}
                    >
                      <span className="block truncate">{comp.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id}>
                    <td className="sticky left-0 z-10 bg-card pe-2 text-xs font-medium truncate max-w-[140px]">
                      {c.full_name}
                    </td>
                    {orderedComps.map((comp) => {
                      const s = scoreAt.get(`${c.id}:${comp.id}`);
                      if (s === undefined) {
                        return (
                          <td key={comp.id} className="text-center">
                            <div className="grid h-8 w-full min-w-[40px] place-items-center rounded bg-muted/40 text-[11px] text-muted-foreground">
                              -
                            </div>
                          </td>
                        );
                      }
                      const tone = heatmapTone(s);
                      return (
                        <td key={comp.id} className="text-center">
                          <div
                            className="grid h-8 w-full min-w-[40px] place-items-center rounded text-[11px] font-bold"
                            style={{ backgroundColor: tone.bg, color: tone.fg }}
                          >
                            {s}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Cohort average */}
                <tr>
                  <td className="sticky left-0 z-10 bg-card pe-2 pt-1 text-xs font-semibold">Cohort avg</td>
                  {orderedComps.map((comp) => {
                    const m = compAvg.get(comp.id);
                    if (m === undefined) {
                      return (
                        <td key={comp.id} className="text-center pt-1">
                          <div className="grid h-7 place-items-center text-[11px] text-muted-foreground">-</div>
                        </td>
                      );
                    }
                    const tone = heatmapTone(m);
                    return (
                      <td key={comp.id} className="text-center pt-1">
                        <div
                          className="grid h-7 w-full min-w-[40px] place-items-center rounded text-[11px] font-bold"
                          style={{ backgroundColor: tone.bg, color: tone.fg }}
                          title={`Cohort average: ${m.toFixed(1)}`}
                        >
                          {m.toFixed(1)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "emerald" | "sky";
}) {
  const accent =
    tone === "emerald" ? "text-emerald-600" : tone === "sky" ? "text-[#5391D5]" : "text-[#010131]";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={accent}>{icon}</span>
          {label}
        </div>
        <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
