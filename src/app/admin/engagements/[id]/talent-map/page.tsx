export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { getServerT, getServerLocale, getServerDir } from "@/lib/i18n/server";
import { localizedName } from "@/lib/i18n/localized";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Grid3x3, TrendingUp, Users, Award, Layers } from "lucide-react";
import { computeCandidateReadiness } from "@/lib/scoring/readiness-data";
import { READINESS_TIER_META, type ReadinessStatus } from "@/lib/scoring/readiness";
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

type DomainRef = { name: string; name_ar: string | null; sort_order: number } | null;
type ClusterRef = { competency_domains: DomainRef } | null;
type CompetencyRef = { name: string; name_ar: string | null; competency_clusters: ClusterRef } | null;

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

type CandidateRow = { id: string; full_name: string; email: string | null; role_profile_id?: string | null };

// Tier chip tones for the engine-readiness cohort panel (READINESS_TIER_META tone tokens).
const READINESS_CHIP: Record<string, string> = {
  emerald: "bg-emerald-100 text-emerald-800",
  sky: "bg-sky-100 text-sky-800",
  amber: "bg-amber-100 text-amber-800",
  rose: "bg-rose-100 text-rose-800",
  slate: "bg-slate-100 text-slate-700",
};
const READINESS_ORDER: ReadinessStatus[] = [
  "ready_now",
  "ready_soon",
  "developing",
  "not_ready",
  "insufficient_data",
];

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
  const t = await getServerT();
  const rtl = getServerDir(await getServerLocale()) === "rtl";

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
        .select("id, full_name, email, role_profile_id")
        .eq("engagement_id", engagementId)
        .order("full_name"),
      sb
        .from("consensus_ratings")
        .select(
          "candidate_id, competency_id, final_score, " +
            "competencies(name, name_ar, competency_clusters(competency_domains(name, name_ar, sort_order)))"
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

  // ---- Engine readiness (360 observed-vs-role-bar), read-only -------------
  // Only candidates bound to a role profile can have a readiness tier; compute
  // read-only (persist=false) so viewing the cohort doesn't write snapshots.
  const readinessByCand = new Map<string, ReadinessStatus>();
  await Promise.all(
    candidates
      .filter((c) => c.role_profile_id)
      .map(async (c) => {
        try {
          const rr = await computeCandidateReadiness(engagementId, c.id, null, false);
          readinessByCand.set(c.id, rr.status);
        } catch {
          /* skip a candidate whose readiness can't be computed */
        }
      }),
  );
  const anyReadiness = readinessByCand.size > 0;
  const readinessBuckets = READINESS_ORDER.map((status) => ({
    status,
    people: candidates.filter((c) => readinessByCand.get(c.id) === status),
  }));

  // ---- Skills heatmap matrix ----------------------------------------------
  const compMeta = new Map<string, { name: string; domain: string; domainDisplay: string; domainSort: number }>();
  for (const r of consensus) {
    if (compMeta.has(r.competency_id)) continue;
    const d = r.competencies?.competency_clusters?.competency_domains;
    compMeta.set(r.competency_id, {
      name: localizedName(r.competencies, rtl) || "(unknown)",
      // English domain name stays as the tint/group key; localized variant for display.
      domain: d?.name ?? "OTHER",
      domainDisplay: d ? localizedName(d, rtl) : "OTHER",
      domainSort: d?.sort_order ?? 99,
    });
  }
  const orderedComps = Array.from(compMeta.entries())
    .map(([id, m]) => ({ id, ...m }))
    .sort((a, b) => a.domainSort - b.domainSort || a.name.localeCompare(b.name));

  // Domain column-group runs (orderedComps is already domain-contiguous).
  const domainGroups: { domain: string; domainDisplay: string; span: number }[] = [];
  for (const comp of orderedComps) {
    const last = domainGroups[domainGroups.length - 1];
    if (last && last.domain === comp.domain) last.span += 1;
    else domainGroups.push({ domain: comp.domain, domainDisplay: comp.domainDisplay, span: 1 });
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
      <BackLink href={`/admin/engagements/${engagementId}`} label={t("adminEngagements.talentMap.backToEngagement")} />

      {/* Header */}
      <div className="rounded-md border bg-gradient-to-r from-[#010131] to-[#121140] text-white p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Grid3x3 className="h-8 w-8 text-[#5391D5] shrink-0" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-white/70">{t("adminEngagements.talentMap.title")}</p>
            <h1 className="text-2xl font-bold leading-tight">{engName}</h1>
            <p className="text-sm text-white/80 mt-0.5">
              {orgName}
              {targetRole ? ` · ${t("adminEngagements.talentMap.targetRoleLabel")}: ${targetRole}` : ""} ·{" "}
              <span>{t(`adminEngagements.status.${status}`)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label={t("adminEngagements.talentMap.statCandidates")} value={String(candidates.length)} />
        <StatCard icon={<Award className="h-4 w-4" />} label={t("adminEngagements.talentMap.statReadyNow")} value={String(readyNow)} tone="emerald" />
        <StatCard icon={<TrendingUp className="h-4 w-4" />} label={t("adminEngagements.talentMap.statStars")} value={String(stars)} tone="sky" />
        <StatCard
          icon={<Layers className="h-4 w-4" />}
          label={t("adminEngagements.talentMap.statAvgOar")}
          value={avgOar !== null ? `${avgOar.toFixed(1)}/5` : "-"}
        />
      </div>

      {/* 9-box grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Grid3x3 className="h-4 w-4 text-[#5391D5]" />
            {t("adminEngagements.talentMap.nineBoxTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("adminEngagements.talentMap.nineBoxDesc")}
          </p>
        </CardHeader>
        <CardContent>
          {!hasScores ? (
            <EmptyNote text={t("adminEngagements.talentMap.nineBoxEmpty")} />
          ) : (
            <div className="flex gap-2">
              {/* Y axis label */}
              <div className="flex items-center">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground [writing-mode:vertical-rl] rotate-180">
                  {t("adminEngagements.talentMap.axisPotential")} &rarr;
                </span>
              </div>
              <div className="flex-1">
                <div className="grid grid-cols-3 gap-2">
                  {(["high", "med", "low"] as TalentBand[]).map((pot) =>
                    (["low", "med", "high"] as TalentBand[]).map((perf) => {
                      const cell = nineBoxCell(pot, perf);
                      const tone = TONE_CLASSES[cell.tone];
                      const people = grid[pot][perf];
                      return (
                        <div
                          key={`${pot}-${perf}`}
                          className={`rounded-md border ${tone.border} ${tone.bg} p-3 min-h-[120px] flex flex-col`}
                        >
                          <p className={`text-xs font-bold ${tone.label}`}>{cell.label}</p>
                          <p className="text-[10px] text-muted-foreground mb-2 leading-snug">{cell.action}</p>
                          <div className="mt-auto flex flex-wrap gap-1">
                            {people.map((p) => (
                              <span
                                key={p.id}
                                title={t("adminEngagements.talentMap.personTooltip", { name: p.name, performance: p.performance.toFixed(1), potential: p.potential.toFixed(1) })}
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
                  {t("adminEngagements.talentMap.axisPerformance")} &rarr;
                </p>
              </div>
            </div>
          )}
          {unscored.length > 0 && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              {t("adminEngagements.talentMap.notPlotted", { names: unscored.map((c) => c.full_name).join("، ") })}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Succession readiness */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-[#5391D5]" />
            {t("adminEngagements.talentMap.successionTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {targetRole
              ? t("adminEngagements.talentMap.successionDescRole", { role: targetRole })
              : t("adminEngagements.talentMap.successionDescGeneric")}
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

      {/* Succession readiness (engine: 360 observed-vs-role-bar) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#5391D5]" />
            {t("readinessCohort.title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("readinessCohort.desc")}</p>
        </CardHeader>
        <CardContent>
          {!anyReadiness ? (
            <EmptyNote text={t("readinessCohort.empty")} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {readinessBuckets.map(({ status, people }) => {
                const meta = READINESS_TIER_META[status];
                return (
                  <div key={status} className="rounded-md border p-3">
                    <div className="flex items-center justify-between">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${READINESS_CHIP[meta.tone]}`}>
                        {meta.label}
                      </span>
                      <span className="text-lg font-bold tabular-nums">{people.length}</span>
                    </div>
                    <ul className="mt-2 space-y-0.5">
                      {people.map((c) => (
                        <li key={c.id} className="truncate text-xs">
                          <Link
                            href={`/admin/engagements/${engagementId}/readiness/${c.id}`}
                            className="text-[#5391D5] hover:underline"
                            title={t("readinessCohort.viewReport")}
                          >
                            {c.full_name}
                          </Link>
                        </li>
                      ))}
                      {people.length === 0 && <li className="text-xs text-muted-foreground">-</li>}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skills heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-[#5391D5]" />
            {t("adminEngagements.talentMap.heatmapTitle")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {t("adminEngagements.talentMap.heatmapDesc")}
          </p>
        </CardHeader>
        <CardContent>
          {orderedComps.length === 0 || candidates.length === 0 ? (
            <EmptyNote text={t("adminEngagements.talentMap.heatmapEmpty")} />
          ) : (
            <>
            {/* Mobile: per-candidate card list (the wide heatmap matrix scrolls awkwardly on a phone) */}
            <div className="space-y-4 md:hidden">
              {candidates.map((c) => (
                <div key={c.id} className="rounded-lg border p-3">
                  <p className="mb-2 text-sm font-semibold">{c.full_name}</p>
                  <div className="space-y-2.5">
                    {domainGroups.map((g, gi) => (
                      <div key={gi}>
                        <p className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${DOMAIN_TINT[g.domain] ?? "bg-muted text-muted-foreground"}`}>
                          {g.domainDisplay}
                        </p>
                        <div className="space-y-1">
                          {orderedComps.filter((comp) => comp.domain === g.domain).map((comp) => {
                            const s = scoreAt.get(`${c.id}:${comp.id}`);
                            const tone = s === undefined ? null : heatmapTone(s);
                            return (
                              <div key={comp.id} className="flex items-center justify-between gap-2 text-xs">
                                <span className="min-w-0 flex-1 truncate text-muted-foreground">{comp.name}</span>
                                <span
                                  className={`grid h-6 w-9 shrink-0 place-items-center rounded text-[11px] font-bold ${tone ? "" : "bg-muted/40 font-normal text-muted-foreground"}`}
                                  style={tone ? { backgroundColor: tone.bg, color: tone.fg } : undefined}
                                >
                                  {s ?? "-"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {/* Cohort average */}
              <div className="rounded-lg border border-dashed p-3">
                <p className="mb-2 text-sm font-semibold">{t("adminEngagements.talentMap.cohortAvg")}</p>
                <div className="space-y-2.5">
                  {domainGroups.map((g, gi) => (
                    <div key={gi}>
                      <p className={`mb-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${DOMAIN_TINT[g.domain] ?? "bg-muted text-muted-foreground"}`}>
                        {g.domainDisplay}
                      </p>
                      <div className="space-y-1">
                        {orderedComps.filter((comp) => comp.domain === g.domain).map((comp) => {
                          const m = compAvg.get(comp.id);
                          const tone = m === undefined ? null : heatmapTone(m);
                          return (
                            <div key={comp.id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="min-w-0 flex-1 truncate text-muted-foreground">{comp.name}</span>
                              <span
                                className={`grid h-6 w-9 shrink-0 place-items-center rounded text-[11px] font-bold ${tone ? "" : "bg-muted/40 font-normal text-muted-foreground"}`}
                                style={tone ? { backgroundColor: tone.bg, color: tone.fg } : undefined}
                              >
                                {m === undefined ? "-" : m.toFixed(1)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tablet/desktop: scrollable heatmap matrix */}
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-separate border-spacing-0.5 text-sm">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-10 bg-card text-left text-xs font-semibold align-bottom pe-2 min-w-[140px]"
                  >
                    {t("adminEngagements.talentMap.colCandidate")}
                  </th>
                  {domainGroups.map((g, i) => (
                    <th
                      key={i}
                      colSpan={g.span}
                      className={`text-[10px] font-semibold uppercase tracking-wide rounded-t px-1 py-0.5 ${DOMAIN_TINT[g.domain] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {g.domainDisplay}
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
                  <td className="sticky left-0 z-10 bg-card pe-2 pt-1 text-xs font-semibold">{t("adminEngagements.talentMap.cohortAvg")}</td>
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
                          title={t("adminEngagements.talentMap.cohortAvgTooltip", { value: m.toFixed(1) })}
                        >
                          {m.toFixed(1)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
            </div>
            </>
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
