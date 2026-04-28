import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, FlaskConical, Mail, Link2, Lock, Unlock, RefreshCw, Plus, Trash2,
  Archive, RotateCcw, BookOpen, AlertTriangle, ShieldAlert, TrendingUp, TrendingDown, Minus,
  FileDown, Eye, Cpu, Sparkles,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import { ARA_STAGE_MAP } from "@/lib/constants/ara-stages";
import { bulkImportAraRespondents, createAraRespondent } from "@/lib/ara/actions";
import { SendInvitationButton } from "./_components/send-invitation-button";
import { StartReassessmentButton } from "./_components/start-reassessment-button";
import {
  createConsultantNote, deleteConsultantNote, toggleNoteIncludeInReport,
  freezeAssessmentScores, unfreezeAssessmentScores,
  recalculateCompliance, overrideComplianceStatus,
  updatePillarWeights,
  archiveAssessment, reopenAssessment,
} from "@/lib/ara/consultant-actions";
import { summarizeComplianceByFramework } from "@/lib/ara/compliance";
import { detectAraGaps, detectAraShadowAi } from "@/lib/ara/detectors";
import { computeAraDistortion } from "@/lib/ara/distortion";
import { computeYoYComparison } from "@/lib/ara/year-on-year";
import {
  recommendCoursesForAraAssessment,
  recommendCoursesForIndividualSnapshot,
} from "@/lib/recommender/courses";
import { RecommendedCoursesPanel } from "@/components/shared/recommended-courses-panel";
import { computeWorkforceReadiness } from "@/lib/ara/workforce-readiness";
import { ARA_INDIVIDUAL_FACTORS } from "@/lib/constants/ara-individual-factors";
import { ConfirmAction } from "@/components/shared/confirm-action";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumbs } from "@/components/shared/breadcrumbs";
import { ValidatedScoreInput } from "./_components/validated-score-input";
import type {
  AraAssessment, AraOrganization, AraRespondent, AraRespondentPillarAssignment,
} from "@/types/ara";

export const dynamic = "force-dynamic";

type RespondentWithAssignments = AraRespondent & {
  assignments: Pick<AraRespondentPillarAssignment, "pillar_id">[];
};

type PillarScoreRow = {
  pillar_id: string;
  raw_score: number | null;
  weighted_score: number | null;
  pillar_weight: number;
  maturity_level: number | null;
  maturity_label_en: string | null;
  benchmark_gap: number | null;
  self_assessment_score: number | null;
  consultant_validated_score: number | null;
  perception_gap: number | null;
};

type OverallScoreRow = {
  overall_score: number | null;
  overall_label_en: string | null;
  score_frozen_at: string | null;
};

type ConsultantNoteRow = {
  id: string;
  pillar_id: string | null;
  note_text: string;
  include_in_report: boolean;
  note_language: "en" | "ar";
  created_at: string;
};

type ComplianceResultRow = {
  id: string;
  requirement_id: string;
  status: "met" | "partial" | "not_met" | "unknown";
  status_label_en: string | null;
  evidence_note: string | null;
  requirement: {
    id: string;
    requirement_code: string;
    requirement_text_en: string;
    pillar_id: string | null;
    severity: "mandatory" | "recommended" | "advisory";
    framework_id: string;
  } | null;
};

const maturityColor = (level: number | null) => {
  if (level == null) return "bg-muted text-muted-foreground";
  if (level >= 4) return "bg-emerald-100 text-emerald-800";
  if (level === 3) return "bg-amber-100 text-amber-800";
  return "bg-red-100 text-red-800";
};

const statusVariant: Record<string, string> = {
  met: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  not_met: "bg-red-100 text-red-800",
  unknown: "bg-muted text-muted-foreground",
};

export default async function AraAssessmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const sb = createServiceClient();

  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("*, organization:ara_organizations(id, name, name_ar, region, sector)")
    .eq("id", params.id)
    .maybeSingle<AraAssessment & { organization: Pick<AraOrganization, "id" | "name" | "name_ar" | "region" | "sector"> | null }>();

  if (!assessment) return notFound();

  const [
    { data: respondents },
    { data: pillarScores },
    { data: overallScore },
    { data: notes },
    complianceSummaries,
    { data: complianceResults },
    { data: materials },
    { data: useCases },
  ] = await Promise.all([
    sb
      .from("ara_respondents")
      .select("*, assignments:ara_respondent_pillar_assignments(pillar_id)")
      .eq("assessment_id", assessment.id)
      .order("created_at", { ascending: true })
      .returns<RespondentWithAssignments[]>(),
    sb
      .from("ara_pillar_scores")
      .select("pillar_id, raw_score, weighted_score, pillar_weight, maturity_level, maturity_label_en, benchmark_gap, self_assessment_score, consultant_validated_score, perception_gap")
      .eq("assessment_id", assessment.id)
      .returns<PillarScoreRow[]>(),
    sb
      .from("ara_assessment_scores")
      .select("overall_score, overall_label_en, score_frozen_at")
      .eq("assessment_id", assessment.id)
      .maybeSingle<OverallScoreRow>(),
    sb
      .from("ara_consultant_notes")
      .select("id, pillar_id, note_text, include_in_report, note_language, created_at")
      .eq("assessment_id", assessment.id)
      .order("created_at", { ascending: false })
      .returns<ConsultantNoteRow[]>(),
    summarizeComplianceByFramework(assessment.id),
    sb
      .from("ara_compliance_results")
      .select("id, requirement_id, status, status_label_en, evidence_note, requirement:ara_regulatory_requirements(id, requirement_code, requirement_text_en, pillar_id, severity, framework_id)")
      .eq("assessment_id", assessment.id)
      .returns<ComplianceResultRow[]>(),
    sb
      .from("ara_supporting_materials")
      .select("*, respondent:ara_respondents(name, email)")
      .eq("assessment_id", assessment.id)
      .order("uploaded_at", { ascending: false }),
    sb
      .from("ara_use_cases")
      .select("*, respondent:ara_respondents(name)")
      .eq("assessment_id", assessment.id)
      .order("created_at", { ascending: false }),
  ]);

  const pillarMap = new Map<string, PillarScoreRow>();
  (pillarScores ?? []).forEach((p) => pillarMap.set(p.pillar_id, p));

  // Gap Detector + Shadow AI Alert + year-on-year + distortion - run in parallel
  const [gapAlerts, shadowAi, yoy, distortion] = await Promise.all([
    detectAraGaps(assessment.id),
    detectAraShadowAi(assessment.id),
    computeYoYComparison(assessment.id),
    computeAraDistortion(assessment.id),
  ]);

  // Day 3 — VIFM training recommendations driven by per-pillar maturity
  // gap. Sits in the Phase 2 tab as the consultant's capability-building
  // plan. Tolerant of the recommender catalogue being empty.
  let araRecommendedCourses: Awaited<ReturnType<typeof recommendCoursesForAraAssessment>> = [];
  try {
    araRecommendedCourses = await recommendCoursesForAraAssessment({
      assessmentId: assessment.id,
    });
  } catch (e) {
    console.error("[ara-assessment-detail] recommender failed:", e);
  }

  // Mode C — workforce readiness rollup, only when the org assessment
  // opted into the individual layer. Pulls per-respondent factor scores
  // and cohort means; tolerant of empty data with null return.
  const workforceRollup = assessment.include_individual_layer
    ? await computeWorkforceReadiness(assessment.id).catch((e) => {
        console.error("[ara-assessment-detail] workforce rollup failed:", e);
        return null;
      })
    : null;
  const workforceCourseRecs = workforceRollup
    ? await recommendCoursesForIndividualSnapshot({
        factorScores: workforceRollup.factor_scores_for_recommender,
        target: 4,
        limit: 5,
      }).catch((e) => {
        console.error("[ara-assessment-detail] workforce recommender failed:", e);
        return [];
      })
    : [];

  // Load Layer 2 consultant-guide questions for this version (never shown
  // to respondents - reference material for the Phase 2 workshop).
  const { data: layer2Questions } = assessment.question_bank_version_id
    ? await sb
        .from("ara_questions")
        .select("id, pillar_id, question_number, question_text_en, question_text_ar, help_text_en, help_text_ar")
        .eq("version_id", assessment.question_bank_version_id)
        .eq("layer", 2)
        .eq("is_active", true)
        .order("pillar_id")
        .order("display_order")
    : { data: [] };

  const isFrozen = assessment.status === "frozen";
  const isArchived = assessment.status === "archived";
  const overall = overallScore?.overall_score;

  // Bound inline server actions
  const freezeAction = async () => {
    "use server";
    await freezeAssessmentScores(assessment.id);
  };
  const unfreezeAction = async () => {
    "use server";
    await unfreezeAssessmentScores(assessment.id);
  };
  const recalcAction = async () => {
    "use server";
    await recalculateCompliance(assessment.id);
  };
  const archiveAction = async () => {
    "use server";
    await archiveAssessment(assessment.id);
  };
  const reopenAction = async () => {
    "use server";
    await reopenAssessment(assessment.id);
  };
  const updatePillarWeightsAction = async (fd: FormData) => {
    "use server";
    await updatePillarWeights(fd);
  };
  const createConsultantNoteAction = async (fd: FormData) => {
    "use server";
    await createConsultantNote(fd);
  };
  const createRespondentAction = async (fd: FormData) => {
    "use server";
    await createAraRespondent(fd);
  };
  const bulkImportRespondentsAction = async (fd: FormData) => {
    "use server";
    await bulkImportAraRespondents(fd);
  };
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Breadcrumbs
          items={[
            { label: "ARA", href: "/ara" },
            { label: "Consultant", href: "/ara/consultant" },
            { label: "Assessments", href: "/ara/consultant" },
            { label: assessment.organization?.name ?? "(no org)" },
          ]}
        />
        <Link href="/ara/consultant" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> Back to assessments
        </Link>

        {assessment.is_sandbox && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-center gap-2 text-amber-900 text-sm">
            <FlaskConical className="h-4 w-4" />
            <span className="font-medium">This is a sandbox assessment.</span>
            <span>Emails redirect; data is excluded from analytics.</span>
          </div>
        )}

        {/* Hero card - score + identity + primary actions */}
        <div className="rounded-2xl border bg-card overflow-hidden mb-8">
          <div className="ara-hero-subtle p-6 sm:p-8 flex flex-col lg:flex-row items-start gap-6">
            {/* Identity */}
            <div className="flex-1 min-w-0">
              {(() => {
                const stage = ARA_STAGE_MAP[assessment.engagement_stage] ?? ARA_STAGE_MAP.enterprise;
                const stageColor =
                  stage.tone === "teal" ? "#0D9488" :
                  stage.tone === "violet" ? "#7C3AED" :
                  "#D97706";
                return (
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-widest"
                      style={{
                        background: `${stageColor}15`,
                        color: stageColor,
                        border: `1px solid ${stageColor}40`,
                      }}
                    >
                      {stage.is_pro_bono && <Sparkles className="h-2.5 w-2.5" />}
                      Stage {stage.number} · {stage.label_en}
                    </span>
                    <span className="ara-eyebrow">
                      {assessment.assessment_year}
                    </span>
                  </div>
                );
              })()}
              <h1 className="ara-numeral text-3xl sm:text-4xl font-semibold text-primary mt-1 mb-1 leading-tight">
                {assessment.organization?.name ?? "(no organization)"}
              </h1>
              {assessment.scope_label && (
                <p className="text-sm text-muted-foreground mb-3">
                  Scope: <span className="font-medium text-foreground">{assessment.scope_label}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="capitalize font-medium">
                  {assessment.region === "uae" ? "UAE" : "Saudi Arabia"}
                </Badge>
                <Badge variant="outline" className="capitalize font-medium">
                  {assessment.sector}
                </Badge>
                <span className="text-muted-foreground/60">·</span>
                <span className="capitalize">{assessment.status}</span>
                <span className="text-muted-foreground/60">·</span>
                <span>{assessment.phase.replace("phase", "Phase ")}</span>
                <span className="text-muted-foreground/60">·</span>
                <span>Lang: {assessment.default_language.toUpperCase()}</span>
              </div>
            </div>

            {/* Score preview */}
            <div className="flex items-stretch gap-4 w-full lg:w-auto">
              <div className="rounded-xl border bg-card px-5 py-4 min-w-[140px]">
                <div className="ara-eyebrow text-muted-foreground/80">Overall</div>
                <div className="ara-numeral text-3xl font-semibold text-primary mt-1">
                  {overall != null ? overall.toFixed(2) : "-"}
                  <span className="text-sm text-muted-foreground font-normal"> / 5</span>
                </div>
                <div className="text-xs text-accent font-medium mt-0.5">
                  {overallScore?.overall_label_en ?? "Not scored"}
                </div>
              </div>
              <div className="rounded-xl border bg-card px-5 py-4 min-w-[140px]">
                <div className="ara-eyebrow text-muted-foreground/80">Respondents</div>
                <div className="ara-numeral text-3xl font-semibold text-primary mt-1">
                  {(respondents ?? []).length}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {(respondents ?? []).filter((r) => r.completed_at).length} completed
                </div>
              </div>
            </div>
          </div>

          {/* Actions rail */}
          <div className="border-t px-6 sm:px-8 py-3 flex flex-wrap items-center gap-2 bg-muted/20">
            <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{assessment.status}</Badge>
            <Badge variant="secondary" className="capitalize">
              {assessment.phase.replace("phase", "Phase ")}
            </Badge>
            {!isArchived && (isFrozen ? (
              <ConfirmAction
                action={unfreezeAction}
                variant="outline"
                destructive={false}
                title="Unfreeze scores?"
                description="Respondents will be able to update their answers again, and scores will continue to recalculate as responses come in."
                confirmLabel="Unfreeze"
                successMessage="Scores unfrozen"
              >
                <Unlock className="h-3 w-3" /> Unfreeze
              </ConfirmAction>
            ) : (
              <ConfirmAction
                action={freezeAction}
                variant="default"
                destructive={false}
                title="Freeze scores?"
                description="Takes a snapshot of current scores for the report. Respondents can no longer change answers until you unfreeze. You can always unfreeze and refreeze."
                confirmLabel="Freeze"
                successMessage="Scores frozen"
              >
                <Lock className="h-3 w-3" /> Freeze
              </ConfirmAction>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">
                  <Eye className="h-3 w-3" /> Preview report
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/ara/consultant/assessments/${assessment.id}/report?lang=en`} target="_blank">English</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/ara/consultant/assessments/${assessment.id}/report?lang=ar`} target="_blank">العربية</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/ara/consultant/assessments/${assessment.id}/report?lang=bilingual`} target="_blank">Bilingual</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1">
                  <FileDown className="h-3 w-3" /> Download PDF
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a href={`/api/ara/reports/${assessment.id}/pdf?language=en`}>English</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/ara/reports/${assessment.id}/pdf?language=ar`}>العربية</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/ara/reports/${assessment.id}/pdf?language=bilingual`}>Bilingual</a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {isArchived ? (
              <ConfirmAction
                action={reopenAction}
                variant="outline"
                destructive={false}
                title="Reopen this assessment?"
                description="Moves back to Phase 1 and unfreezes scores. Respondents can answer again."
                confirmLabel="Reopen"
                successMessage="Assessment reopened"
              >
                <RotateCcw className="h-3 w-3" /> Reopen
              </ConfirmAction>
            ) : (
              <ConfirmAction
                action={archiveAction}
                variant="outline"
                destructive={false}
                title="Archive this assessment?"
                description="The assessment is closed to further activity. Generated reports are kept. You can reopen later. Archived assessments are purged after 3 years per retention policy."
                confirmLabel="Archive"
                successMessage="Assessment archived"
              >
                <Archive className="h-3 w-3" /> Archive
              </ConfirmAction>
            )}
            {(assessment.status === "completed" || isFrozen || isArchived) && (
              <StartReassessmentButton
                priorAssessmentId={assessment.id}
                priorYear={assessment.assessment_year}
              />
            )}
            </div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="mt-2">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="phase2">Phase 2 notes</TabsTrigger>
            <TabsTrigger value="guide">Phase 2 guide</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
            <TabsTrigger value="portfolio">Portfolio &amp; evidence</TabsTrigger>
            <TabsTrigger value="respondents">Respondents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-0">

        {/* ─── Shadow AI alert ─── */}
        {shadowAi.triggered && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-destructive flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> Shadow AI alert
              </CardTitle>
              <CardDescription>
                Signals suggest employees may be using public AI tools without
                formal governance. Investigate in Phase 2.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {shadowAi.matches.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    AI tool mentions in open-text answers
                  </p>
                  <ul className="space-y-1">
                    {shadowAi.matches.slice(0, 5).map((m, i) => (
                      <li key={i} className="text-xs">
                        <span className="font-medium">{m.respondent_name}</span>
                        {" - "}
                        <span className="italic">…{m.snippet}…</span>
                        <span className="ms-1 inline-block px-1.5 py-0.5 rounded bg-destructive/10 text-[10px] uppercase">
                          {m.keyword}
                        </span>
                      </li>
                    ))}
                    {shadowAi.matches.length > 5 && (
                      <li className="text-xs text-muted-foreground">
                        …and {shadowAi.matches.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}
              {shadowAi.low_governance_scores.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Governance pillar gaps (score ≤ 2.0)
                  </p>
                  <ul className="space-y-1 text-xs">
                    {shadowAi.low_governance_scores.slice(0, 5).map((g, i) => (
                      <li key={i}>
                        <span className="font-medium">{g.respondent_name}</span>
                        {" - Q"}{g.question_number}: {g.question_text_en}
                        <span className="ms-1 text-destructive font-medium">({g.score.toFixed(1)})</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ─── Gap Detector alerts ─── */}
        {gapAlerts.length > 0 && (
          <Card className="mb-6 border-amber-300 bg-amber-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-amber-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Gap Detector - {gapAlerts.length} disagreement{gapAlerts.length === 1 ? "" : "s"} flagged
              </CardTitle>
              <CardDescription className="text-amber-900/80">
                Respondents on the same pillar disagree significantly.
                Investigate in the Phase 2 workshop.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {gapAlerts.map((a, i) => (
                  <li key={i} className="border-l-2 border-amber-500 ps-3">
                    {a.kind === "question" ? (
                      <>
                        <p className="font-medium text-xs uppercase text-amber-900/70">
                          {a.pillar_name_en} - Q{a.question_number} (spread {a.spread.toFixed(1)})
                        </p>
                        <p className="text-xs">{a.question_text_en}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.low_respondent}: {a.low_score.toFixed(1)} • {a.high_respondent}: {a.high_score.toFixed(1)}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-xs uppercase text-amber-900/70">
                          {a.pillar_name_en} - level split
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.low_respondent} averaging {a.low_avg.toFixed(1)} while{" "}
                          {a.high_respondent} averaging {a.high_avg.toFixed(1)}
                        </p>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* ─── Overall + Pillar Scores ─── */}
        <Card className="mb-6">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Live scores</CardTitle>
              <CardDescription>
                Recalculates on every respondent answer. Freeze before generating the report.
              </CardDescription>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">
                {overall != null ? overall.toFixed(2) : "-"}
                <span className="text-sm text-muted-foreground font-normal"> / 5.0</span>
              </div>
              {overallScore?.overall_label_en && (
                <div className="text-xs text-muted-foreground mt-0.5">{overallScore.overall_label_en}</div>
              )}
              {overallScore?.score_frozen_at && (
                <div className="text-[10px] text-amber-700 mt-1">
                  Frozen {new Date(overallScore.score_frozen_at).toLocaleString()}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pillar</TableHead>
                  <TableHead className="text-right">Raw</TableHead>
                  <TableHead className="text-right">Wt %</TableHead>
                  <TableHead className="text-right">Weighted</TableHead>
                  <TableHead>Maturity</TableHead>
                  <TableHead className="text-right">vs 4.0</TableHead>
                  <TableHead className="text-right" title="Consultant-validated score (Phase 2)">Validated</TableHead>
                  <TableHead className="text-right" title="Perception vs reality gap">Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ARA_PILLARS.map((p) => {
                  const row = pillarMap.get(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name_en}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row?.raw_score != null ? Number(row.raw_score).toFixed(2) : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row?.pillar_weight != null ? `${Number(row.pillar_weight).toFixed(1)}` : "-"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row?.weighted_score != null ? Number(row.weighted_score).toFixed(3) : "-"}
                      </TableCell>
                      <TableCell>
                        {row?.maturity_label_en ? (
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${maturityColor(row.maturity_level)}`}>
                            L{row.maturity_level} - {row.maturity_label_en}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                        {row?.benchmark_gap != null ? (
                          Number(row.benchmark_gap) > 0
                            ? `+${Number(row.benchmark_gap).toFixed(2)}`
                            : Number(row.benchmark_gap).toFixed(2)
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {isFrozen || isArchived ? (
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {row?.consultant_validated_score != null
                              ? Number(row.consultant_validated_score).toFixed(2)
                              : "-"}
                          </span>
                        ) : (
                          <ValidatedScoreInput
                            assessmentId={assessment.id}
                            pillarId={p.id}
                            defaultValue={row?.consultant_validated_score ?? null}
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {row?.perception_gap != null ? (
                          <span className={Number(row.perception_gap) > 0 ? "text-amber-700" : Number(row.perception_gap) < 0 ? "text-emerald-700" : ""}>
                            {Number(row.perception_gap) > 0 ? "+" : ""}
                            {Number(row.perception_gap).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* ─── Pillar weights editor ─── */}
        {!isFrozen && !isArchived && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Pillar weights</CardTitle>
              <CardDescription>
                Adjust how each pillar contributes to the overall score.
                Weights must sum to 100. Default is equal (12.5% × 8).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updatePillarWeightsAction} className="space-y-3">
                <input type="hidden" name="assessment_id" value={assessment.id} />
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                  {ARA_PILLARS.map((p) => {
                    const weights = assessment.pillar_weights as Record<string, number>;
                    return (
                      <div key={p.id} className="space-y-1">
                        <Label htmlFor={`weight_${p.id}`} className="text-xs">
                          {p.name_en}
                        </Label>
                        <Input
                          id={`weight_${p.id}`}
                          name={`weight_${p.id}`}
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          defaultValue={weights?.[p.id] ?? 12.5}
                          className="h-8 text-xs"
                        />
                      </div>
                    );
                  })}
                </div>
                <Button type="submit" size="sm">Save weights &amp; recalculate</Button>
              </form>
            </CardContent>
          </Card>
        )}

          </TabsContent>

          <TabsContent value="guide" className="space-y-0">
        {(layer2Questions ?? []).length === 0 ? (
          <Card className="mb-6">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No Layer 2 guide questions exist on this version of the bank.
              Admin can add them at <strong>/ara/admin/questions</strong> with layer set to 2.
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> Phase 2 consultant guide
              </CardTitle>
              <CardDescription>
                Layer 2 questions for the Phase 2 workshop. <strong>Never shown to respondents.</strong>
                Use these to dig deeper than the Layer 1 self-assessment and uncover the &ldquo;why&rdquo; behind each score.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ARA_PILLARS.map((pillar) => {
                  const qs = (layer2Questions ?? []).filter((q) => q.pillar_id === pillar.id);
                  if (qs.length === 0) return null;
                  return (
                    <details key={pillar.id} className="rounded-lg border bg-card" open>
                      <summary className="px-3 py-2 cursor-pointer flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {pillar.name_en}
                          <span className="text-muted-foreground ms-2" dir="rtl">{pillar.name_ar}</span>
                        </span>
                        <Badge variant="outline" className="text-[10px]">{qs.length}</Badge>
                      </summary>
                      <ol className="px-4 py-3 space-y-3 text-sm border-t">
                        {qs.map((q) => (
                          <li key={q.id} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <span className="font-medium me-1 text-primary">Q{q.question_number}.</span>
                              {q.question_text_en}
                              {q.help_text_en && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {q.help_text_en}
                                </p>
                              )}
                            </div>
                            <div dir="rtl" className="text-right md:border-s md:ps-4">
                              <span className="font-medium me-1 text-primary">س{q.question_number}.</span>
                              {q.question_text_ar}
                            </div>
                          </li>
                        ))}
                      </ol>
                    </details>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
          </TabsContent>

          <TabsContent value="phase2" className="space-y-6">

        {/* ─── Capability-building plan (course recommender) ─── */}
        <RecommendedCoursesPanel
          title="Capability-building plan — VIFM training programmes"
          description="Per-pillar maturity gap (target 4) × course relevance. Use during the Phase 2 workshop to anchor the development conversation in concrete VIFM offerings."
          emptyMessage="No course recommendations yet — either no pillar scores have been computed, the org is at or above target maturity (level 4) on all pillars, or the catalogue doesn't yet cover the relevant pillars."
          courses={araRecommendedCourses}
          context="ara"
        />

        {/* ─── Workforce readiness rollup (Mode C) ─── *
         * Only renders when the assessment opted into the individual
         * layer. Consultant sees cohort-level factor means + per-
         * respondent breakdown + course recommendations driven by
         * cohort gaps. */}
        {assessment.include_individual_layer && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                Workforce readiness
                <Badge variant="secondary" className="text-[10px]">
                  {assessment.assessment_tier === "deep_dive"
                    ? "Deep-dive · 48 items"
                    : "Snapshot · 24 items"}
                </Badge>
              </CardTitle>
              <CardDescription>
                Cohort-level four-factor readiness rolled up across every
                respondent who answered the individual layer. Per-person
                breakdown shows who is pulling the cohort up or down.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!workforceRollup || workforceRollup.respondents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No individual-layer responses yet. Once respondents
                  complete the assessment, their four-factor scores roll
                  up here.
                </p>
              ) : (
                <>
                  {/* Cohort overall + factor averages */}
                  <div className="grid gap-3 sm:grid-cols-5">
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Cohort overall
                      </p>
                      <p className="text-2xl font-bold tabular-nums mt-1">
                        {workforceRollup.cohort_overall != null
                          ? workforceRollup.cohort_overall.toFixed(2)
                          : "—"}
                        <span className="text-xs text-muted-foreground font-normal"> / 5</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {workforceRollup.completed_count} of {workforceRollup.cohort_size} completed
                      </p>
                    </div>
                    {workforceRollup.factor_averages.map((f) => {
                      const factor = ARA_INDIVIDUAL_FACTORS.find((x) => x.id === f.factor_id);
                      const tone =
                        f.average >= 4 ? "bg-emerald-50 border-emerald-200"
                        : f.average >= 3 ? "bg-amber-50 border-amber-200"
                        : "bg-rose-50 border-rose-200";
                      return (
                        <div key={f.factor_id} className={`rounded-md border p-3 ${tone}`}>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-block h-2 w-2 rounded-full"
                              style={{ backgroundColor: factor?.color }}
                            />
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                              {factor?.domain}
                            </span>
                          </div>
                          <p className="text-xs font-semibold mt-0.5">{factor?.name_en}</p>
                          <p className="text-2xl font-bold tabular-nums mt-1">
                            {f.respondent_count > 0 ? f.average.toFixed(2) : "—"}
                            <span className="text-xs text-muted-foreground font-normal"> / 5</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {f.respondent_count} respondent{f.respondent_count === 1 ? "" : "s"}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Distribution histogram — % of cohort below target per factor */}
                  <div>
                    <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                      Development demand · % of cohort below target (4)
                    </p>
                    <div className="space-y-2">
                      {workforceRollup.factor_averages.map((f) => {
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
                            <span className="w-36 shrink-0 flex items-center gap-1.5">
                              <span
                                className="inline-block h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: factor?.color }}
                              />
                              <span className="truncate">{factor?.name_en}</span>
                            </span>
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full ${barTone} transition-[width]`}
                                style={{ width: `${Math.max(pct, 2)}%` }}
                              />
                            </div>
                            <span className="w-28 shrink-0 text-right text-muted-foreground tabular-nums">
                              {f.below_target_count} of {f.respondent_count} ({pct}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Per-respondent table */}
                  <div>
                    <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                      Per-respondent breakdown
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Respondent</TableHead>
                          <TableHead className="text-center">Sense-Check</TableHead>
                          <TableHead className="text-center">Working Practice</TableHead>
                          <TableHead className="text-center">Collaboration</TableHead>
                          <TableHead className="text-center">Adaptive Mindset</TableHead>
                          <TableHead className="text-right">Overall</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workforceRollup.respondents.map((r) => (
                          <TableRow key={r.respondent_id}>
                            <TableCell>
                              <div className="text-sm font-medium">{r.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {r.email}
                                {r.individual_only && " · individual-only"}
                              </div>
                            </TableCell>
                            {(["thinking_sense_check", "results_working_practice", "people_collaboration", "self_adaptive_mindset"] as const).map((fid) => {
                              const v = r.per_factor[fid];
                              return (
                                <TableCell key={fid} className="text-center text-xs tabular-nums">
                                  {v != null ? v.toFixed(1) : "—"}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-right font-semibold tabular-nums">
                              {r.overall != null ? r.overall.toFixed(2) : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Workforce-readiness course recommendations — driven by
            cohort gaps on the individual factors. Renders only when
            we have data to compute against. */}
        {assessment.include_individual_layer && workforceRollup && workforceRollup.respondents.length > 0 && (
          <RecommendedCoursesPanel
            title="Workforce training plan — based on cohort factor gaps"
            description="VIFM courses ranked by where the cohort scores below target across the four individual readiness factors. Driver chips show which factor's gap pulled each course into the list."
            emptyMessage="No recommendations yet — cohort means are at or above target across all four factors, or the catalogue doesn't yet cover the relevant capabilities."
            courses={workforceCourseRecs}
            context="ac"
          />
        )}

        {/* ─── Phase 2 Consultant Notes ─── */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Phase 2 consultant notes</CardTitle>
            <CardDescription>
              Observations from the Deep Dive workshop. Toggle <em>Include in report</em> to surface
              a note in the final report; otherwise it stays internal.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing notes */}
            {(notes ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes yet.</p>
            ) : (
              <div className="space-y-3">
                {(notes ?? []).map((n) => {
                  const pillarName = n.pillar_id
                    ? ARA_PILLARS.find((p) => p.id === n.pillar_id)?.name_en ?? n.pillar_id
                    : "General";
                  const toggleAction = async () => {
                    "use server";
                    await toggleNoteIncludeInReport(n.id, assessment.id, !n.include_in_report);
                  };
                  const deleteAction = async () => {
                    "use server";
                    await deleteConsultantNote(n.id, assessment.id);
                  };
                  return (
                    <div key={n.id} className="rounded-lg border p-3 bg-card">
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">{pillarName}</Badge>
                          <Badge variant="secondary" className="text-[10px] uppercase">{n.note_language}</Badge>
                          {n.include_in_report ? (
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">In report</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Internal</Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <form action={toggleAction}>
                            <Button type="submit" variant="outline" size="sm" className="h-7 text-xs">
                              {n.include_in_report ? "Make internal" : "Include in report"}
                            </Button>
                          </form>
                          <form action={deleteAction}>
                            <Button type="submit" variant="ghost" size="sm" className="h-7 w-7 p-0">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </form>
                        </div>
                      </div>
                      <p className="text-sm whitespace-pre-wrap" dir={n.note_language === "ar" ? "rtl" : "ltr"}>
                        {n.note_text}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add note form */}
            <form action={createConsultantNoteAction} className="rounded-lg border p-4 bg-muted/30 space-y-3">
              <input type="hidden" name="assessment_id" value={assessment.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="note_pillar" className="text-xs">Pillar (optional)</Label>
                  <select
                    id="note_pillar"
                    name="pillar_id"
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                    defaultValue=""
                  >
                    <option value="">General (not pillar-specific)</option>
                    {ARA_PILLARS.map((p) => (
                      <option key={p.id} value={p.id}>{p.name_en}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="note_language" className="text-xs">Language</Label>
                  <select
                    id="note_language"
                    name="note_language"
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                    defaultValue={assessment.default_language}
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                  </select>
                </div>
              </div>
              <textarea
                name="note_text"
                rows={3}
                required
                maxLength={5000}
                placeholder="What did you observe in Phase 2?"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" name="include_in_report" className="h-3.5 w-3.5 rounded border-input" />
                  Include in report
                </label>
                <Button type="submit" size="sm" className="gap-1">
                  <Plus className="h-3 w-3" /> Add note
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

          </TabsContent>

          <TabsContent value="compliance" className="space-y-0">

        {/* ─── Regulatory Compliance ─── */}
        <Card className="mb-6">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Regulatory compliance</CardTitle>
              <CardDescription>
                {assessment.region === "uae" ? "UAE" : "Saudi Arabia"} frameworks applicable to your sector.
                Auto-derived from answers; override when you have direct evidence.
              </CardDescription>
            </div>
            <form action={recalcAction}>
              <Button type="submit" variant="outline" size="sm" className="gap-1">
                <RefreshCw className="h-3 w-3" /> Recalculate
              </Button>
            </form>
          </CardHeader>
          <CardContent className="space-y-4">
            {complianceSummaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No frameworks apply to this region/sector combination.
              </p>
            ) : (
              <>
                {/* Framework summary cards */}
                <div className="grid gap-2 md:grid-cols-2">
                  {complianceSummaries.map((s) => (
                    <div key={s.framework_id} className="rounded-lg border p-3 bg-card text-sm">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium">{s.framework_code}</span>
                        <Badge variant="outline" className="text-[10px]">Tier {s.tier}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                        {s.framework_name_en}
                      </p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="tabular-nums font-semibold">
                          {s.percent != null ? `${s.percent}%` : "-"}
                        </span>
                        <span className="text-emerald-700">{s.met} met</span>
                        <span className="text-amber-700">{s.partial} partial</span>
                        <span className="text-red-700">{s.not_met} not met</span>
                        <span className="text-muted-foreground">{s.unknown} unknown</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Requirement list with override forms */}
                <details className="rounded-lg border bg-muted/30">
                  <summary className="px-4 py-2 cursor-pointer text-sm font-medium">
                    All requirements ({(complianceResults ?? []).length}) - click to expand
                  </summary>
                  <div className="p-4 space-y-2 max-h-[600px] overflow-auto">
                    {(complianceResults ?? []).map((r) => {
                      if (!r.requirement) return null;
                      return (
                        <ComplianceRequirementRow
                          key={r.id}
                          result={r}
                          assessmentId={assessment.id}
                        />
                      );
                    })}
                  </div>
                </details>
              </>
            )}
          </CardContent>
        </Card>

        {/* ─── Year-on-year comparison ─── */}
        {yoy && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Year-on-year comparison
              </CardTitle>
              <CardDescription>
                {yoy.compatible
                  ? `Comparing against ${yoy.prior_year} assessment (same major question bank version).`
                  : yoy.incompatibleReason}
              </CardDescription>
            </CardHeader>
            {yoy.compatible && (
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pillar</TableHead>
                      <TableHead className="text-right">{yoy.prior_year ?? "Prior"}</TableHead>
                      <TableHead className="text-right">{assessment.assessment_year}</TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {yoy.pillars.map((p) => {
                      const DeltaIcon =
                        p.delta == null ? Minus : p.delta > 0 ? TrendingUp : p.delta < 0 ? TrendingDown : Minus;
                      const deltaClass =
                        p.delta == null ? "text-muted-foreground" : p.delta > 0 ? "text-emerald-700" : p.delta < 0 ? "text-destructive" : "text-muted-foreground";
                      return (
                        <TableRow key={p.pillar_id}>
                          <TableCell className="font-medium">{p.pillar_name_en}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {p.prior_raw != null ? p.prior_raw.toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.current_raw != null ? p.current_raw.toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className={`text-right tabular-nums ${deltaClass}`}>
                            <span className="inline-flex items-center gap-1 justify-end">
                              <DeltaIcon className="h-3 w-3" />
                              {p.delta != null ? (p.delta > 0 ? `+${p.delta.toFixed(2)}` : p.delta.toFixed(2)) : "-"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {yoy.current_overall != null && yoy.prior_overall != null && (
                      <TableRow className="font-semibold border-t-2">
                        <TableCell>Overall</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {yoy.prior_overall.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {yoy.current_overall.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {(yoy.current_overall - yoy.prior_overall).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            )}
          </Card>
        )}

          </TabsContent>

          <TabsContent value="portfolio" className="space-y-0">

        {/* ─── AI Use Case Portfolio ─── */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Cpu className="h-4 w-4" /> AI use case portfolio
            </CardTitle>
            <CardDescription>
              AI initiatives inventoried by respondents - stage, risk, and business value.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!useCases || useCases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No use cases inventoried yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Pillar</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Submitted by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {useCases.map((u: any) => {
                    const stageColors: Record<string, string> = {
                      ideation: "bg-gray-500",
                      piloting: "bg-orange-500",
                      production: "bg-emerald-600",
                      retired: "bg-gray-400",
                    };
                    const riskColors: Record<string, string> = {
                      low: "text-emerald-700",
                      medium: "text-amber-700",
                      high: "text-orange-700",
                      critical: "text-destructive",
                    };
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell>
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] uppercase text-white font-medium ${stageColors[u.stage]}`}>
                            {u.stage}
                          </span>
                        </TableCell>
                        <TableCell className={`text-sm font-medium ${riskColors[u.risk_level]}`}>
                          {u.risk_level}
                        </TableCell>
                        <TableCell className="text-sm capitalize">{u.value_level}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.pillar_id
                            ? (ARA_PILLARS.find((p) => p.id === u.pillar_id)?.name_en ?? u.pillar_id)
                            : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.business_owner ?? "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.respondent?.name ?? "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ─── Supporting Materials ─── */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Supporting materials</CardTitle>
            <CardDescription>
              Documents and links submitted by respondents as evidence.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!materials || materials.length === 0 ? (
              <p className="text-sm text-muted-foreground">None submitted yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Submitted by</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Uploaded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materials.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {m.material_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{m.material_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {m.respondent?.name ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-xs">
                        {m.material_type === "url" ? (
                          <a href={m.link_url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                            {m.link_url}
                          </a>
                        ) : (
                          m.file_name
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(m.uploaded_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

          </TabsContent>

          <TabsContent value="respondents" className="space-y-0">

        {/* ─── Response-validity (distortion) panel ─── *
         * Surfaces respondents whose answer pattern is statistically
         * inconsistent (extreme polarisation, straight-lining, drift
         * from peers). Reads-only signal, never auto-rejects answers. */}
        {distortion.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                Response validity
              </CardTitle>
              <CardDescription>
                Statistical signals on each respondent&apos;s answer pattern.
                Used by the consultant to decide whether to validate input
                in Phase 2 - never auto-rejects responses.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {distortion.map((d) => {
                  const tone = d.level === "high"  ? { bg: "#fef2f2", bd: "#FB7185", fg: "#9f1239", label: "High" } :
                               d.level === "watch" ? { bg: "#fffbeb", bd: "#FBBF24", fg: "#78350f", label: "Watch" } :
                                                     { bg: "#f0fdf4", bd: "#34D399", fg: "#065f46", label: "Clean" };
                  return (
                    <div key={d.respondent_id} className="rounded-lg border p-3"
                         style={{ background: tone.bg, borderLeft: `3px solid ${tone.bd}` }}>
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {d.respondent_name}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {d.total_responses} answers · extremity {Math.round(d.signals.extremity_pct * 100)}% ·
                            longest run {d.signals.longest_run} · drift {d.signals.anchor_deviation.toFixed(2)}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                              style={{ background: `${tone.bd}25`, color: tone.fg, border: `1px solid ${tone.bd}50` }}>
                          {tone.label} · {d.distortion_score}/100
                        </span>
                      </div>
                      {d.reasons.length > 0 && (
                        <ul className="text-xs text-foreground mt-2 space-y-0.5">
                          {d.reasons.map((r, i) => (
                            <li key={i}>• {r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Respondents ─── */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Respondents</CardTitle>
            <CardDescription>
              Stakeholders who will complete their assigned pillar sections.
              Each receives a unique access link - no account required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!respondents || respondents.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No respondents yet. Add one below.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Lang</TableHead>
                    <TableHead>Pillars assigned</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Invite link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {respondents.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3 w-3" /> {r.email}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.role_label_en ?? "-"}
                      </TableCell>
                      <TableCell className="text-xs uppercase">{r.language_preference}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.assignments.length === 0 ? (
                            <span className="text-xs text-muted-foreground">None</span>
                          ) : (
                            r.assignments.map((a) => (
                              <Badge key={a.pillar_id} variant="secondary" className="text-[10px]">
                                {ARA_PILLARS.find((p) => p.id === a.pillar_id)?.name_en ?? a.pillar_id}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.completed_at ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">Done</Badge>
                        ) : r.first_opened_at ? (
                          <span className="text-amber-700">In progress</span>
                        ) : (
                          <span className="text-muted-foreground">Not started</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/ara/respond/${r.access_token}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                          >
                            <Link2 className="h-3 w-3" /> Preview
                          </Link>
                          <SendInvitationButton
                            respondentId={r.id}
                            isSandbox={!!assessment.is_sandbox}
                            alreadySent={!!r.first_opened_at}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ─── Add respondent ─── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Add respondent</CardTitle>
            <CardDescription>
              Assign one or more pillars. Respondent sees only their assigned sections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createRespondentAction} className="space-y-5">
              <input type="hidden" name="assessment_id" value={assessment.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" name="name" required maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name_ar">Name (Arabic)</Label>
                  <Input id="name_ar" name="name_ar" maxLength={200} dir="rtl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language_preference">Language</Label>
                  <select
                    id="language_preference"
                    name="language_preference"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={assessment.default_language}
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic - العربية</option>
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="role_label_en">Role (optional)</Label>
                  <Input
                    id="role_label_en"
                    name="role_label_en"
                    placeholder="e.g. Chief Executive Officer"
                    maxLength={200}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Assign pillars</Label>
                <div className="grid gap-2 sm:grid-cols-2 rounded-lg border p-4">
                  {ARA_PILLARS.map((p) => (
                    <label key={p.id} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        name="pillar_assignments"
                        value={p.id}
                        className="mt-0.5 h-4 w-4 rounded border-input"
                      />
                      <span>
                        <span className="block text-sm font-medium">{p.name_en}</span>
                        <span className="block text-xs text-muted-foreground" dir="rtl">{p.name_ar}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {assessment.include_individual_layer && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Note: this assessment has the individual readiness layer
                    enabled. Respondents will also receive the four-factor
                    items in addition to their pillar questions.
                  </p>
                )}
              </div>

              {assessment.include_individual_layer && (
                <div className="flex items-start gap-3 rounded-lg border p-4 bg-violet-50">
                  <input
                    type="checkbox"
                    id="individual_only"
                    name="individual_only"
                    className="mt-0.5 h-4 w-4 rounded border-input"
                  />
                  <div className="flex-1">
                    <Label htmlFor="individual_only" className="cursor-pointer text-sm font-semibold">
                      Individual layer only — skip pillar questions
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      For workforce-wide invitees who shouldn&apos;t answer
                      org-side pillar questions (e.g. inviting 50 line
                      employees while only 8 senior leaders cover the
                      pillars). Respondent gets only the four-factor items.
                      Ignore the pillar checkboxes above.
                    </p>
                  </div>
                </div>
              )}

              <Button type="submit">Add respondent</Button>
            </form>
          </CardContent>
        </Card>

        {/* ─── Bulk CSV import ─── *
         * Lets a consultant paste a CSV (header + rows) to invite many
         * respondents at once. Closes a parity gap with industry
         * assessment platforms that ship CSV import as a core feature. */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Bulk import (CSV)</CardTitle>
            <CardDescription>
              Paste a CSV with a header row to invite multiple respondents at once.
              Required columns: <code className="bg-muted px-1 py-0.5 rounded text-xs">name</code>,{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">email</code>.
              Optional: <code className="bg-muted px-1 py-0.5 rounded text-xs">name_ar</code>,{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">role</code>,{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">language</code> (en/ar),{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">pillars</code> (pipe-separated).
              {assessment.include_individual_layer && (
                <>
                  {" "}For workforce-only invitees,{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">individual_only</code>{" "}
                  (yes/no) skips pillar questions and serves only the four-factor items.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={bulkImportRespondentsAction} className="space-y-4">
              <input type="hidden" name="assessment_id" value={assessment.id} />
              <div className="space-y-2">
                <Label htmlFor="csv-paste">CSV content</Label>
                <textarea
                  id="csv-paste"
                  name="csv"
                  rows={6}
                  required
                  placeholder={"name,email,role,language,pillars\nFatima Al-Sayegh,fatima@example.com,Head of AI,en,strategy|model_management\nKhalid bin Sultan,khalid@example.com,Director Risk,ar,governance|culture"}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground">
                  Existing emails on this assessment are skipped automatically.
                  Pillar IDs:{" "}
                  <code className="text-[10px]">
                    strategy · data · technology · talent · culture · governance · operations · model_management
                  </code>
                </p>
              </div>
              <Button type="submit" variant="outline">
                <Plus className="h-4 w-4 me-1" /> Import CSV
              </Button>
            </form>
          </CardContent>
        </Card>

          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Compliance requirement row with inline override form
// ─────────────────────────────────────────────────────────────
function ComplianceRequirementRow({
  result,
  assessmentId,
}: {
  result: ComplianceResultRow;
  assessmentId: string;
}) {
  if (!result.requirement) return null;
  const req = result.requirement;
  const overrideComplianceAction = async (fd: FormData) => {
    "use server";
    await overrideComplianceStatus(fd);
  };
  const pillar = req.pillar_id ? ARA_PILLARS.find((p) => p.id === req.pillar_id)?.name_en : null;

  return (
    <details className="rounded border bg-card">
      <summary className="px-3 py-2 cursor-pointer flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
            result.status === "met" ? "bg-emerald-500" :
            result.status === "partial" ? "bg-amber-500" :
            result.status === "not_met" ? "bg-red-500" : "bg-muted-foreground/30"
          }`} />
          <code className="text-[11px] font-mono text-muted-foreground shrink-0">{req.requirement_code}</code>
          <span className="text-xs truncate">{req.requirement_text_en}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {pillar && <Badge variant="outline" className="text-[9px]">{pillar}</Badge>}
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusVariant[result.status]}`}>
            {result.status_label_en ?? result.status}
          </span>
          {result.evidence_note && <span title="Overridden" className="text-[10px]">✎</span>}
        </div>
      </summary>
      <form action={overrideComplianceAction} className="px-3 py-3 border-t bg-muted/30 space-y-2">
        <input type="hidden" name="assessment_id" value={assessmentId} />
        <input type="hidden" name="requirement_id" value={req.id} />
        <div className="flex items-center gap-2">
          <select
            name="status"
            defaultValue={result.status}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="met">Compliant</option>
            <option value="partial">Partially Compliant</option>
            <option value="not_met">Action Required</option>
            <option value="unknown">Needs Verification</option>
          </select>
          <input
            name="evidence_note"
            placeholder="Evidence note (optional)"
            defaultValue={result.evidence_note ?? ""}
            maxLength={2000}
            className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
          />
          <Button type="submit" size="sm" className="h-8 text-xs">Save</Button>
        </div>
      </form>
    </details>
  );
}
