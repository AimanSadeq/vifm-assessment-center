import { notFound } from "next/navigation";
import Link from "next/link";
import { Compass, Sparkles, Users, FileText } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeWorkforceReadiness } from "@/lib/ara/workforce-readiness";
import {
  ARA_INDIVIDUAL_FACTORS,
  getIndividualMaturityStage,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import { getServerT } from "@/lib/i18n/server";
import type { AraAssessment, AraOrganization } from "@/types/ara";

export const dynamic = "force-dynamic";

/**
 * Read-only cohort dashboard for clients (thin v1, item #8).
 *
 * The consultant's workforce-readiness rollup card already shows
 * cohort overall + per-factor + per-respondent breakdown. This route
 * surfaces a *subset* of that data at a public URL keyed by the
 * assessment's UUID - clients with the link can see the cohort view
 * (overall, per-factor with development-demand, maturity-stage
 * narrative) without needing a portal account.
 *
 * Privacy posture for v1:
 *  - Per-respondent names + emails are NOT shown - only counts and
 *    cohort aggregates.
 *  - Only renders for assessments with `include_individual_layer=true`
 *    (Mode C). Other assessments 404.
 *  - The URL is keyed by assessment.id (UUIDv4). Treat it as a
 *    share-by-link credential - anyone with the link can view.
 *  - No PDFs, no respondent-level scores, no editing.
 *
 * Future v2: add an explicit `cohort_share_token` column on
 * `ara_assessments` so the URL can be revoked / rotated independently
 * of the assessment id. Out of scope for this v1.
 */
export default async function PublicCohortDashboardPage({
  params,
}: {
  params: { assessmentId: string };
}) {
  const t = await getServerT();
  const sb = createServiceClient();

  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("id, engagement_stage, include_individual_layer, assessment_tier, status, organization:ara_organizations(id, name, name_ar)")
    .eq("id", params.assessmentId)
    .maybeSingle<
      AraAssessment & {
        organization: Pick<AraOrganization, "id" | "name" | "name_ar"> | null;
      }
    >();

  // Gate strictly: must be an org-side assessment with Mode C on.
  // Anything else returns 404 so an unrelated assessment id can't leak.
  const eligible =
    !!assessment &&
    assessment.engagement_stage !== "individual" &&
    !!assessment.include_individual_layer;
  if (!eligible) return notFound();

  const rollup = await computeWorkforceReadiness(assessment.id).catch(() => null);
  if (!rollup || rollup.respondents.length === 0) {
    return (
      <CohortShell orgName={assessment.organization?.name ?? ""}>
        <div className="rounded-md border border-dashed p-12 text-center">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {t("araReport.cohort_empty_state")}
          </p>
        </div>
      </CohortShell>
    );
  }

  const completionPct = Math.round(
    (rollup.completed_count / Math.max(1, rollup.cohort_size)) * 100
  );
  const cohortStage = rollup.cohort_overall != null
    ? getIndividualMaturityStage(rollup.cohort_overall)
    : null;

  return (
    <CohortShell orgName={assessment.organization?.name ?? ""}>
      <div className="space-y-6">
        {/* Hero card - cohort overall */}
        <Card className="bg-gradient-to-br from-primary to-navy-blue text-primary-foreground border-0">
          <CardContent className="p-6 md:p-8 grid md:grid-cols-[auto_1fr] gap-6 items-center">
            <div>
              <p className="text-xs uppercase tracking-widest opacity-70">{t("araReport.cohort_overall")}</p>
              <p className="text-5xl font-bold tabular-nums mt-1">
                {rollup.cohort_overall != null ? rollup.cohort_overall.toFixed(2) : "-"}
                <span className="text-lg opacity-60 font-normal"> / 5</span>
              </p>
              {cohortStage && (
                <span className="inline-block mt-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-white/15 border-white/30 text-white">
                  {cohortStage.name_en}
                </span>
              )}
            </div>
            <div className="text-sm opacity-90 leading-relaxed">
              {cohortStage?.blurb_en ?? t("araReport.cohort_score_placeholder")}
              <p className="text-[11px] opacity-70 mt-3">
                {t("araReport.cohort_completion_line", {
                  completed: rollup.completed_count,
                  size: rollup.cohort_size,
                  pct: completionPct,
                })}{" "}
                {rollup.cohort_size === 1
                  ? t("araReport.cohort_invited_one", { size: rollup.cohort_size })
                  : t("araReport.cohort_invited_other", { size: rollup.cohort_size })}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Per-factor cards */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {t("araReport.cohort_readiness_by_factor")}
              <Badge variant="secondary" className="text-[10px]">
                {assessment.assessment_tier === "deep_dive"
                  ? t("araReport.cohort_tier_deep_dive")
                  : t("araReport.cohort_tier_snapshot")}
              </Badge>
            </CardTitle>
            <CardDescription>
              {t("araReport.cohort_readiness_by_factor_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {rollup.factor_averages.map((f) => {
              const factor = ARA_INDIVIDUAL_FACTORS.find((x) => x.id === f.factor_id);
              const tone =
                f.average >= 4 ? "bg-emerald-50 border-emerald-200"
                : f.average >= 3 ? "bg-amber-50 border-amber-200"
                : "bg-rose-50 border-rose-200";
              return (
                <div key={f.factor_id} className={`rounded-md border p-3 ${tone}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: factor?.color }} />
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{factor?.domain}</span>
                  </div>
                  <p className="text-sm font-semibold leading-tight">{factor?.name_en}</p>
                  <p className="text-2xl font-bold tabular-nums mt-1">
                    {f.respondent_count > 0 ? f.average.toFixed(2) : "-"}
                    <span className="text-xs text-muted-foreground font-normal"> / 5</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {f.respondent_count === 1
                      ? t("araReport.cohort_respondent_count_one", { count: f.respondent_count })
                      : t("araReport.cohort_respondent_count_other", { count: f.respondent_count })}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Development-demand histogram - % below target per factor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("araReport.cohort_development_demand")}</CardTitle>
            <CardDescription>
              {t("araReport.cohort_development_demand_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {rollup.factor_averages.map((f) => {
              const factor = ARA_INDIVIDUAL_FACTORS.find((x) => x.id === f.factor_id);
              const pct = f.respondent_count > 0
                ? Math.round((f.below_target_count / f.respondent_count) * 100)
                : 0;
              const barTone =
                pct >= 60 ? "bg-rose-500"
                : pct >= 30 ? "bg-amber-500"
                : "bg-emerald-500";
              return (
                <div key={f.factor_id} className="flex items-center gap-3 text-xs">
                  <span className="w-40 shrink-0 flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: factor?.color }} />
                    <span className="truncate">{factor?.name_en}</span>
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full ${barTone} transition-[width]`} style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                  <span className="w-32 shrink-0 text-end text-muted-foreground tabular-nums">
                    {t("araReport.cohort_below_target_line", {
                      below: f.below_target_count,
                      count: f.respondent_count,
                      pct,
                    })}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Methodology trust badge */}
        <div className="rounded-md border bg-muted/20 p-4 flex items-start gap-3">
          <FileText className="h-4 w-4 text-accent mt-0.5 shrink-0" />
          <div className="flex-1 text-xs leading-relaxed">
            <p className="font-semibold text-foreground">{t("araReport.cohort_methodology_title")}</p>
            <p className="text-muted-foreground mt-1">
              {t("araReport.cohort_methodology_body")}{" "}
              <a
                href="https://github.com/AimanSadeq/vifm-assessment-center/blob/master/docs/ARA-Methodology-Brief.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                {t("araReport.cohort_methodology_link")}
              </a>.
            </p>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-4">
          {t("araReport.cohort_footer_note")}
        </p>
      </div>
    </CohortShell>
  );
}

async function CohortShell({ orgName, children }: { orgName: string; children: React.ReactNode }) {
  const t = await getServerT();
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <Link href="/ara" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <Compass className="h-4 w-4" />
            {t("araReport.cohort_brand")}
          </Link>
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            {t("araReport.cohort_dashboard_eyebrow")}
          </span>
        </div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">{orgName || t("araReport.cohort_readiness_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("araReport.cohort_subtitle")}
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

// Suppress unused-import warning for AraIndividualFactorId - included
// for downstream typing of any future per-factor drilldown.
type _UsedTypes = AraIndividualFactorId;
