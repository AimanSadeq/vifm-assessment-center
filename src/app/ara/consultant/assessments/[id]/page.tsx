import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, FlaskConical, Mail, Link2, Lock, Unlock, RefreshCw, Plus, Trash2,
  Archive, RotateCcw, BookOpen, AlertTriangle, ShieldAlert, TrendingUp, TrendingDown, Minus,
  FileDown, Eye, Cpu, Sparkles,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller } from "@/lib/ara/auth-guards";
import { getServerT, type ServerT } from "@/lib/i18n/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ARA_PILLARS } from "@/lib/constants/ara-pillars";
import { ARA_STAGE_MAP, getPillarsForAssessment } from "@/lib/constants/ara-stages";
import { bulkImportAraRespondents, createAraRespondent } from "@/lib/ara/actions";
import { SendInvitationButton } from "./_components/send-invitation-button";
import { StartReassessmentButton } from "./_components/start-reassessment-button";
import { AraPathwayCard } from "./_components/ara-pathway-card";
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
import { computeAgenticReadiness } from "@/lib/ara/agentic-readiness";
import { ARA_INDIVIDUAL_FACTORS } from "@/lib/constants/ara-individual-factors";
import { ARA_AGENTIC_DIMENSIONS } from "@/lib/constants/ara-agentic-dimensions";
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
  const t = await getServerT();

  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("*, organization:ara_organizations(id, name, name_ar, region, sector)")
    .eq("id", params.id)
    .maybeSingle<AraAssessment & { organization: Pick<AraOrganization, "id" | "name" | "name_ar" | "region" | "sector"> | null }>();

  if (!assessment) return notFound();

  // Ownership: the layout gates role (consultant/admin); a consultant may only
  // open assessments they own (admins see all). Prevents cross-consultant IDOR.
  const caller = await getCurrentCaller();
  if (caller && caller.role !== "admin" && assessment.consultant_id !== caller.uid) {
    return notFound();
  }

  // Pillars in scope for THIS assessment (migration 00029). Honours
  // pillars_in_scope when set, falls back to the stage default. Used
  // to filter every "list of pillars" UI on this page so consultants
  // can't accidentally assign / weight / read a pillar that isn't
  // part of the engagement.
  const pillarsInScope = getPillarsForAssessment({
    engagement_stage: assessment.engagement_stage,
    pillars_in_scope: assessment.pillars_in_scope ?? null,
  });
  const inScopePillars = ARA_PILLARS.filter((p) => pillarsInScope.includes(p.id));

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

  // Day 3 - VIFM training recommendations driven by per-pillar maturity
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

  // Mode C - workforce readiness rollup, only when the org assessment
  // opted into the individual layer. Pulls per-respondent factor scores
  // and cohort means; tolerant of empty data with null return.
  const workforceRollup = assessment.include_individual_layer
    ? await computeWorkforceReadiness(assessment.id).catch((e) => {
        console.error("[ara-assessment-detail] workforce rollup failed:", e);
        return null;
      })
    : null;

  // Agentic-AI Readiness rollup - only when the assessment opted into the
  // agentic layer. Same tolerant pattern as the workforce rollup.
  const agenticRollup = assessment.include_agentic_layer
    ? await computeAgenticReadiness(assessment.id).catch((e) => {
        console.error("[ara-assessment-detail] agentic rollup failed:", e);
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
            { label: t("araAssessmentDetail.bc_consultant"), href: "/ara/consultant" },
            { label: t("araAssessmentDetail.bc_assessments"), href: "/ara/consultant" },
            { label: assessment.organization?.name ?? t("araAssessmentDetail.no_org") },
          ]}
        />
        <Link href="/ara/consultant" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-3 w-3" /> {t("araAssessmentDetail.back_to_assessments")}
        </Link>

        {assessment.is_sandbox && (
          <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-3 flex items-center gap-2 text-amber-900 text-sm">
            <FlaskConical className="h-4 w-4" />
            <span className="font-medium">{t("araAssessmentDetail.sandbox_title")}</span>
            <span>{t("araAssessmentDetail.sandbox_body")}</span>
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
                      {t("araAssessmentDetail.stage_prefix", { number: stage.number })} · {stage.label_en}
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
                  {t("araAssessmentDetail.scope_label")} <span className="font-medium text-foreground">{assessment.scope_label}</span>
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline" className="capitalize font-medium">
                  {assessment.region === "uae" ? t("araAssessmentDetail.region_uae") : t("araAssessmentDetail.region_saudi_full")}
                </Badge>
                <Badge variant="outline" className="capitalize font-medium">
                  {assessment.sector}
                </Badge>
                <span className="text-muted-foreground/60">·</span>
                <span className="capitalize">{assessment.status}</span>
                <span className="text-muted-foreground/60">·</span>
                <span>{t("araAssessmentDetail.phase_n", { n: assessment.phase.replace("phase", "") })}</span>
                <span className="text-muted-foreground/60">·</span>
                <span>{t("araAssessmentDetail.lang_label")} {assessment.default_language.toUpperCase()}</span>
              </div>
            </div>

            {/* Score preview */}
            <div className="flex items-stretch gap-4 w-full lg:w-auto">
              <div className="rounded-xl border bg-card px-5 py-4 min-w-[140px]">
                <div className="ara-eyebrow text-muted-foreground/80">{t("araAssessmentDetail.overall")}</div>
                <div className="ara-numeral text-3xl font-semibold text-primary mt-1">
                  {overall != null ? overall.toFixed(2) : "-"}
                  <span className="text-sm text-muted-foreground font-normal"> / 5</span>
                </div>
                <div className="text-xs text-accent font-medium mt-0.5">
                  {overallScore?.overall_label_en ?? t("araAssessmentDetail.not_scored")}
                </div>
              </div>
              <div className="rounded-xl border bg-card px-5 py-4 min-w-[140px]">
                <div className="ara-eyebrow text-muted-foreground/80">{t("araAssessmentDetail.respondents")}</div>
                <div className="ara-numeral text-3xl font-semibold text-primary mt-1">
                  {(respondents ?? []).length}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {t("araAssessmentDetail.n_completed", { n: (respondents ?? []).filter((r) => r.completed_at).length })}
                </div>
              </div>
            </div>
          </div>

          {/* Actions rail */}
          <div className="border-t px-6 sm:px-8 py-3 flex flex-wrap items-center gap-2 bg-muted/20">
            <div className="flex items-center gap-2">
            <Badge variant="outline" className="capitalize">{assessment.status}</Badge>
            <Badge variant="secondary" className="capitalize">
              {t("araAssessmentDetail.phase_n", { n: assessment.phase.replace("phase", "") })}
            </Badge>
            {!isArchived && (isFrozen ? (
              <ConfirmAction
                action={unfreezeAction}
                variant="outline"
                destructive={false}
                title={t("araAssessmentDetail.unfreeze_title")}
                description={t("araAssessmentDetail.unfreeze_desc")}
                confirmLabel={t("araAssessmentDetail.unfreeze")}
                successMessage={t("araAssessmentDetail.unfreeze_success")}
              >
                <Unlock className="h-3 w-3" /> {t("araAssessmentDetail.unfreeze")}
              </ConfirmAction>
            ) : (
              <ConfirmAction
                action={freezeAction}
                variant="default"
                destructive={false}
                title={t("araAssessmentDetail.freeze_title")}
                description={t("araAssessmentDetail.freeze_desc")}
                confirmLabel={t("araAssessmentDetail.freeze")}
                successMessage={t("araAssessmentDetail.freeze_success")}
              >
                <Lock className="h-3 w-3" /> {t("araAssessmentDetail.freeze")}
              </ConfirmAction>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">
                  <Eye className="h-3 w-3" /> {t("araAssessmentDetail.preview_report")}
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
                  <Link href={`/ara/consultant/assessments/${assessment.id}/report?lang=bilingual`} target="_blank">{t("araAssessmentDetail.bilingual")}</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="gap-1">
                  <FileDown className="h-3 w-3" /> {t("araAssessmentDetail.download_pdf")}
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
                  <a href={`/api/ara/reports/${assessment.id}/pdf?language=bilingual`}>{t("araAssessmentDetail.bilingual")}</a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {isArchived ? (
              <ConfirmAction
                action={reopenAction}
                variant="outline"
                destructive={false}
                title={t("araAssessmentDetail.reopen_title")}
                description={t("araAssessmentDetail.reopen_desc")}
                confirmLabel={t("araAssessmentDetail.reopen")}
                successMessage={t("araAssessmentDetail.reopen_success")}
              >
                <RotateCcw className="h-3 w-3" /> {t("araAssessmentDetail.reopen")}
              </ConfirmAction>
            ) : (
              <ConfirmAction
                action={archiveAction}
                variant="outline"
                destructive={false}
                title={t("araAssessmentDetail.archive_title")}
                description={t("araAssessmentDetail.archive_desc")}
                confirmLabel={t("araAssessmentDetail.archive")}
                successMessage={t("araAssessmentDetail.archive_success")}
              >
                <Archive className="h-3 w-3" /> {t("araAssessmentDetail.archive")}
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
            <TabsTrigger value="overview">{t("araAssessmentDetail.tab_overview")}</TabsTrigger>
            <TabsTrigger value="phase2">{t("araAssessmentDetail.tab_phase2_notes")}</TabsTrigger>
            <TabsTrigger value="guide">{t("araAssessmentDetail.tab_phase2_guide")}</TabsTrigger>
            <TabsTrigger value="compliance">{t("araAssessmentDetail.tab_compliance")}</TabsTrigger>
            <TabsTrigger value="portfolio">{t("araAssessmentDetail.tab_portfolio")}</TabsTrigger>
            <TabsTrigger value="respondents">{t("araAssessmentDetail.tab_respondents")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-0">

        {/* ─── Shadow AI alert ─── */}
        {shadowAi.triggered && (
          <Card className="mb-6 border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-destructive flex items-center gap-2">
                <ShieldAlert className="h-4 w-4" /> {t("araAssessmentDetail.shadow_ai_title")}
              </CardTitle>
              <CardDescription>
                {t("araAssessmentDetail.shadow_ai_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {shadowAi.matches.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {t("araAssessmentDetail.shadow_ai_mentions")}
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
                        {t("araAssessmentDetail.and_n_more", { n: shadowAi.matches.length - 5 })}
                      </li>
                    )}
                  </ul>
                </div>
              )}
              {shadowAi.low_governance_scores.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    {t("araAssessmentDetail.shadow_ai_gov_gaps")}
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
                <AlertTriangle className="h-4 w-4" /> {t("araAssessmentDetail.gap_detector_title", { count: gapAlerts.length })}
              </CardTitle>
              <CardDescription className="text-amber-900/80">
                {t("araAssessmentDetail.gap_detector_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {gapAlerts.map((a, i) => (
                  <li key={i} className="border-l-2 border-amber-500 ps-3">
                    {a.kind === "question" ? (
                      <>
                        <p className="font-medium text-xs uppercase text-amber-900/70">
                          {a.pillar_name_en} - Q{a.question_number} ({t("araAssessmentDetail.gap_spread", { n: a.spread.toFixed(1) })})
                        </p>
                        <p className="text-xs">{a.question_text_en}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {a.low_respondent}: {a.low_score.toFixed(1)} • {a.high_respondent}: {a.high_score.toFixed(1)}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-xs uppercase text-amber-900/70">
                          {a.pillar_name_en} - {t("araAssessmentDetail.gap_level_split")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t("araAssessmentDetail.gap_averaging", {
                            low: a.low_respondent,
                            lowAvg: a.low_avg.toFixed(1),
                            high: a.high_respondent,
                            highAvg: a.high_avg.toFixed(1),
                          })}
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
              <CardTitle className="text-lg">{t("araAssessmentDetail.live_scores")}</CardTitle>
              <CardDescription>
                {t("araAssessmentDetail.live_scores_desc")}
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
                  {t("araAssessmentDetail.frozen_at", { date: new Date(overallScore.score_frozen_at).toLocaleString() })}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("araAssessmentDetail.col_pillar")}</TableHead>
                  <TableHead className="text-right">{t("araAssessmentDetail.col_raw")}</TableHead>
                  <TableHead className="text-right">{t("araAssessmentDetail.col_wt")}</TableHead>
                  <TableHead className="text-right">{t("araAssessmentDetail.col_weighted")}</TableHead>
                  <TableHead>{t("araAssessmentDetail.col_maturity")}</TableHead>
                  <TableHead className="text-right">{t("araAssessmentDetail.col_vs_target")}</TableHead>
                  <TableHead className="text-right" title={t("araAssessmentDetail.col_validated_title")}>{t("araAssessmentDetail.col_validated")}</TableHead>
                  <TableHead className="text-right" title={t("araAssessmentDetail.col_gap_title")}>{t("araAssessmentDetail.col_gap")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inScopePillars.map((p) => {
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
              <CardTitle className="text-lg">{t("araAssessmentDetail.pillar_weights")}</CardTitle>
              <CardDescription>
                {t("araAssessmentDetail.pillar_weights_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updatePillarWeightsAction} className="space-y-3">
                <input type="hidden" name="assessment_id" value={assessment.id} />
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                  {inScopePillars.map((p) => {
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
                <Button type="submit" size="sm">{t("araAssessmentDetail.save_weights")}</Button>
              </form>
            </CardContent>
          </Card>
        )}

          </TabsContent>

          <TabsContent value="guide" className="space-y-0">
        {(layer2Questions ?? []).length === 0 ? (
          <Card className="mb-6">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {t("araAssessmentDetail.guide_empty_a")}
              {" "}<strong>/ara/admin/questions</strong>{" "}
              {t("araAssessmentDetail.guide_empty_b")}
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="h-4 w-4" /> {t("araAssessmentDetail.guide_title")}
              </CardTitle>
              <CardDescription>
                <strong>{t("araAssessmentDetail.guide_desc_strong")}</strong>{" "}
                {t("araAssessmentDetail.guide_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {inScopePillars.map((pillar) => {
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
          title={t("araAssessmentDetail.capability_plan_title")}
          description={t("araAssessmentDetail.capability_plan_desc")}
          emptyMessage={t("araAssessmentDetail.capability_plan_empty")}
          courses={araRecommendedCourses}
          context="ara"
        />

        {/* ─── Upskilling pathway (AI-sequenced plan from the same gaps) ─── */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-foreground">{t("araAssessmentDetail.upskilling_title")}</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            {t("araAssessmentDetail.upskilling_desc")}
          </p>
          <AraPathwayCard assessmentId={assessment.id} />
        </div>

        {/* ─── Workforce readiness rollup (Mode C) ─── *
         * Only renders when the assessment opted into the individual
         * layer. Consultant sees cohort-level factor means + per-
         * respondent breakdown + course recommendations driven by
         * cohort gaps. */}
        {assessment.include_individual_layer && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {t("araAssessmentDetail.workforce_readiness")}
                <Badge variant="secondary" className="text-[10px]">
                  {assessment.assessment_tier === "deep_dive"
                    ? t("araAssessmentDetail.tier_deep_dive")
                    : t("araAssessmentDetail.tier_snapshot")}
                </Badge>
                <Link
                  href={`/ara/cohort/${assessment.id}`}
                  target="_blank"
                  className="ms-auto text-[11px] font-medium text-accent hover:underline inline-flex items-center gap-1"
                  title={t("araAssessmentDetail.open_client_dashboard_title")}
                >
                  {t("araAssessmentDetail.open_client_dashboard")} ↗
                </Link>
              </CardTitle>
              <CardDescription>
                {t("araAssessmentDetail.workforce_desc_a")}
                <span className="font-medium text-foreground"> {t("araAssessmentDetail.workforce_desc_dashboard")}</span>{" "}
                {t("araAssessmentDetail.workforce_desc_b")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!workforceRollup || workforceRollup.respondents.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("araAssessmentDetail.workforce_empty")}
                </p>
              ) : (
                <>
                  {/* Cohort overall + factor averages */}
                  <div className="grid gap-3 sm:grid-cols-5">
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("araAssessmentDetail.cohort_overall")}
                      </p>
                      <p className="text-2xl font-bold tabular-nums mt-1">
                        {workforceRollup.cohort_overall != null
                          ? workforceRollup.cohort_overall.toFixed(2)
                          : "-"}
                        <span className="text-xs text-muted-foreground font-normal"> / 5</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {t("araAssessmentDetail.x_of_y_completed", { x: workforceRollup.completed_count, y: workforceRollup.cohort_size })}
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
                            {f.respondent_count > 0 ? f.average.toFixed(2) : "-"}
                            <span className="text-xs text-muted-foreground font-normal"> / 5</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {t("araAssessmentDetail.respondent_count", { count: f.respondent_count })}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Distribution histogram - % of cohort below target per factor */}
                  <div>
                    <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                      {t("araAssessmentDetail.development_demand")}
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
                              {t("araAssessmentDetail.x_of_y_pct", { x: f.below_target_count, y: f.respondent_count, pct })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Per-respondent table */}
                  <div>
                    <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                      {t("araAssessmentDetail.per_respondent_breakdown")}
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("araAssessmentDetail.respondent")}</TableHead>
                          <TableHead className="text-center">{t("araAssessmentDetail.factor_sense_check")}</TableHead>
                          <TableHead className="text-center">{t("araAssessmentDetail.factor_working_practice")}</TableHead>
                          <TableHead className="text-center">{t("araAssessmentDetail.factor_collaboration")}</TableHead>
                          <TableHead className="text-center">{t("araAssessmentDetail.factor_adaptive_mindset")}</TableHead>
                          <TableHead className="text-right">{t("araAssessmentDetail.overall")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {workforceRollup.respondents.map((r) => (
                          <TableRow key={r.respondent_id}>
                            <TableCell>
                              <div className="text-sm font-medium">{r.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {r.email}
                                {r.individual_only && ` · ${t("araAssessmentDetail.individual_only_tag")}`}
                              </div>
                            </TableCell>
                            {(["thinking_sense_check", "results_working_practice", "people_collaboration", "self_adaptive_mindset"] as const).map((fid) => {
                              const v = r.per_factor[fid];
                              return (
                                <TableCell key={fid} className="text-center text-xs tabular-nums">
                                  {v != null ? v.toFixed(1) : "-"}
                                </TableCell>
                              );
                            })}
                            <TableCell className="text-right font-semibold tabular-nums">
                              {r.overall != null ? r.overall.toFixed(2) : "-"}
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

        {/* Workforce-readiness course recommendations - driven by
            cohort gaps on the individual factors. Renders only when
            we have data to compute against. */}
        {assessment.include_individual_layer && workforceRollup && workforceRollup.respondents.length > 0 && (
          <RecommendedCoursesPanel
            title={t("araAssessmentDetail.workforce_training_title")}
            description={t("araAssessmentDetail.workforce_training_desc")}
            emptyMessage={t("araAssessmentDetail.workforce_training_empty")}
            courses={workforceCourseRecs}
            context="ac"
          />
        )}

        {/* ─── Agentic-AI Readiness rollup ─── *
         * Renders when the assessment opted into the agentic layer.
         * Cohort-level means across the six agentic governance dimensions
         * + per-respondent breakdown. */}
        {assessment.include_agentic_layer && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {t("araAssessmentDetail.agentic_readiness")}
                <Badge variant="secondary" className="text-[10px]">{t("araAssessmentDetail.agentic_badge")}</Badge>
              </CardTitle>
              <CardDescription>
                {t("araAssessmentDetail.agentic_desc_a")}<span className="font-medium text-foreground">{t("araAssessmentDetail.agentic_desc_delegate")}</span>{t("araAssessmentDetail.agentic_desc_b")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {!agenticRollup || !agenticRollup.respondents.some((r) => r.overall != null) ? (
                <p className="text-sm text-muted-foreground">
                  {t("araAssessmentDetail.agentic_empty")}
                </p>
              ) : (
                <>
                  {/* Cohort overall + dimension averages */}
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
                    <div className="rounded-md border bg-muted/20 p-3">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {t("araAssessmentDetail.cohort_overall")}
                      </p>
                      <p className="text-2xl font-bold tabular-nums mt-1">
                        {agenticRollup.cohort_overall != null
                          ? agenticRollup.cohort_overall.toFixed(2)
                          : "-"}
                        <span className="text-xs text-muted-foreground font-normal"> / 5</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {t("araAssessmentDetail.n_completed", { n: agenticRollup.completed_count })}
                      </p>
                    </div>
                    {agenticRollup.dimension_averages.map((d) => {
                      const dim = ARA_AGENTIC_DIMENSIONS.find((x) => x.id === d.dimension_id);
                      const tone =
                        d.average >= 4 ? "bg-emerald-50 border-emerald-200"
                        : d.average >= 3 ? "bg-amber-50 border-amber-200"
                        : "bg-rose-50 border-rose-200";
                      return (
                        <div key={d.dimension_id} className={`rounded-md border p-3 ${tone}`}>
                          <div className="flex items-center gap-1.5">
                            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: dim?.color }} />
                          </div>
                          <p className="text-xs font-semibold mt-0.5 leading-tight">{dim?.name_en}</p>
                          <p className="text-2xl font-bold tabular-nums mt-1">
                            {d.respondent_count > 0 ? d.average.toFixed(2) : "-"}
                            <span className="text-xs text-muted-foreground font-normal"> / 5</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {t("araAssessmentDetail.respondent_count", { count: d.respondent_count })}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Development-demand histogram - % below target per dimension */}
                  <div>
                    <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                      {t("araAssessmentDetail.control_gaps")}
                    </p>
                    <div className="space-y-2">
                      {agenticRollup.dimension_averages.map((d) => {
                        const dim = ARA_AGENTIC_DIMENSIONS.find((x) => x.id === d.dimension_id);
                        const pct = d.respondent_count > 0
                          ? Math.round((d.below_target_count / d.respondent_count) * 100)
                          : 0;
                        const barTone = pct >= 60 ? "bg-rose-500" : pct >= 30 ? "bg-amber-500" : "bg-emerald-500";
                        return (
                          <div key={d.dimension_id} className="flex items-center gap-3 text-xs">
                            <span className="w-44 shrink-0 flex items-center gap-1.5">
                              <span className="inline-block h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: dim?.color }} />
                              <span className="truncate">{dim?.name_en}</span>
                            </span>
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div className={`h-full ${barTone} transition-[width]`} style={{ width: `${Math.max(pct, 2)}%` }} />
                            </div>
                            <span className="w-28 shrink-0 text-right text-muted-foreground tabular-nums">
                              {t("araAssessmentDetail.x_of_y_pct", { x: d.below_target_count, y: d.respondent_count, pct })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Per-respondent breakdown */}
                  <div>
                    <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wider">
                      {t("araAssessmentDetail.per_respondent_breakdown")}
                    </p>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("araAssessmentDetail.respondent")}</TableHead>
                          <TableHead className="text-center">{t("araAssessmentDetail.dim_governance")}</TableHead>
                          <TableHead className="text-center">{t("araAssessmentDetail.dim_oversight")}</TableHead>
                          <TableHead className="text-center">{t("araAssessmentDetail.dim_risk")}</TableHead>
                          <TableHead className="text-center">{t("araAssessmentDetail.dim_access")}</TableHead>
                          <TableHead className="text-center">{t("araAssessmentDetail.dim_autonomy")}</TableHead>
                          <TableHead className="text-center">{t("araAssessmentDetail.dim_audit")}</TableHead>
                          <TableHead className="text-right">{t("araAssessmentDetail.overall")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {agenticRollup.respondents
                          .filter((r) => r.overall != null)
                          .map((r) => (
                            <TableRow key={r.respondent_id}>
                              <TableCell>
                                <div className="text-sm font-medium">{r.name}</div>
                                <div className="text-[10px] text-muted-foreground">{r.email}</div>
                              </TableCell>
                              {(["agent_governance", "human_oversight", "risk_failure", "access_control", "autonomy_calibration", "auditability"] as const).map((did) => {
                                const v = r.per_dimension[did];
                                return (
                                  <TableCell key={did} className="text-center text-xs tabular-nums">
                                    {v != null ? v.toFixed(1) : "-"}
                                  </TableCell>
                                );
                              })}
                              <TableCell className="text-right font-semibold tabular-nums">
                                {r.overall != null ? r.overall.toFixed(2) : "-"}
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

        {/* ─── Phase 2 Consultant Notes ─── */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t("araAssessmentDetail.notes_title")}</CardTitle>
            <CardDescription>
              {t("araAssessmentDetail.notes_desc_a")} <em>{t("araAssessmentDetail.include_in_report")}</em> {t("araAssessmentDetail.notes_desc_b")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Existing notes */}
            {(notes ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("araAssessmentDetail.no_notes")}</p>
            ) : (
              <div className="space-y-3">
                {(notes ?? []).map((n) => {
                  const pillarName = n.pillar_id
                    ? ARA_PILLARS.find((p) => p.id === n.pillar_id)?.name_en ?? n.pillar_id
                    : t("araAssessmentDetail.general");
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
                            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">{t("araAssessmentDetail.in_report")}</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">{t("araAssessmentDetail.internal")}</Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <form action={toggleAction}>
                            <Button type="submit" variant="outline" size="sm" className="h-7 text-xs">
                              {n.include_in_report ? t("araAssessmentDetail.make_internal") : t("araAssessmentDetail.include_in_report")}
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
                  <Label htmlFor="note_pillar" className="text-xs">{t("araAssessmentDetail.note_pillar")}</Label>
                  <select
                    id="note_pillar"
                    name="pillar_id"
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                    defaultValue=""
                  >
                    <option value="">{t("araAssessmentDetail.note_pillar_general")}</option>
                    {inScopePillars.map((p) => (
                      <option key={p.id} value={p.id}>{p.name_en}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="note_language" className="text-xs">{t("araAssessmentDetail.note_language")}</Label>
                  <select
                    id="note_language"
                    name="note_language"
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                    defaultValue={assessment.default_language}
                  >
                    <option value="en">{t("araAssessmentDetail.lang_english")}</option>
                    <option value="ar">{t("araAssessmentDetail.lang_arabic")}</option>
                  </select>
                </div>
              </div>
              <textarea
                name="note_text"
                rows={3}
                required
                maxLength={5000}
                placeholder={t("araAssessmentDetail.note_placeholder")}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" name="include_in_report" className="h-3.5 w-3.5 rounded border-input" />
                  {t("araAssessmentDetail.include_in_report")}
                </label>
                <Button type="submit" size="sm" className="gap-1">
                  <Plus className="h-3 w-3" /> {t("araAssessmentDetail.add_note")}
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
              <CardTitle className="text-lg">{t("araAssessmentDetail.compliance_title")}</CardTitle>
              <CardDescription>
                {t("araAssessmentDetail.compliance_desc", {
                  region: assessment.region === "uae" ? t("araAssessmentDetail.region_uae") : t("araAssessmentDetail.region_saudi_full"),
                })}
              </CardDescription>
            </div>
            <form action={recalcAction}>
              <Button type="submit" variant="outline" size="sm" className="gap-1">
                <RefreshCw className="h-3 w-3" /> {t("araAssessmentDetail.recalculate")}
              </Button>
            </form>
          </CardHeader>
          <CardContent className="space-y-4">
            {complianceSummaries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("araAssessmentDetail.compliance_empty")}
              </p>
            ) : (
              <>
                {/* Framework summary cards */}
                <div className="grid gap-2 md:grid-cols-2">
                  {complianceSummaries.map((s) => (
                    <div key={s.framework_id} className="rounded-lg border p-3 bg-card text-sm">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-medium">{s.framework_code}</span>
                        <Badge variant="outline" className="text-[10px]">{t("araAssessmentDetail.tier_n", { n: s.tier })}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                        {s.framework_name_en}
                      </p>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="tabular-nums font-semibold">
                          {s.percent != null ? `${s.percent}%` : "-"}
                        </span>
                        <span className="text-emerald-700">{t("araAssessmentDetail.n_met", { n: s.met })}</span>
                        <span className="text-amber-700">{t("araAssessmentDetail.n_partial", { n: s.partial })}</span>
                        <span className="text-red-700">{t("araAssessmentDetail.n_not_met", { n: s.not_met })}</span>
                        <span className="text-muted-foreground">{t("araAssessmentDetail.n_unknown", { n: s.unknown })}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Requirement list with override forms */}
                <details className="rounded-lg border bg-muted/30">
                  <summary className="px-4 py-2 cursor-pointer text-sm font-medium">
                    {t("araAssessmentDetail.all_requirements", { n: (complianceResults ?? []).length })}
                  </summary>
                  <div className="p-4 space-y-2 max-h-[600px] overflow-auto">
                    {(complianceResults ?? []).map((r) => {
                      if (!r.requirement) return null;
                      return (
                        <ComplianceRequirementRow
                          key={r.id}
                          result={r}
                          assessmentId={assessment.id}
                          t={t}
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
                <TrendingUp className="h-4 w-4" /> {t("araAssessmentDetail.yoy_title")}
              </CardTitle>
              <CardDescription>
                {yoy.compatible
                  ? t("araAssessmentDetail.yoy_compatible", { year: yoy.prior_year ?? "" })
                  : yoy.incompatibleReason}
              </CardDescription>
            </CardHeader>
            {yoy.compatible && (
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("araAssessmentDetail.col_pillar")}</TableHead>
                      <TableHead className="text-right">{yoy.prior_year ?? t("araAssessmentDetail.prior")}</TableHead>
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
                        <TableCell>{t("araAssessmentDetail.overall")}</TableCell>
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
              <Cpu className="h-4 w-4" /> {t("araAssessmentDetail.usecase_title")}
            </CardTitle>
            <CardDescription>
              {t("araAssessmentDetail.usecase_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!useCases || useCases.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("araAssessmentDetail.usecase_empty")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("araAssessmentDetail.col_name")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_stage")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_risk")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_value")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_pillar")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_owner")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_submitted_by")}</TableHead>
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
            <CardTitle className="text-lg">{t("araAssessmentDetail.materials_title")}</CardTitle>
            <CardDescription>
              {t("araAssessmentDetail.materials_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!materials || materials.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("araAssessmentDetail.materials_empty")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("araAssessmentDetail.col_type")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_name")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_submitted_by")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_source")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_uploaded")}</TableHead>
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
                {t("araAssessmentDetail.validity_title")}
              </CardTitle>
              <CardDescription>
                {t("araAssessmentDetail.validity_desc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {distortion.map((d) => {
                  const tone = d.level === "high"  ? { bg: "#fef2f2", bd: "#FB7185", fg: "#9f1239", label: t("araAssessmentDetail.validity_high") } :
                               d.level === "watch" ? { bg: "#fffbeb", bd: "#FBBF24", fg: "#78350f", label: t("araAssessmentDetail.validity_watch") } :
                                                     { bg: "#f0fdf4", bd: "#34D399", fg: "#065f46", label: t("araAssessmentDetail.validity_clean") };
                  return (
                    <div key={d.respondent_id} className="rounded-lg border p-3"
                         style={{ background: tone.bg, borderLeft: `3px solid ${tone.bd}` }}>
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {d.respondent_name}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {t("araAssessmentDetail.validity_signals", {
                              answers: d.total_responses,
                              extremity: Math.round(d.signals.extremity_pct * 100),
                              run: d.signals.longest_run,
                              drift: d.signals.anchor_deviation.toFixed(2),
                            })}
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
            <CardTitle className="text-lg">{t("araAssessmentDetail.respondents")}</CardTitle>
            <CardDescription>
              {t("araAssessmentDetail.respondents_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!respondents || respondents.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {t("araAssessmentDetail.respondents_empty")}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("araAssessmentDetail.col_name")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_email")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_role")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_lang")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_pillars_assigned")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_completed")}</TableHead>
                    <TableHead>{t("araAssessmentDetail.col_invite_link")}</TableHead>
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
                            <span className="text-xs text-muted-foreground">{t("araAssessmentDetail.none")}</span>
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
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">{t("araAssessmentDetail.status_done")}</Badge>
                        ) : r.first_opened_at ? (
                          <span className="text-amber-700">{t("araAssessmentDetail.status_in_progress")}</span>
                        ) : (
                          <span className="text-muted-foreground">{t("araAssessmentDetail.status_not_started")}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Link
                            href={`/ara/respond/${r.access_token}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                          >
                            <Link2 className="h-3 w-3" /> {t("araAssessmentDetail.preview")}
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
            <CardTitle className="text-lg">{t("araAssessmentDetail.add_respondent")}</CardTitle>
            <CardDescription>
              {t("araAssessmentDetail.add_respondent_desc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createRespondentAction} className="space-y-5">
              <input type="hidden" name="assessment_id" value={assessment.id} />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">{t("araAssessmentDetail.field_name")}</Label>
                  <Input id="name" name="name" required maxLength={200} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name_ar">{t("araAssessmentDetail.field_name_ar")}</Label>
                  <Input id="name_ar" name="name_ar" maxLength={200} dir="rtl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t("araAssessmentDetail.field_email")}</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="language_preference">{t("araAssessmentDetail.field_language")}</Label>
                  <select
                    id="language_preference"
                    name="language_preference"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    defaultValue={assessment.default_language}
                  >
                    <option value="en">English</option>
                    <option value="ar">{t("araAssessmentDetail.lang_arabic_native")}</option>
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="role_label_en">{t("araAssessmentDetail.field_role")}</Label>
                  <Input
                    id="role_label_en"
                    name="role_label_en"
                    placeholder={t("araAssessmentDetail.field_role_placeholder")}
                    maxLength={200}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("araAssessmentDetail.assign_pillars")}</Label>
                <p className="text-xs text-muted-foreground">
                  {t("araAssessmentDetail.assign_pillars_help", { n: inScopePillars.length })}
                </p>
                <div className="grid gap-2 sm:grid-cols-2 rounded-lg border p-4">
                  {inScopePillars.map((p) => (
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
                    {t("araAssessmentDetail.individual_layer_note")}
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
                      {t("araAssessmentDetail.individual_only_label")}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("araAssessmentDetail.individual_only_help")}
                    </p>
                  </div>
                </div>
              )}

              <Button type="submit">{t("araAssessmentDetail.add_respondent")}</Button>
            </form>
          </CardContent>
        </Card>

        {/* ─── Bulk CSV import ─── *
         * Lets a consultant paste a CSV (header + rows) to invite many
         * respondents at once. Closes a parity gap with industry
         * assessment platforms that ship CSV import as a core feature. */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">{t("araAssessmentDetail.bulk_import_title")}</CardTitle>
            <CardDescription>
              {t("araAssessmentDetail.bulk_import_required")}{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">name</code>,{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">email</code>.{" "}
              {t("araAssessmentDetail.bulk_import_optional")}{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">name_ar</code>,{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">role</code>,{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">language</code> (en/ar),{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">pillars</code> {t("araAssessmentDetail.bulk_import_pipe")}
              {assessment.include_individual_layer && (
                <>
                  {" "}{t("araAssessmentDetail.bulk_import_individual_a")}{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-xs">individual_only</code>{" "}
                  {t("araAssessmentDetail.bulk_import_individual_b")}
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={bulkImportRespondentsAction} className="space-y-4">
              <input type="hidden" name="assessment_id" value={assessment.id} />
              <div className="space-y-2">
                <Label htmlFor="csv-paste">{t("araAssessmentDetail.bulk_csv_content")}</Label>
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
                  {t("araAssessmentDetail.bulk_skipped")}{" "}
                  <code className="text-[10px]">
                    strategy · data · technology · talent · culture · governance · operations · model_management
                  </code>
                </p>
              </div>
              <Button type="submit" variant="outline">
                <Plus className="h-4 w-4 me-1" /> {t("araAssessmentDetail.bulk_import_btn")}
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
  t,
}: {
  result: ComplianceResultRow;
  assessmentId: string;
  t: ServerT;
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
          {result.evidence_note && <span title={t("araAssessmentDetail.overridden")} className="text-[10px]">✎</span>}
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
            <option value="met">{t("araAssessmentDetail.status_compliant")}</option>
            <option value="partial">{t("araAssessmentDetail.status_partial")}</option>
            <option value="not_met">{t("araAssessmentDetail.status_action_required")}</option>
            <option value="unknown">{t("araAssessmentDetail.status_needs_verification")}</option>
          </select>
          <input
            name="evidence_note"
            placeholder={t("araAssessmentDetail.evidence_placeholder")}
            defaultValue={result.evidence_note ?? ""}
            maxLength={2000}
            className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs"
          />
          <Button type="submit" size="sm" className="h-8 text-xs">{t("araAssessmentDetail.save")}</Button>
        </div>
      </form>
    </details>
  );
}
