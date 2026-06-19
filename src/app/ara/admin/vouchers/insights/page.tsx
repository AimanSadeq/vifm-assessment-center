import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  Users,
  PlayCircle,
  CheckCircle2,
  FlaskConical,
  ArrowRight,
  Info,
} from "lucide-react";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RecommendedCoursesPanel } from "@/components/shared/recommended-courses-panel";
import { recommendCoursesForIndividualSnapshot } from "@/lib/recommender/courses";
import {
  ARA_INDIVIDUAL_FACTORS,
  getIndividualMaturityStage,
} from "@/lib/constants/ara-individual-factors";
import { fmtDate } from "@/lib/utils/format-date";
import {
  listCompanyCohorts,
  computeCompanyCohortInsight,
} from "@/lib/ara/company-cohort";
import { CohortCsvButton } from "./_components/cohort-csv-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Cohort insights · AI Readiness Compass" };

type Props = { searchParams: { company?: string } };

/** emerald >=4 / amber >=3 / rose <3 - the shared individual-readiness tone. */
function tone(score: number | null): { label: string; bg: string; fg: string; bar: string } {
  if (score == null) return { label: "No data", bg: "#f1f5f9", fg: "#475569", bar: "#cbd5e1" };
  if (score >= 4) return { label: "Strong", bg: "#dcfce7", fg: "#166534", bar: "#16a34a" };
  if (score >= 3) return { label: "Developing", bg: "#fef3c7", fg: "#92400e", bar: "#d97706" };
  return { label: "Opportunity", bg: "#fee2e2", fg: "#991b1b", bar: "#dc2626" };
}

export default async function CohortInsightsPage({ searchParams }: Props) {
  const companyParam = (searchParams.company ?? "").trim();

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-4">
        <BackLink href="/ara/admin/vouchers" label="Back to vouchers" history />
      </div>

      {companyParam ? (
        <CompanyDetail company={companyParam} />
      ) : (
        <CohortPicker />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Picker - list every company with redemptions
// ─────────────────────────────────────────────────────────────
async function CohortPicker() {
  const cohorts = await listCompanyCohorts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-accent" /> Company cohort insights
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aggregate AI-readiness across every delegate who redeemed a voucher under the same company.
          Pick a company to see its cohort breakdown.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Companies</CardTitle>
          <CardDescription>Grouped by the company name delegates entered when they redeemed.</CardDescription>
        </CardHeader>
        <CardContent>
          {cohorts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No voucher redemptions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pe-3 font-medium">Company</th>
                    <th className="py-2 pe-3 font-medium">Delegates</th>
                    <th className="py-2 pe-3 font-medium">Started</th>
                    <th className="py-2 pe-3 font-medium">Completed</th>
                    <th className="py-2 pe-3 font-medium">Last redeemed</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((c) => (
                    <tr key={c.company_key} className="border-b border-border/60">
                      <td className="py-2 pe-3 font-medium">
                        <span className="inline-flex items-center gap-2">
                          {c.company_label}
                          {c.is_practice_only && (
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <FlaskConical className="h-3 w-3" /> Practice
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className="py-2 pe-3 tabular-nums">{c.redeemed}</td>
                      <td className="py-2 pe-3 tabular-nums">{c.started}</td>
                      <td className="py-2 pe-3 tabular-nums">{c.completed}</td>
                      <td className="py-2 pe-3 text-muted-foreground">
                        {c.last_redeemed ? fmtDate(c.last_redeemed) : "-"}
                      </td>
                      <td className="py-2 text-right">
                        <Link
                          href={`/ara/admin/vouchers/insights?company=${encodeURIComponent(c.company_label)}`}
                          className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                          View insights <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Detail - one company's cohort
// ─────────────────────────────────────────────────────────────
async function CompanyDetail({ company }: { company: string }) {
  const insight = await computeCompanyCohortInsight(company);

  if (!insight) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{company}</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No cohort data for this company yet. Delegates may not have started, or the runs were
              cleared by a retention / sandbox purge.
            </p>
            <Link href="/ara/admin/vouchers/insights" className="text-accent hover:underline text-sm mt-3 inline-block">
              View all cohorts
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const courses =
    insight.cohort_overall != null
      ? await recommendCoursesForIndividualSnapshot({
          factorScores: insight.factor_scores_for_recommender,
          limit: 5,
        })
      : [];

  const overallTone = tone(insight.cohort_overall);
  const stage = insight.cohort_overall != null ? getIndividualMaturityStage(insight.cohort_overall) : null;
  const mixedTier = insight.tier_counts.snapshot > 0 && insight.tier_counts.deep_dive > 0;
  const scoredCount = insight.respondents.filter((r) => r.overall != null).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-accent" /> {insight.company_label}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-readiness cohort across {insight.redeemed} voucher delegate{insight.redeemed === 1 ? "" : "s"}.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {insight.is_practice_only && (
              <Badge variant="outline" className="gap-1">
                <FlaskConical className="h-3 w-3" /> Practice data - not norm-referenced
              </Badge>
            )}
            {mixedTier && (
              <Badge variant="outline" className="gap-1">
                <Info className="h-3 w-3" /> Mixed tiers: {insight.tier_counts.snapshot} snapshot ·{" "}
                {insight.tier_counts.deep_dive} deep-dive
              </Badge>
            )}
          </div>
        </div>
        <Link href="/ara/admin/vouchers/insights" className="text-sm text-accent hover:underline">
          All cohorts
        </Link>
      </div>

      {/* Completion funnel */}
      <div className="grid gap-3 sm:grid-cols-3">
        <FunnelStat icon={<Users className="h-4 w-4" />} label="Redeemed" value={insight.redeemed} />
        <FunnelStat icon={<PlayCircle className="h-4 w-4" />} label="Started" value={insight.started} />
        <FunnelStat icon={<CheckCircle2 className="h-4 w-4" />} label="Completed" value={insight.completed} />
      </div>
      {insight.purged > 0 && (
        <p className="text-xs text-muted-foreground -mt-3">
          {insight.purged} redemption{insight.purged === 1 ? "" : "s"} had their run cleared by a purge and
          are excluded from scoring.
        </p>
      )}

      {/* Cohort overall */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cohort AI readiness</CardTitle>
          <CardDescription>Average factor readiness across delegates who have answered, on a 1-5 scale (target 4).</CardDescription>
        </CardHeader>
        <CardContent>
          {insight.cohort_overall == null ? (
            <p className="text-sm text-muted-foreground">
              No delegate has answered enough items to score yet.
            </p>
          ) : (
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold tabular-nums">{insight.cohort_overall.toFixed(1)}</span>
                <span className="text-muted-foreground text-sm">/ 5</span>
              </div>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold"
                style={{ backgroundColor: overallTone.bg, color: overallTone.fg }}
              >
                {overallTone.label}
              </span>
              {stage && (
                <span className="text-sm text-muted-foreground">
                  Cohort stage: <span className="font-medium text-foreground">{stage.name_en}</span>
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {scoredCount} of {insight.redeemed} delegate{insight.redeemed === 1 ? "" : "s"} scored
              </span>
            </div>
          )}

          {/* Population percentile vs the global snapshot norm pool. */}
          <div className="mt-4 rounded-md bg-muted/40 border border-border/60 px-3 py-2 text-xs text-muted-foreground">
            {insight.norms_ready && insight.overall_percentile != null ? (
              <>
                This cohort&apos;s average sits around the{" "}
                <span className="font-semibold text-foreground">{insight.overall_percentile}th percentile</span>{" "}
                of all individual snapshots collected to date (n={insight.norm_sample_size}).
              </>
            ) : (
              <>
                Population percentiles unlock once at least 50 individual snapshots are collected
                (currently {insight.norm_sample_size}). Until then, read the scores against the target of 4.
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Per-factor breakdown */}
      <div className="grid gap-3 sm:grid-cols-2">
        {ARA_INDIVIDUAL_FACTORS.map((f) => {
          const fa = insight.factor_averages.find((x) => x.factor_id === f.id);
          const avg = fa && fa.respondent_count > 0 ? fa.average : null;
          const t = tone(avg);
          return (
            <Card key={f.id}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-2 mb-1">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: f.color }} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {f.domain}
                  </span>
                  {avg != null && (
                    <span
                      className="ms-auto inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                      style={{ backgroundColor: t.bg, color: t.fg }}
                    >
                      {t.label}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold">{f.name_en}</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-bold tabular-nums">{avg != null ? avg.toFixed(1) : "-"}</span>
                  <span className="text-xs text-muted-foreground">/ 5</span>
                  {fa && fa.respondent_count > 0 && (
                    <span className="ms-2 text-xs text-muted-foreground">
                      {fa.below_target_count} of {fa.respondent_count} below target
                    </span>
                  )}
                </div>
                <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${avg != null ? (avg / 5) * 100 : 0}%`, backgroundColor: t.bar }}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Maturity-band distribution */}
      {scoredCount > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Maturity spread</CardTitle>
            <CardDescription>How the {scoredCount} scored delegate{scoredCount === 1 ? "" : "s"} distribute across readiness stages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <BandBar label="Embedded (4.0-5.0)" count={insight.band_distribution.embedded} total={scoredCount} color="#16a34a" />
            <BandBar label="Practising (3.0-3.9)" count={insight.band_distribution.practising} total={scoredCount} color="#d97706" />
            <BandBar label="Emerging (1.0-2.9)" count={insight.band_distribution.emerging} total={scoredCount} color="#dc2626" />
          </CardContent>
        </Card>
      )}

      {/* Per-delegate breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Delegates</CardTitle>
              <CardDescription>Per-person factor scores. Visible to VIFM admins only.</CardDescription>
            </div>
            {insight.respondents.length > 0 && <CohortCsvButton insight={insight} />}
          </div>
        </CardHeader>
        <CardContent>
          {insight.respondents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No delegates to show.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pe-3 font-medium">Delegate</th>
                    <th className="py-2 pe-3 font-medium">Status</th>
                    {ARA_INDIVIDUAL_FACTORS.map((f) => (
                      <th key={f.id} className="py-2 pe-3 font-medium" title={f.name_en}>
                        {f.domain}
                      </th>
                    ))}
                    <th className="py-2 font-medium">Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {insight.respondents.map((r) => (
                    <tr key={r.respondent_id} className="border-b border-border/60">
                      <td className="py-2 pe-3">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </td>
                      <td className="py-2 pe-3">
                        {r.completed_at ? (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Completed
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">In progress</span>
                        )}
                      </td>
                      {ARA_INDIVIDUAL_FACTORS.map((f) => {
                        const v = r.per_factor[f.id];
                        return (
                          <td key={f.id} className="py-2 pe-3 tabular-nums">
                            {v != null ? v.toFixed(1) : <span className="text-muted-foreground">-</span>}
                          </td>
                        );
                      })}
                      <td className="py-2 tabular-nums font-semibold">
                        {r.overall != null ? r.overall.toFixed(1) : <span className="text-muted-foreground font-normal">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommended training for the cohort */}
      {insight.cohort_overall != null && (
        <RecommendedCoursesPanel
          title="Recommended VIFM training for this cohort"
          description="Programmes ranked by the cohort's weakest factors (gap to target × course relevance)."
          emptyMessage="This cohort is at or near the target across all four factors - no training gaps to close right now."
          courses={courses}
          context="ara"
        />
      )}
    </div>
  );
}

function FunnelStat({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-5 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold tabular-nums leading-none">{value}</div>
          <div className="text-xs text-muted-foreground mt-1">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function BandBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
