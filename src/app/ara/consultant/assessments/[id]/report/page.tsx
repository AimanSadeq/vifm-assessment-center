import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller, isInternalAraRender } from "@/lib/ara/auth-guards";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { ARA_PILLARS, ARA_MATURITY_LEVELS, ARA_OVERALL_BANDS } from "@/lib/constants/ara-pillars";
import { ARA_STAGE_MAP, getPillarsForAssessment } from "@/lib/constants/ara-stages";
import { summarizeComplianceByFramework } from "@/lib/ara/compliance";
import { detectAraShadowAi } from "@/lib/ara/detectors";
import { computePeerBenchmarks } from "@/lib/ara/peer-benchmarks";
import { computeYoYComparison } from "@/lib/ara/year-on-year";
import { computeWorkforceReadiness } from "@/lib/ara/workforce-readiness";
import { computeAgenticReadiness } from "@/lib/ara/agentic-readiness";
import { ARA_INDIVIDUAL_FACTORS } from "@/lib/constants/ara-individual-factors";
import { ARA_AGENTIC_DIMENSIONS } from "@/lib/constants/ara-agentic-dimensions";
import { MaturityGauge } from "./_components/maturity-gauge";
import { RadarChart } from "./_components/radar-chart";
import { ComplianceSummary } from "./_components/compliance-summary";
import { GapHeatmap, bucketRespondentsByLevel } from "./_components/gap-heatmap";
import { InvestmentMatrix } from "./_components/investment-matrix";
import { GanttRoadmap } from "./_components/gantt-roadmap";
import { tr, type ReportLang } from "./_components/report-i18n";
import { BilingualReport } from "./_components/bilingual-report";
import { PillarProfileChart, PillarBandChart } from "./_components/report-charts";
import { recommendationsForPillar } from "./_components/report-recommendations";
import { araAssessmentProvisional } from "@/lib/ara/provisional";
import { fetchAllPages } from "@/lib/ara/paginate";
import { ProvisionalReportStrip } from "@/components/shared/provisional-banner";
import { orgFactSheetRows } from "@/lib/reports/fact-sheet-content";
import { PageRef } from "./_components/page-ref";
import { ARA_RETENTION_YEARS } from "@/lib/constants/ara-retention";
import {
  SectionHeader, StatTile, Metric, FindingCard, inferFindingType,
  Callout, EmptyCallout, StatusChip, FindingsPanel, RecommendationCard,
  recommendationsFor, TOKENS,
} from "./_components/report-primitives";
import type {
  AraAssessment, AraOrganization, AraPillarId,
} from "@/types/ara";
import "./report.css";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

type PillarScoreRow = {
  pillar_id: string;
  raw_score: number | null;
  maturity_level: number | null;
  maturity_label_en: string | null;
  benchmark_gap: number | null;
  self_assessment_score: number | null;
  consultant_validated_score: number | null;
  perception_gap: number | null;
};

type ConsultantNoteRow = {
  pillar_id: string | null;
  note_text: string;
  note_text_ar: string | null;
  include_in_report: boolean;
};

export default async function AraReportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { bare?: string; lang?: string };
}) {
  const bare = searchParams?.bare === "1";
  const langParam = searchParams?.lang === "ar" ? "ar" : searchParams?.lang === "bilingual" ? "bilingual" : "en";
  const sb = createServiceClient();

  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("*, organization:ara_organizations(id, name, name_ar, region, sector)")
    .eq("id", params.id)
    .maybeSingle<
      AraAssessment & {
        organization: Pick<AraOrganization, "id" | "name" | "name_ar" | "region" | "sector"> | null;
      }
    >();

  if (!assessment) return notFound();

  // Ownership: layout gates role; a consultant may only view assessments they
  // own (admins all). The PDF route forwards the owner's cookies to Puppeteer,
  // and additionally sends the server-only x-ara-internal header - that route
  // has ALREADY authorized its caller via requireAssessmentOwner (which also
  // admits a portal client_manager for their own org's assessment), so the
  // internal render skips this consultant-shaped ownership check.
  const internalRender = await isInternalAraRender();
  if (!internalRender) {
    const caller = await getCurrentCaller();
    if (caller && caller.role !== "admin" && assessment.consultant_id !== caller.uid) {
      return notFound();
    }
  }

  const [
    { data: pillarScores },
    { data: overallScore },
    { data: notes },
    complianceSummaries,
    shadowAi,
    { data: respondents },
    { data: materials },
    { data: version },
  ] = await Promise.all([
    sb
      .from("ara_pillar_scores")
      .select("pillar_id, raw_score, maturity_level, maturity_label_en, maturity_label_ar, benchmark_gap, self_assessment_score, consultant_validated_score, perception_gap")
      .eq("assessment_id", assessment.id)
      .returns<PillarScoreRow[]>(),
    sb
      .from("ara_assessment_scores")
      .select("overall_score, overall_label_en, overall_label_ar, score_frozen_at")
      .eq("assessment_id", assessment.id)
      .maybeSingle<{
        overall_score: number | null;
        overall_label_en: string | null;
        overall_label_ar: string | null;
        score_frozen_at: string | null;
      }>(),
    sb
      .from("ara_consultant_notes")
      .select("pillar_id, note_text, note_text_ar, include_in_report")
      .eq("assessment_id", assessment.id)
      .eq("include_in_report", true)
      .returns<ConsultantNoteRow[]>(),
    summarizeComplianceByFramework(assessment.id),
    detectAraShadowAi(assessment.id),
    sb
      .from("ara_respondents")
      .select("name, role_label_en, email, completed_at, assignments:ara_respondent_pillar_assignments(pillar_id)")
      .eq("assessment_id", assessment.id)
      .order("created_at"),
    sb
      .from("ara_supporting_materials")
      .select("material_name, material_type, respondent:ara_respondents(name)")
      .eq("assessment_id", assessment.id),
    assessment.question_bank_version_id
      ? sb
          .from("ara_question_bank_versions")
          .select("version_number, version_label, published_at")
          .eq("id", assessment.question_bank_version_id)
          .maybeSingle<{ version_number: string; version_label: string | null; published_at: string | null }>()
      : Promise.resolve({ data: null }),
  ]);

  // Response rows for the gap heatmap - pillar × question-number bucket.
  // PAGINATED (1000-row cap) + the same layer exclusion scoring.ts applies:
  // individual-factor and Agentic-AI items reuse a storage pillar_id but are
  // separate constructs - counting them polluted the governance /
  // model_management heatmap cells in the client PDF.
  const responseRows = await fetchAllPages<unknown>((from, to) =>
    sb
      .from("ara_responses")
      .select("question_score, respondent_id, question:ara_questions(pillar_id, question_number, individual_factor_id, agentic_dimension_id)")
      .eq("assessment_id", assessment.id)
      .order("id")
      .range(from, to)
  ).catch((e): unknown[] => {
    console.error(`[ara report] heatmap response load failed for ${assessment.id}:`, e);
    return [];
  });

  // Per-respondent pillar means for the deep-dive spread strips: how each
  // individual respondent averaged on each pillar (org Layer-1 items only -
  // individual-factor and agentic items are separate constructs). Powers the
  // PillarBandChart dot layer so the reader SEES cohort agreement/disagreement.
  const pillarRespondentMeans = new Map<string, number[]>();
  {
    const acc = new Map<string, Map<string, { sum: number; n: number }>>();
    for (const raw of responseRows as Array<{
      question_score: number | null;
      respondent_id?: string | null;
      question: { pillar_id: string | null; individual_factor_id: string | null; agentic_dimension_id: string | null } | null;
    }>) {
      const q = raw.question;
      if (!q || !q.pillar_id || q.individual_factor_id || q.agentic_dimension_id) continue;
      if (raw.question_score == null || !raw.respondent_id) continue;
      const byResp = acc.get(q.pillar_id) ?? new Map<string, { sum: number; n: number }>();
      const cell = byResp.get(raw.respondent_id) ?? { sum: 0, n: 0 };
      cell.sum += Number(raw.question_score);
      cell.n += 1;
      byResp.set(raw.respondent_id, cell);
      acc.set(q.pillar_id, byResp);
    }
    for (const [pid, byResp] of acc) {
      pillarRespondentMeans.set(
        pid,
        Array.from(byResp.values()).filter((c) => c.n > 0).map((c) => c.sum / c.n)
      );
    }
  }

  // Verified validation-evidence for the appendix - surfaces every
  // distinct anchor-instrument citation used by any question in the
  // bank version this assessment locked to. Filtered server-side to
  // only `verified` / `edited` items so AI-proposed-but-not-reviewed
  // anchors never reach the client. (Migration 00028.)
  // Wrapped in try/catch so reports continue to render on databases
  // that haven't applied 00028 yet - the appendix subsection just
  // won't appear, instead of erroring the whole report.
  let questionsWithEvidence: Array<{ validation_evidence: unknown }> | null = null;
  if (assessment.question_bank_version_id) {
    try {
      const { data, error } = await sb
        .from("ara_questions")
        .select("validation_evidence")
        .eq("version_id", assessment.question_bank_version_id)
        .not("validation_evidence", "is", null);
      if (!error) questionsWithEvidence = (data as Array<{ validation_evidence: unknown }>) ?? null;
    } catch {
      // column doesn't exist (pre-migration-00028) - leave null.
    }
  }

  type AnchorInstrument = { name: string; citation: string };
  const evidenceAnchors: AnchorInstrument[] = [];
  const seenCitations = new Set<string>();
  for (const r of (questionsWithEvidence ?? []) as Array<{ validation_evidence: { review_status?: string; anchor_instruments?: AnchorInstrument[] } | null }>) {
    const ev = r.validation_evidence;
    if (!ev) continue;
    if (ev.review_status !== "verified" && ev.review_status !== "edited") continue;
    for (const a of ev.anchor_instruments ?? []) {
      if (!seenCitations.has(a.citation)) {
        seenCitations.add(a.citation);
        evidenceAnchors.push({ name: a.name, citation: a.citation });
      }
    }
  }
  evidenceAnchors.sort((a, b) => a.name.localeCompare(b.name));

  // Peer benchmarks (real sector medians when N ≥ 3 peers exist).
  const peerBenchmarks = await computePeerBenchmarks(
    assessment.id,
    assessment.region,
    assessment.sector
  );

  // Year-on-year comparison against the prior assessment for this org.
  // Returns null on the first assessment for an org; returns
  // {compatible: false, ...} when the prior used a different major
  // question-bank version. The render branch handles all three states.
  const yoyComparison = await computeYoYComparison(assessment.id);

  // Mode C workforce readiness rollup - only when the assessment opted
  // into the individual layer. Tolerant of missing data: returns null
  // and the section render branch falls through to nothing.
  const workforceRollup = assessment.include_individual_layer
    ? await computeWorkforceReadiness(assessment.id).catch((e) => {
        console.error("[ara-report] workforce rollup failed:", e);
        return null;
      })
    : null;

  // Agentic-AI Readiness rollup - only when the assessment opted into the
  // agentic layer. Same tolerant pattern as the workforce rollup.
  const agenticRollup = assessment.include_agentic_layer
    ? await computeAgenticReadiness(assessment.id).catch((e) => {
        console.error("[ara-report] agentic rollup failed:", e);
        return null;
      })
    : null;

  // Use case inventory for the portfolio report section.
  const { data: useCaseRows } = await sb
    .from("ara_use_cases")
    .select("id, name, stage, pillar_id, risk_level, value_level, business_owner")
    .eq("assessment_id", assessment.id)
    .order("stage")
    .order("created_at");

  // Cohort maturity distribution per pillar (replaces the old item-number
  // buckets): how many respondents land in each canonical maturity level.
  // Built from the per-respondent pillar means computed above.
  const heatmapData = bucketRespondentsByLevel(pillarRespondentMeans);
  const heatmapCohortSize = new Set(
    (responseRows as Array<{ respondent_id?: string | null }>)
      .map((r) => r.respondent_id)
      .filter(Boolean)
  ).size;

  const pillarMap = new Map<AraPillarId, PillarScoreRow>();
  (pillarScores ?? []).forEach((p) => pillarMap.set(p.pillar_id as AraPillarId, p));

  // Which pillars are in scope for THIS assessment (stage default OR the
  // pillars_in_scope override). The report must show only these - iterating the
  // full 8-pillar catalogue anywhere pillar-driven makes a Department (4) or
  // Division (6) engagement read as a half-assessed enterprise, zero-filling the
  // out-of-scope pillars in the client-facing PDF. `scopedPillars` is the single
  // in-scope list every section below uses instead of ARA_PILLARS.
  const inScopePillarIds = getPillarsForAssessment({
    engagement_stage: assessment.engagement_stage,
    pillars_in_scope: assessment.pillars_in_scope ?? null,
  });
  const scopedPillars = ARA_PILLARS.filter((p) => inScopePillarIds.includes(p.id));

  const scoreMap = new Map<AraPillarId, number | null>();
  scopedPillars.forEach((p) => {
    const row = pillarMap.get(p.id);
    scoreMap.set(p.id, row?.raw_score != null ? Number(row.raw_score) : null);
  });

  const notesByPillar = new Map<string, ConsultantNoteRow[]>();
  (notes ?? []).forEach((n) => {
    const key = n.pillar_id ?? "_general";
    const arr = notesByPillar.get(key) ?? [];
    arr.push(n);
    notesByPillar.set(key, arr);
  });

  const overall = overallScore?.overall_score != null ? Number(overallScore.overall_score) : null;
  const overallLabel = overallScore?.overall_label_en ?? null;

  // % of the 4.00 AI Ready target - the headline way scores are expressed in
  // this report (a signed gap like "+1.69" read as being AHEAD of target).
  const pctOfTarget = (score: number) => Math.round((score / 4.0) * 100);

  // Phase 2 (the consultant validation workshop) is a Division/Enterprise
  // deliverable - ARA_STAGE_MAP marks it `department: false`, and this report
  // already gates the other Stage 2+ outputs (investment matrix, roadmap) the
  // same way. Anything that offers Phase 2 as the thing that will verify a
  // finding must check this first, or a Department client is promised a
  // workshop their tier does not include.
  const hasPhase2 = assessment.engagement_stage !== "department";

  // Roster layout. Column presence is decided ONCE over the whole roster so the
  // profile page and its continuation pages never disagree about the columns;
  // a column nobody has data for is dropped rather than printed as "-".
  const rosterShowRole = (respondents ?? []).some((r: any) => r.role_label_en);
  const rosterShowPillars = (respondents ?? []).some(
    (r: any) => (r.assignments ?? []).length > 0
  );
  const rosterCols = 2 + (rosterShowRole ? 1 : 0) + (rosterShowPillars ? 1 : 0);
  // A Name+Status roster renders two-up (see RespondentTable), so twice the
  // names fit per page. The first page is smaller: it shares the sheet with the
  // client-details and methodology tables.
  const rosterTwoUp = rosterCols === 2;
  const ROSTER_FIRST_PAGE = rosterTwoUp ? 28 : 16;
  const ROSTER_PER_PAGE = rosterTwoUp ? 44 : 22;
  const strengths: Array<{ pillar: string; score: number }> = [];
  const approaching: Array<{ pillar: string; score: number }> = [];
  const gaps: Array<{ pillar: string; score: number; gap: number }> = [];
  scopedPillars.forEach((p) => {
    const row = pillarMap.get(p.id);
    if (row?.raw_score == null) return;
    const s = Number(row.raw_score);
    if (s >= 4.0) strengths.push({ pillar: p.name_en, score: s });
    else if (s < 3.0) gaps.push({ pillar: p.name_en, score: s, gap: Number(row.benchmark_gap ?? 0) });
    else approaching.push({ pillar: p.name_en, score: s });
  });
  strengths.sort((a, b) => b.score - a.score);
  gaps.sort((a, b) => a.score - b.score);

  // Stage definition drives which pillars are in scope for this report.
  // Stage 1 (department) → 4 pillars; Stage 2 (division) → 6; Stage 3
  // (enterprise) → all 8. We use this to filter deep-dives below.
  // Defensive fallback - older rows pre-migration default to enterprise.
  const stageDef = ARA_STAGE_MAP[assessment.engagement_stage] ?? ARA_STAGE_MAP.enterprise;

  const reportDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const region = assessment.region === "uae" ? "United Arab Emirates" : "Saudi Arabia";
  const sectorLabel = assessment.sector.charAt(0).toUpperCase() + assessment.sector.slice(1);

  // Pillar data for the investment priority matrix - uses pillar weights
  // as the value proxy and benchmark gap as the effort proxy.
  const investmentData = scopedPillars.map((p) => ({
    pillar_id: p.id,
    raw_score: pillarMap.get(p.id)?.raw_score != null ? Number(pillarMap.get(p.id)!.raw_score) : null,
    pillar_weight: ((assessment.pillar_weights as Record<string, number>)?.[p.id] ?? 12.5),
  }));

  // Roadmap initiatives - derive from gaps (Quick Wins / Build) and
  // strengths (Transform). Consultant Phase 2 work can replace later.
  const roadmapInitiatives = [
    ...gaps.slice(0, 2).map((g) => ({
      name: `Stabilise ${g.pillar} fundamentals`,
      pillar: g.pillar,
      horizon: "quick" as const,
    })),
    ...gaps.slice(0, 3).map((g) => ({
      name: `Institutionalise ${g.pillar} practices`,
      pillar: g.pillar,
      horizon: "build" as const,
    })),
    ...strengths.slice(0, 2).map((s) => ({
      name: `Scale ${s.pillar} leadership`,
      pillar: s.pillar,
      horizon: "transform" as const,
    })),
  ];

  // Language selection - "bilingual" renders the full report twice,
  // first in English then in Arabic, with a divider page between.
  const rtl = langParam === "ar";
  const outerDir = rtl ? "rtl" : "ltr";
  const t = (key: Parameters<typeof tr>[1]) => tr(rtl ? "ar" : "en", key);

  // Option 2 gate: flag the report provisional if it served questions an SME has
  // not yet approved (migration 00184). Appears on-screen AND in the PDF (the PDF
  // is this page rendered headless). Clears per-pillar as content is approved.
  const provisional = await araAssessmentProvisional(params.id);
  const provisionalStrip = provisional.provisional ? (
    <ProvisionalReportStrip language={langParam === "bilingual" ? "bilingual" : rtl ? "ar" : "en"} />
  ) : null;

  // Bilingual side-by-side landscape is its own layout - render it here
  // instead of the portrait EN/AR flow below.
  if (langParam === "bilingual") {
    return (
      <>
        <BackLink href="/ara" label="Back" history />
        {!bare && (
          <div className="no-print bg-gray-100 py-6 px-4 text-center">
            <p className="text-sm text-muted-foreground">
              Bilingual preview (landscape, English left · Arabic right).
              Use <strong>Download PDF</strong> on the assessment page to export.
            </p>
          </div>
        )}
        <div className={bare ? "" : "bg-gray-100 py-8"}>
          {provisionalStrip}
          <BilingualReport
            organizationName={assessment.organization?.name ?? "Client"}
            organizationNameAr={assessment.organization?.name_ar ?? null}
            region={assessment.region}
            sector={assessment.sector}
            isSandbox={assessment.is_sandbox}
            reportDate={reportDate}
            overall={overall}
            overallLabelEn={overallLabel}
            overallLabelAr={overallScore?.overall_label_ar ?? null}
            pillarMap={pillarMap}
            scoreMap={scoreMap}
            strengths={strengths}
            gaps={gaps}
            heatmapData={heatmapData}
            heatmapCohortSize={heatmapCohortSize}
            investmentData={investmentData}
            roadmapInitiatives={roadmapInitiatives}
            complianceSummaries={complianceSummaries}
            notesByPillar={notesByPillar}
            shadowAiTriggered={shadowAi.triggered}
            pillarWeights={assessment.pillar_weights as Record<string, number>}
            peerBenchmarks={peerBenchmarks}
            engagementStage={assessment.engagement_stage}
            scopeLabel={assessment.scope_label}
            scopeLabelAr={assessment.scope_label_ar}
            useCases={(useCaseRows ?? []) as any}
            yoyComparison={yoyComparison}
            respondents={(respondents ?? []) as any}
            currentYear={assessment.assessment_year}
            pillarsInScope={getPillarsForAssessment({
              engagement_stage: assessment.engagement_stage,
              pillars_in_scope: assessment.pillars_in_scope ?? null,
            })}
            questionsPerPillar={(assessment as { questions_per_pillar?: number | null }).questions_per_pillar ?? null}
            workforceRollup={workforceRollup}
            agenticRollup={agenticRollup}
            includeIndividualLayer={assessment.include_individual_layer}
            includeAgenticLayer={assessment.include_agentic_layer}
            assessmentTier={assessment.assessment_tier}
          />
        </div>
      </>
    );
  }

  return (
    <>
      {!bare && (
        <div className="no-print bg-gray-100 py-6 px-4 text-center">
          <p className="text-sm text-muted-foreground">
            Preview mode. Use the <strong>Download PDF</strong> button on the
            assessment page to export.
          </p>
        </div>
      )}

      <div className={`report-body-wrap ${bare ? "" : "bg-gray-100 py-8"}`} dir={outerDir}>
        {/* ─── PAGE 1 - Cover ─── */}
        <section
          className="report-page report-cover flex flex-col justify-between"
          style={{ background: "#010131", color: "white" }}
        >
          <div>
            {/* The provisional disclosure lives ON the cover: as a sibling above
                the page sections it joined the print flow and pushed a sliver of
                every page onto the next. */}
            {provisionalStrip && (
              <div style={{ marginBottom: "10pt" }}>{provisionalStrip}</div>
            )}
            <div className="flex items-center gap-3">
              <VifmLogo variant="white" size="md" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest" style={{ opacity: 0.7 }}>
              Confidential - {assessment.is_sandbox ? "Sample - Not for Client Distribution" : "For Internal VIFM Use"}
            </p>
            {/* Stage badge on the cover - prominent gold/violet/teal pill
                so readers know which deliverable scope they have. */}
            <div style={{ marginTop: "18pt" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "6pt",
                padding: "4pt 12pt", borderRadius: "999pt",
                fontSize: "9pt", fontWeight: 700, letterSpacing: "0.12em",
                textTransform: "uppercase",
                background: stageDef.tone === "teal" ? "rgba(45, 212, 191, 0.15)" : stageDef.tone === "violet" ? "rgba(167, 139, 250, 0.18)" : "rgba(251, 191, 36, 0.15)",
                color: stageDef.tone === "teal" ? "#5EEAD4" : stageDef.tone === "violet" ? "#C4B5FD" : "#FCD34D",
                border: `1pt solid ${stageDef.tone === "teal" ? "#5EEAD4" : stageDef.tone === "violet" ? "#C4B5FD" : "#FCD34D"}40`,
              }}>
                Stage {stageDef.number} · {stageDef.label_en}
                {stageDef.is_pro_bono && " · Complimentary"}
              </span>
            </div>
            <h1 className="report-h1" style={{ color: "white", fontSize: "36pt", margin: "20pt 0 8pt" }}>
              {assessment.organization?.name ?? "Client"}
            </h1>
            {assessment.scope_label && (
              <p style={{ color: "white", opacity: 0.85, fontSize: "16pt", marginBottom: "12pt", fontWeight: 500 }}>
                {assessment.scope_label}
              </p>
            )}
            <p className="text-lg" style={{ color: "white", opacity: 0.85 }}>
              AI Readiness Compass® Report
            </p>
            <p dir="rtl" className="text-lg" style={{ color: "white", opacity: 0.85, marginTop: 8 }}>
              تقرير بوصلة الاستعداد للذكاء الاصطناعي®
            </p>
          </div>
          <div className="flex justify-between text-xs" style={{ color: "white", opacity: 0.75 }}>
            <div>
              <p>{region}</p>
              <p>{sectorLabel}</p>
            </div>
            <div className="text-right">
              <p>Report generated {reportDate}</p>
              <p>Virginia Institute of Finance and Management</p>
            </div>
          </div>
        </section>

        {/* ─── PAGE 2 - Executive Summary ─── */}
        <section className="report-page">
          <SectionHeader
            eyebrow="Executive summary"
            title={t("exec_summary")}
            kicker={`Weighted average of the ${scopedPillars.length} in-scope AI Readiness pillars. Regulatory compliance is assessed separately against the frameworks applicable to ${region}.`}
          />

          {/* Custom-scope caveat (migration 00198): a reduced form answers N
              questions per pillar - scores are indicative and not directly
              comparable to full-form benchmarks or prior full-form years. */}
          {((assessment as { questions_per_pillar?: number | null }).questions_per_pillar ?? null) != null && (
            <div style={{ border: "1pt solid #f5d9a8", background: "#fffbeb", borderRadius: "4pt", padding: "6pt 9pt", marginBottom: "8pt", fontSize: "8.5pt", color: "#78350f" }}>
              {rtl ? (
                <p style={{ margin: 0 }} dir="rtl">
                  <b>نموذج مخصّص مختصر.</b> استخدم هذا التقييم نطاقاً مخصّصاً من {scopedPillars.length} ركائز بواقع {String((assessment as { questions_per_pillar?: number | null }).questions_per_pillar)} أسئلة لكل ركيزة. النتائج استرشادية ولا ينبغي مقارنتها مباشرة بمعايير النموذج الكامل أو بتقييمات الأعوام السابقة الكاملة.
                </p>
              ) : (
                <p style={{ margin: 0 }}>
                  <b>Custom reduced form.</b> This assessment used a custom scope of {scopedPillars.length} pillar{scopedPillars.length === 1 ? "" : "s"} at {(assessment as { questions_per_pillar?: number | null }).questions_per_pillar} question{(assessment as { questions_per_pillar?: number | null }).questions_per_pillar === 1 ? "" : "s"} per pillar. Scores are indicative and should not be compared directly against full-form benchmarks or prior full-form assessments.
                </p>
              )}
            </div>
          )}

          {/* KPI strip - four tiles. Denominators reflect the assessment's
              SCOPED pillar count, not a hardcoded 8 - a Department (4) or
              Division (6) engagement previously read "2 / 8" as if half the
              assessment were missing. */}
          <div className="stat-strip">
            <StatTile
              label="Overall readiness"
              value={overall != null ? overall.toFixed(2) : "-"}
              suffix="/ 5.00"
              accent={overallLabel ?? ""}
              accentColor="#5391D5"
            />
            <StatTile
              label="At / above target"
              value={String(strengths.length)}
              suffix={`/ ${scopedPillars.length}`}
              accent="Pillars scoring ≥ 4.00"
              accentColor="#34D399"
            />
            <StatTile
              label="Approaching target"
              value={String(approaching.length)}
              suffix={`/ ${scopedPillars.length}`}
              accent="Pillars scoring 3.00 - 3.99"
              accentColor="#FBBF24"
            />
            <StatTile
              label="Requiring focus"
              value={String(gaps.length)}
              suffix={`/ ${scopedPillars.length}`}
              accent="Pillars scoring < 3.00"
              accentColor="#FB7185"
            />
          </div>

          {/* Narrative + gauge */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr",
            gap: "20pt", marginTop: "18pt", alignItems: "center" }}>
            <div>
              <p className="report-muted uppercase" style={{ fontSize: "8.5pt",
                letterSpacing: "0.08em", margin: 0, fontWeight: 600 }}>
                Narrative
              </p>
              <p className="report-body" style={{ marginTop: "6pt" }}>
                <strong>{assessment.organization?.name ?? "The organization"}</strong> scores{" "}
                <strong>{overall != null ? overall.toFixed(2) : "-"} / 5.00</strong>
                {overallLabel && <> ({overallLabel})</>}. The profile shows{" "}
                <strong>{strengths.length}</strong> {strengths.length === 1 ? "pillar" : "pillars"} at
                or above the AI Ready target, <strong>{approaching.length}</strong> approaching it,
                and <strong>{gaps.length}</strong>{" "}
                {gaps.length === 1 ? "pillar" : "pillars"} requiring focus.
                {strengths.length > 0 && (
                  <> Leading strengths are <strong>{strengths.slice(0, 2).map(s => s.pillar).join(" and ")}</strong>.</>
                )}
                {gaps.length > 0 && (
                  <> Primary gap is <strong>{gaps[0].pillar}</strong>.</>
                )}
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <MaturityGauge score={overall} />
            </div>
          </div>

          {/* Findings panels.
              Both panels list EVERY pillar in their category, not a top-3 slice.
              The slice silently dropped pillars the narrative had just counted:
              on an 8-pillar run reading "4 approaching it, and 4 requiring
              focus", the panels showed 3 and 3, leaving a reader to hunt for two
              pillars that appear nowhere on the page. The two lists now sum to
              the scored in-scope pillars, so the counts in the sentence above
              and the rows below always reconcile. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "12pt", marginTop: "18pt" }}>
            <FindingsPanel
              variant="strength"
              title={
                strengths.length > 0
                  ? `At or approaching target (${strengths.length + approaching.length})`
                  : `Closest to target (${approaching.length})`
              }
              emptyMessage="No pillar reached 3.00 in this run."
              items={[...strengths, ...approaching]
                .sort((a, b) => b.score - a.score)
                .map(s => ({
                  headline: s.pillar,
                  metric: `${s.score.toFixed(2)} · ${pctOfTarget(s.score)}% of target`,
                }))}
            />
            <FindingsPanel
              variant="gap"
              title={`Requiring focus (${gaps.length})`}
              emptyMessage="Every in-scope pillar is at 3.00 or above."
              items={gaps.map(g => ({
                headline: g.pillar,
                metric: `${g.score.toFixed(2)} · ${pctOfTarget(g.score)}% of target`,
              }))}
            />
          </div>
        </section>

        {/* ─── PAGE 3 - How to Read This Report ─── */}
        <section className="report-page">
          <h2 className="report-h2">{t("how_to_read")}</h2>
          <p className="report-body">
            This report summarises findings across the {scopedPillars.length} in-scope
            pillars of AI Readiness. Each pillar is scored 1-5 against a
            behavioural rubric, and the overall score is a weighted aggregate.
          </p>

          <h3 className="report-h3">Maturity Scale</h3>
          <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={cellHead}>Level</th>
                <th style={cellHead}>Label</th>
                <th style={cellHead}>Score range</th>
                <th style={cellHead}>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {ARA_MATURITY_LEVELS.map((m) => (
                <tr key={m.level} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={cell}>L{m.level}</td>
                  <td style={cell}>
                    <strong>{m.label_en}</strong>
                    <span className="report-muted" style={{ marginLeft: 8 }} dir="rtl">
                      {m.label_ar}
                    </span>
                  </td>
                  <td style={cell}>{m.min.toFixed(1)}-{m.max.toFixed(1)}</td>
                  <td style={cell} className="report-muted">
                    {m.level === 1 && "No AI activity or understanding."}
                    {m.level === 2 && "Early discovery; ad-hoc pilots."}
                    {m.level === 3 && "Active development; policies emerging."}
                    {m.level === 4 && "AI-ready; systematic deployment."}
                    {m.level === 5 && "Leading practice; embedded at scale."}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 className="report-h3">Overall Score Interpretation</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6pt" }}>
            {ARA_OVERALL_BANDS.map((b) => (
              <div
                key={b.label_en}
                style={{
                  background: b.color,
                  color: "white",
                  padding: "8pt",
                  borderRadius: "4pt",
                  fontSize: "9pt",
                  textAlign: "center",
                  fontWeight: 500,
                }}
              >
                <div>{b.label_en}</div>
                <div style={{ fontSize: "8pt", opacity: 0.9 }}>
                  {b.min.toFixed(1)}-{b.max.toFixed(1)}
                </div>
              </div>
            ))}
          </div>

          <h3 className="report-h3">Compliance Status</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8pt", marginTop: "6pt" }}>
            <StatusChip color="#34D399" label="Compliant" body="Fully meets the requirement." />
            <StatusChip color="#FBBF24" label="Partially Compliant" body="Partial evidence; gaps remain." />
            <StatusChip color="#FB7185" label="Action Required" body="Requirement not met." />
            <StatusChip color="#9ca3af" label="Needs Verification" body="Evidence not yet provided." />
          </div>
        </section>


        {/* ─── PAGE 5 - Radar Overview ─── */}
        <section className="report-page">
          <h2 className="report-h2">{t("pillar_overview")}</h2>
          <p className="report-body">
            The radar below plots current pillar scores against the <strong>AI Ready</strong>{" "}
            benchmark of 4.0 (dashed line). Pillars inside the dashed ring are below the
            benchmark and warrant focus.
          </p>
          <RadarChart pillarScores={scoreMap} size={416} pillars={scopedPillars} language={rtl ? "ar" : "en"} />

          {/* Ranked readiness profile - the same scores as ordered bars vs the
              benchmark, so relative standing reads instantly alongside the radar. */}
          <div style={{ marginTop: "6pt" }}>
            <h3 className="report-h3">{rtl ? "الملف المرتب حسب الجاهزية" : "Ranked readiness profile"}</h3>
            <PillarProfileChart
              lang={rtl ? "ar" : "en"}
              items={scopedPillars.map((pl) => ({
                label: rtl ? pl.name_ar : pl.name_en,
                score: pillarMap.get(pl.id)?.raw_score != null ? Number(pillarMap.get(pl.id)!.raw_score) : null,
              }))}
            />
          </div>
        </section>

        {/* ─── PAGES 6-21 - Pillar Deep Dives (2 pages each) ─── *
         * Only emit deep-dives for pillars that are in scope for the
         * assessment's engagement stage. Stage 1 produces 4 pillar
         * pairs; Stage 2 produces 6; Stage 3 produces all 8. */}
        {(() => {
          // Use the per-assessment pillar override (00029) when set,
          // falling back to the stage default. Renders the deep-dive
          // pages only for pillars actually in scope for THIS run.
          const pillarsInScope = getPillarsForAssessment({
            engagement_stage: assessment.engagement_stage,
            pillars_in_scope: assessment.pillars_in_scope ?? null,
          });
          return ARA_PILLARS
            .filter((pillar) => pillarsInScope.includes(pillar.id))
            .map((pillar) => {
            const row = pillarMap.get(pillar.id);
            const pillarNotes = notesByPillar.get(pillar.id) ?? [];

            return (
              <PillarPages
                key={pillar.id}
                pillarId={pillar.id}
                name={rtl ? pillar.name_ar : pillar.name_en}
                nameAr={rtl ? pillar.name_en : pillar.name_ar}
                row={row}
                notes={pillarNotes}
                lang={rtl ? "ar" : "en"}
                hasPhase2={hasPhase2}
                respondentMeans={pillarRespondentMeans.get(pillar.id) ?? []}
                workforceNote={
                  (pillar.id === "talent" || pillar.id === "culture") &&
                  assessment.include_individual_layer &&
                  workforceRollup &&
                  workforceRollup.respondents.some((r) => r.overall != null)
                    ? rtl
                      ? "دليل على مستوى الأفراد: قاس هذا التقييم أيضاً الجاهزية الفردية للذكاء الاصطناعي لدى المجموعة - راجع قسم جاهزية القوى العاملة للاطلاع على نتائج العوامل الأربعة الداعمة لهذه الركيزة."
                      : "Person-level evidence: this engagement also measured individual AI readiness across the cohort - see the Workforce AI Readiness section for the four-factor results behind this pillar."
                    : null
                }
              />
            );
          });
        })()}

        {/* ─── PAGE 22 - Strengths & Gaps ─── */}
        <section className="report-page">
          <h2 className="report-h2">{t("strengths_gaps")}</h2>
          <h3 className="report-h3">Traffic-light grid</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8pt" }}>
            {scopedPillars.map((p) => {
              const row = pillarMap.get(p.id);
              const s = row?.raw_score != null ? Number(row.raw_score) : null;
              const bg =
                s == null ? "#f3f4f6"
                : s >= 4.0 ? "#34D399"
                : s >= 3.0 ? "#FBBF24"
                : "#FB7185";
              const fg = s == null ? "#6b7280" : "white";
              return (
                <div
                  key={p.id}
                  style={{ background: bg, color: fg, padding: "10pt", borderRadius: "6pt", fontSize: "9pt" }}
                >
                  <p style={{ fontWeight: 600, margin: 0 }}>{p.name_en}</p>
                  <p style={{ fontSize: "16pt", fontWeight: 600, margin: "4pt 0 0" }}>
                    {s != null ? s.toFixed(2) : "-"}
                  </p>
                  <p style={{ fontSize: "8pt", opacity: 0.9, margin: 0 }}>
                    {row?.maturity_label_en ?? "-"}
                  </p>
                </div>
              );
            })}
          </div>

          <h3 className="report-h3">Benchmark comparison</h3>
          <p className="report-body report-muted" style={{ fontSize: "9pt" }}>
            {peerBenchmarks.has_enough_data
              ? `Peer column shows the median score across ${peerBenchmarks.sample_size} anonymised ${sectorLabel.toLowerCase()} organisations in ${region}.`
              : `Peer medians are not yet available: they unlock once ≥ ${peerBenchmarks.min_sample_required} comparable ${sectorLabel.toLowerCase()} engagements in ${region} have completed (current sample: ${peerBenchmarks.sample_size}). The AI Ready column (4.00) remains the reference target.`}
          </p>
          <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={cellHead}>Pillar</th>
                <th style={cellHeadRight}>Current</th>
                <th style={cellHeadRight}>AI Ready</th>
                <th style={cellHeadRight}>
                  {peerBenchmarks.has_enough_data ? "Peer median" : "Peer median (pending)"}
                </th>
                <th style={cellHeadRight}>% of target</th>
              </tr>
            </thead>
            <tbody>
              {scopedPillars.map((p) => {
                const row = pillarMap.get(p.id);
                const s = row?.raw_score != null ? Number(row.raw_score) : null;
                const gap = s != null ? Number((4.0 - s).toFixed(2)) : null;
                const peerCell = peerBenchmarks.pillars.find((pb) => pb.pillar_id === p.id);
                // No invented reference values: until enough comparable
                // engagements exist, the peer cell is explicitly empty rather
                // than showing a made-up "best practice" figure.
                const peerValue = peerBenchmarks.has_enough_data && peerCell?.median != null
                  ? peerCell.median.toFixed(2)
                  : "-";
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={cell}>{p.name_en}</td>
                    <td style={cellRight}>{s != null ? s.toFixed(2) : "-"}</td>
                    <td style={cellRight} className="report-muted">4.00</td>
                    <td style={cellRight} className="report-muted">{peerValue}</td>
                    <td style={{ ...cellRight, color: s != null && s >= 4 ? "#34D399" : "#FB7185" }}>
                      {s != null ? `${Math.round((s / 4.0) * 100)}%` : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* ─── Year-on-Year comparison ─── *
         * Renders three states:
         *   1. No prior assessment      → baseline established message
         *   2. Prior with different major version → baseline-reset message
         *   3. Compatible prior         → overall delta + per-pillar table
         * Always rendered so subsequent assessments retain a stable ToC. */}
        <section className="report-page">
          <h2 className="report-h2">{t("year_on_year")}</h2>
          <p className="report-body">{t("yoy_intro")}</p>

          {!yoyComparison && (
            <EmptyCallout>{t("yoy_no_prior")}</EmptyCallout>
          )}

          {yoyComparison && !yoyComparison.compatible && (
            <Callout tone="info" title={t("year_on_year")}>
              {t("yoy_baseline_reset")}
            </Callout>
          )}

          {yoyComparison && yoyComparison.compatible && (
            <>
              {(() => {
                const overallDelta =
                  yoyComparison.current_overall != null && yoyComparison.prior_overall != null
                    ? Number((yoyComparison.current_overall - yoyComparison.prior_overall).toFixed(2))
                    : null;
                const overallTone: "positive" | "negative" | "neutral" =
                  overallDelta == null ? "neutral" : overallDelta > 0 ? "positive" : overallDelta < 0 ? "negative" : "neutral";
                return (
                  <div className="stat-strip" style={{ marginTop: "12pt" }}>
                    <StatTile
                      label={t("yoy_prior_year")}
                      value={yoyComparison.prior_overall != null ? yoyComparison.prior_overall.toFixed(2) : "-"}
                      suffix={`/ 5.00 · ${yoyComparison.prior_year ?? ""}`}
                      accent="Prior baseline"
                      accentColor="#6b7280"
                    />
                    <StatTile
                      label={t("yoy_current_year")}
                      value={yoyComparison.current_overall != null ? yoyComparison.current_overall.toFixed(2) : "-"}
                      suffix={`/ 5.00 · ${assessment.assessment_year}`}
                      accent="This assessment"
                      accentColor="#5391D5"
                    />
                    <StatTile
                      label={t("yoy_overall_delta")}
                      value={overallDelta != null ? (overallDelta > 0 ? `+${overallDelta.toFixed(2)}` : overallDelta.toFixed(2)) : "-"}
                      suffix="overall"
                      accent={overallTone === "positive" ? "Improving" : overallTone === "negative" ? "Regressing" : "No change"}
                      accentColor={overallTone === "positive" ? "#34D399" : overallTone === "negative" ? "#FB7185" : "#6b7280"}
                    />
                  </div>
                );
              })()}

              <h3 className="report-h3" style={{ marginTop: "18pt" }}>{t("yoy_pillar_table_intro")}</h3>
              <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f3f4f6" }}>
                    <th style={cellHead}>{t("pillar")}</th>
                    <th style={cellHeadRight}>{t("yoy_prior_year")}</th>
                    <th style={cellHeadRight}>{t("yoy_current_year")}</th>
                    <th style={cellHeadRight}>{t("yoy_delta")}</th>
                  </tr>
                </thead>
                <tbody>
                  {yoyComparison.pillars.map((p) => {
                    const deltaColor =
                      p.delta == null ? "#6b7280" :
                      p.delta > 0 ? "#34D399" :
                      p.delta < 0 ? "#FB7185" :
                      "#6b7280";
                    const deltaLabel =
                      p.delta == null ? "-" :
                      p.delta > 0 ? `+${p.delta.toFixed(2)}` :
                      p.delta.toFixed(2);
                    const pillarName = ARA_PILLARS.find((x) => x.id === p.pillar_id)?.name_en ?? p.pillar_id;
                    return (
                      <tr key={p.pillar_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={cell}>{pillarName}</td>
                        <td style={cellRight} className="report-muted">
                          {p.prior_raw != null ? p.prior_raw.toFixed(2) : "-"}
                        </td>
                        <td style={cellRight}>
                          {p.current_raw != null ? p.current_raw.toFixed(2) : "-"}
                        </td>
                        <td style={{ ...cellRight, color: deltaColor, fontWeight: 500 }}>
                          {deltaLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </section>

        {/* ─── Gap analysis heatmap ─── */}
        <section className="report-page">
          <h2 className="report-h2">{t("gap_heatmap")}</h2>
          <p className="report-body">
            Where the cohort sits on each pillar: every respondent is placed in the
            maturity level their pillar average falls into, so the shaded cells show
            how the {heatmapCohortSize} respondents distribute - concentration to the
            left means a shared gap, a wide spread means uneven experience.
          </p>
          <div style={{ marginTop: "16pt" }}>
            <GapHeatmap countsByPillarByLevel={heatmapData} cohortSize={heatmapCohortSize} pillars={scopedPillars} lang={rtl ? "ar" : "en"} />
          </div>
          <p className="report-body report-muted" style={{ fontSize: "8.5pt", marginTop: "10pt" }}>
            Scores run <strong>1.00 to 5.00</strong>. <strong>4.00 is the AI Ready target, not the
            maximum</strong> - L4 Advancing (4.00-4.44) and L5 Leading (4.50-5.00) sit above it.
          </p>
        </section>

        {/* ─── Investment priority matrix ─── *
         * Strategic-output sections (Investment Matrix + Roadmap) are
         * Stage 2+ deliverables. Stage 1 Department reports are designed
         * to be sales-leading samples and stop after the gap heatmap. */}
        {assessment.engagement_stage !== "department" && (
          <section className="report-page">
            <h2 className="report-h2">{t("investment_matrix")}</h2>
            <p className="report-body">
              Each pillar plotted by estimated effort required to close the gap
              (x-axis) versus business value as indicated by pillar weight
              (y-axis). Focus on the top-left <strong>Quick Wins</strong> quadrant
              first.
            </p>
            <div style={{ marginTop: "16pt" }}>
              <InvestmentMatrix pillarData={investmentData} />
            </div>
          </section>
        )}

        {/* ─── PAGE 23-24 - Roadmap (Stage 2+ only) ─── */}
        {assessment.engagement_stage !== "department" && (
          <section className="report-page">
            <h2 className="report-h2">{t("roadmap")}</h2>
            <p className="report-body">
              A phased 12-month roadmap translates findings into action across
              three horizons: immediate stabilisation (Quick Wins, months 0-3),
              institutionalisation (Build, months 3-9), and scaled transformation
              (Transform, months 9-12).
            </p>
            <div style={{ marginTop: "16pt" }}>
              <GanttRoadmap initiatives={roadmapInitiatives} />
            </div>
          </section>
        )}

        {/* ─── PAGE 25+ - Regulatory Compliance ─── *
         * Paginated into clean full pages (client feedback 2026-08-31: no
         * section may bleed a tail onto the next page). First page holds the
         * intro + the first frameworks; continuations carry their own header. */}
        {(() => {
          // Chunk on TIER boundaries, never mid-tier. The old flat slice-by-count
          // split Tier 2 across two pages, and because ComplianceSummary counts
          // the frameworks IT is handed, both pages announced "TIER 2 · 1
          // FRAMEWORK" for a tier that holds two. Keeping a tier whole makes the
          // count true and the grouping readable. tierTotals is passed as a
          // belt-and-braces truth source in case a single tier ever outgrows a
          // page and has to be split anyway.
          // Caps are measured, not guessed: at 5 on the first page the section
          // ran 310mm on a 297mm sheet once the intro gained its basis note,
          // and the applicable-framework count turned out to reach 8 in Tier 1
          // alone rather than the 4 the original split assumed.
          const FIRST = 4, PER_PAGE = 6;
          const capFor = (chunkIndex: number) => (chunkIndex === 0 ? FIRST : PER_PAGE);
          const tierTotals: Record<number, number> = {};
          for (const f of complianceSummaries) tierTotals[f.tier] = (tierTotals[f.tier] ?? 0) + 1;
          const byTier = [1, 2, 3]
            .map((tier) => complianceSummaries.filter((f) => f.tier === tier))
            .filter((g) => g.length > 0);
          const chunks: (typeof complianceSummaries)[] = [];
          for (const group of byTier) {
            let rest = group;
            // Top up the current page if this tier fits in what is left of it.
            const last = chunks[chunks.length - 1];
            if (last && last.length + rest.length <= capFor(chunks.length - 1)) {
              last.push(...rest);
              continue;
            }
            // Otherwise start a fresh page, splitting the tier only if it is
            // too big for a page of its own. tierTotals keeps the header count
            // truthful across any such split.
            while (rest.length > 0) {
              const cap = capFor(chunks.length);
              chunks.push(rest.slice(0, cap));
              rest = rest.slice(cap);
            }
          }
          return chunks.map((chunk, ci) => (
            <section key={ci} className="report-page">
              <h2 className="report-h2">
                {t("compliance_summary")}{ci > 0 ? (rtl ? " (تتمة)" : " (continued)") : ""}
              </h2>
              {ci === 0 && (
                <>
                <p className="report-body">
                  Readiness against the regulatory frameworks applicable to {region},{" "}
                  {sectorLabel.toLowerCase()} sector. Each requirement is mapped to the
                  assessment responses that evidence it and marked met, partial, or
                  action needed; the percentage counts a met requirement in full and a
                  partial one at half weight.
                </p>
                {/* Says what this IS. Without it, a page of framework names and
                    percentages reads as a legal compliance audit, which it is
                    not - it is derived from self-reported readiness answers. */}
                <p className="report-body report-muted" style={{ fontSize: "9pt", marginTop: "-6pt" }}>
                  This is a readiness indication derived from the assessment
                  responses, not a legal or certification audit. Requirements are
                  verified against documentary evidence in the Phase 2 validation
                  workshop{hasPhase2 ? "" : (<>, an optional addition at this engagement scope (see <PageRef label="Next Steps" targetId="report-next-steps" word="page" />)</>)}.
                </p>
                </>
              )}
              <ComplianceSummary frameworks={chunk} tierTotals={tierTotals} />
              {/* The detector fires on EITHER of two very different signals, and
                  the copy must say which. Previously both produced the same
                  sentence asserting that employees are using public AI tools -
                  a claim about observed behaviour that the low-governance branch
                  (any governance item scored <= 2.0) provides no evidence for at
                  all. Naming the evidence is the difference between a finding
                  and an accusation. */}
              {ci === chunks.length - 1 && shadowAi.triggered && (
                shadowAi.matches.length > 0 ? (
                  <Callout tone="danger" title="Shadow AI: named in responses">
                    {shadowAi.matches.length} open-text{" "}
                    {shadowAi.matches.length === 1 ? "response names" : "responses name"}{" "}
                    a public AI tool by name. Where such use is not covered by an
                    approved acceptable-use policy, it carries data-protection and
                    cybersecurity exposure under the {region} frameworks above.
                    Confirm which of these tools are sanctioned, and for what data
                    {hasPhase2 ? ", in the Phase 2 validation workshop" : (<>; the optional Phase 2 validation workshop (see <PageRef label="Next Steps" targetId="report-next-steps" word="page" />) is the step designed to do this</>)}.
                  </Callout>
                ) : (
                  <Callout tone="warn" title="Unsanctioned AI use would go undetected">
                    No respondent named a public AI tool. What the responses do show
                    is weak AI governance ({shadowAi.low_governance_scores.length}{" "}
                    governance {shadowAi.low_governance_scores.length === 1 ? "answer" : "answers"}{" "}
                    at level 2 or below), which means the organization currently has
                    no reliable way to know whether staff are using public AI tools
                    with work data. This is a control gap, not a finding of misuse.
                    An acceptable-use policy with a monitoring route closes it.
                  </Callout>
                )
              )}
            </section>
          ));
        })()}

        {/* ─── PAGE 26 - Supporting Materials ─── */}
        {(materials ?? []).length > 0 && (
          <section className="report-page">
            <h2 className="report-h2">{t("supporting_materials")}</h2>
            <p className="report-body">
              Documents and links submitted by respondents as supporting evidence.
            </p>
            <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={cellHead}>Type</th>
                  <th style={cellHead}>Name</th>
                  <th style={cellHead}>Submitted by</th>
                </tr>
              </thead>
              <tbody>
                {(materials ?? []).map((m: any, i: number) => (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={cell}>{m.material_type.toUpperCase()}</td>
                    <td style={cell}>{m.material_name}</td>
                    <td style={cell}>{m.respondent?.name ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ─── AI Use Case Portfolio ─── */}
        {(useCaseRows ?? []).length > 0 && (
          <section className="report-page">
            <h2 className="report-h2">AI Use Case Portfolio</h2>
            <p className="report-body">
              Inventory of AI initiatives across the organization, scored by
              stage, risk, and business value. Use this to sequence investment
              and prioritise governance effort.
            </p>
            <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={cellHead}>Use case</th>
                  <th style={cellHead}>Stage</th>
                  <th style={cellHead}>Risk</th>
                  <th style={cellHead}>Value</th>
                  <th style={cellHead}>Pillar</th>
                  <th style={cellHead}>Owner</th>
                </tr>
              </thead>
              <tbody>
                {(useCaseRows ?? []).map((u: any) => {
                  const stageColor: Record<string, string> = {
                    ideation: "#9ca3af",
                    piloting: "#FDBA74",
                    production: "#34D399",
                    retired: "#6b7280",
                  };
                  const riskColor: Record<string, string> = {
                    low: "#34D399",
                    medium: "#FBBF24",
                    high: "#FDBA74",
                    critical: "#FB7185",
                  };
                  return (
                    <tr key={u.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={cell}><strong>{u.name}</strong></td>
                      <td style={cell}>
                        <span style={{
                          background: stageColor[u.stage], color: "white",
                          padding: "2pt 5pt", borderRadius: "3pt", fontSize: "8pt",
                          textTransform: "uppercase", fontWeight: 500,
                        }}>
                          {u.stage}
                        </span>
                      </td>
                      <td style={{ ...cell, color: riskColor[u.risk_level], fontWeight: 500, textTransform: "capitalize" }}>
                        {u.risk_level}
                      </td>
                      <td style={{ ...cell, textTransform: "capitalize" }}>{u.value_level}</td>
                      <td style={cell} className="report-muted">
                        {u.pillar_id
                          ? ARA_PILLARS.find((p) => p.id === u.pillar_id)?.name_en ?? u.pillar_id
                          : "-"}
                      </td>
                      <td style={cell} className="report-muted">{u.business_owner ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Summary stats */}
            <div style={{ marginTop: "16pt", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8pt" }}>
              {(["ideation", "piloting", "production", "retired"] as const).map((stg) => {
                const count = (useCaseRows ?? []).filter((u: any) => u.stage === stg).length;
                return (
                  <div key={stg} style={{ padding: "8pt", background: "#f9fafb", borderRadius: "4pt", textAlign: "center" }}>
                    <p style={{ fontSize: "20pt", fontWeight: 600, color: "#010131", margin: 0 }}>{count}</p>
                    <p style={{ fontSize: "9pt", color: "#6b7280", margin: 0, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {stg}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── Workforce AI Readiness - Mode C only ─── *
         * Renders only when this assessment opted into the individual
         * readiness layer AND respondents have answered four-factor
         * items. Cohort-level rollup with overall + per-factor mean
         * + the four VIFM individual factors. Per-respondent breakdown
         * stays in the consultant view (not in the client-facing PDF
         * for confidentiality + page-count reasons). */}
        {assessment.include_individual_layer && workforceRollup && workforceRollup.respondents.some((r) => r.overall != null) && (
          <section className="report-page">
            <h2 className="report-h2">Workforce AI Readiness</h2>
            <p className="report-body">
              In addition to the pillar maturity scores, this assessment
              measured the personal AI readiness of {workforceRollup.cohort_size}{" "}
              respondent{workforceRollup.cohort_size === 1 ? "" : "s"}{" "}
              ({workforceRollup.completed_count} completed) across four VIFM
              individual readiness factors. The factors map to VIFM&apos;s
              behavioural framework - THINKING, RESULTS, PEOPLE, SELF.
              {assessment.assessment_tier === "deep_dive"
                ? " The deep-dive tier (12 items per factor) was used - research-grade reliability."
                : " The snapshot tier (6 items per factor) was used - directional reliability."}
            </p>

            <h3 className="report-h3">Cohort overall</h3>
            <table className="report-body" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12pt" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid " + TOKENS.navy }}>
                  <th style={{ ...cell, fontWeight: 700, textAlign: "left" }}>Metric</th>
                  <th style={{ ...cellRight, fontWeight: 700 }}>Score / 5</th>
                  <th style={{ ...cellRight, fontWeight: 700 }}>Respondents</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: "1px solid #e5e7eb", background: TOKENS.bgPanel }}>
                  <td style={{ ...cell, fontWeight: 700 }}>Cohort overall</td>
                  <td style={{ ...cellRight, fontWeight: 700 }}>
                    {workforceRollup.cohort_overall != null
                      ? workforceRollup.cohort_overall.toFixed(2)
                      : "-"}
                  </td>
                  <td style={cellRight}>{workforceRollup.completed_count}</td>
                </tr>
                {ARA_INDIVIDUAL_FACTORS.map((f) => {
                  const avg = workforceRollup.factor_averages.find((x) => x.factor_id === f.id);
                  return (
                    <tr key={f.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={cell}>
                        <span style={{ display: "inline-block", width: "8pt", height: "8pt", borderRadius: "4pt", background: f.color, marginRight: "6pt", verticalAlign: "middle" }} />
                        <strong>{f.name_en}</strong>{" "}
                        <span className="report-muted" style={{ fontSize: "9pt" }}>
                          ({f.domain})
                        </span>
                      </td>
                      <td style={cellRight}>
                        {avg && avg.respondent_count > 0 ? avg.average.toFixed(2) : "-"}
                      </td>
                      <td style={cellRight}>{avg?.respondent_count ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h3 className="report-h3">Reading the factor scores</h3>
            <ul className="report-body">
              <li><strong>4.0 and above</strong> - strong readiness on this factor; the cohort leverages AI well in this area.</li>
              <li><strong>3.0 to 3.9</strong> - developing; a clear opportunity to lift impact through targeted training or coaching.</li>
              <li><strong>Below 3.0</strong> - significant opportunity; address this factor first for the largest readiness lift.</li>
            </ul>

            <p className="report-body report-muted" style={{ fontSize: "9pt", marginTop: "12pt" }}>
              Per-respondent factor breakdown is available to consultants in the
              VIFM portal (Phase 2 tab on the assessment detail) but is not
              included in this client-facing report by default. Discuss with
              your VIFM consultant if you want named individual results
              surfaced or anonymised.
            </p>
          </section>
        )}

        {/* ─── Agentic-AI Readiness - agentic layer only ─── *
         * Renders only when this assessment opted into the agentic layer
         * AND respondents have answered agentic-dimension items. Cohort
         * overall + per-dimension mean across the six VIFM agentic
         * dimensions. Per-respondent breakdown stays in the consultant
         * view (not in the client-facing PDF). */}
        {assessment.include_agentic_layer && agenticRollup && agenticRollup.respondents.some((r) => r.overall != null) && (
          <section className="report-page">
            <h2 className="report-h2">Agentic-AI Readiness</h2>
            <p className="report-body">
              Beyond readiness to <em>use</em> AI, this assessment measured the
              organisation&apos;s readiness to safely <em>delegate</em> work to
              autonomous AI agents. {agenticRollup.completed_count} respondent
              {agenticRollup.completed_count === 1 ? "" : "s"} answered the
              Agentic-AI Readiness layer across six governance dimensions that
              extend the Governance and Model Management pillars to the frontier
              of autonomous AI.
            </p>

            <h3 className="report-h3">Cohort overall</h3>
            <table className="report-body" style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12pt" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid " + TOKENS.navy }}>
                  <th style={{ ...cell, fontWeight: 700, textAlign: "left" }}>Dimension</th>
                  <th style={{ ...cellRight, fontWeight: 700 }}>Score / 5</th>
                  <th style={{ ...cellRight, fontWeight: 700 }}>Respondents</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: "1px solid #e5e7eb", background: TOKENS.bgPanel }}>
                  <td style={{ ...cell, fontWeight: 700 }}>Cohort overall</td>
                  <td style={{ ...cellRight, fontWeight: 700 }}>
                    {agenticRollup.cohort_overall != null
                      ? agenticRollup.cohort_overall.toFixed(2)
                      : "-"}
                  </td>
                  <td style={cellRight}>{agenticRollup.completed_count}</td>
                </tr>
                {ARA_AGENTIC_DIMENSIONS.map((d) => {
                  const avg = agenticRollup.dimension_averages.find((x) => x.dimension_id === d.id);
                  return (
                    <tr key={d.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={cell}>
                        <span style={{ display: "inline-block", width: "8pt", height: "8pt", borderRadius: "4pt", background: d.color, marginRight: "6pt", verticalAlign: "middle" }} />
                        <strong>{d.name_en}</strong>
                      </td>
                      <td style={cellRight}>
                        {avg && avg.respondent_count > 0 ? avg.average.toFixed(2) : "-"}
                      </td>
                      <td style={cellRight}>{avg?.respondent_count ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h3 className="report-h3">Reading the dimension scores</h3>
            <ul className="report-body">
              <li><strong>4.0 and above</strong> - mature controls; the organisation can delegate to agents in this area with confidence.</li>
              <li><strong>3.0 to 3.9</strong> - developing; tighten controls before widening autonomous deployment.</li>
              <li><strong>Below 3.0</strong> - significant gap; address before granting agents autonomy that touches this area.</li>
            </ul>

            <p className="report-body report-muted" style={{ fontSize: "9pt", marginTop: "12pt" }}>
              Per-respondent dimension breakdown is available to consultants in
              the VIFM portal but is not included in this client-facing report
              by default.
            </p>
          </section>
        )}

        {/* ─── PAGE 27 - Next Steps ─── *
         * The lead-in claims these services are "mapped to the gaps identified
         * in this assessment", but the list was hardcoded and identical for
         * every client - the same defect the per-pillar recommendations had.
         * Each service now declares which pillars it answers, the list is
         * ORDERED by this cohort's gaps, and the ones that address a pillar
         * requiring focus say which. Services matching no gap still appear (a
         * client may want them) but sort last and make no tailored claim. */}
        <section className="report-page" id="report-next-steps">
          <h2 className="report-h2">{t("next_steps")}</h2>
          <p className="report-body">
            Virginia Institute of Finance and Management (VIFM) offers the
            following services. They are ordered by the gaps this assessment
            found, strongest match first:
          </p>
          {(() => {
            const gapByPillar = new Map(gaps.map((g) => [g.pillar, g.score]));
            const services: Array<{
              name: string; blurb: string; pillars: string[];
            }> = [
              { name: "AI Strategy Workshop", blurb: `co-design a 12-month AI roadmap aligned to your business goals.`, pillars: ["Strategy & Vision"] },
              { name: "Data Foundations Programme", blurb: `data quality, governance, and sovereignty.`, pillars: ["Data Foundations"] },
              { name: "AI Governance Playbook", blurb: `policy templates, acceptable-use frameworks, and DPIAs tailored to ${region}.`, pillars: ["Governance, Ethics & Compliance", "Model Management & Monitoring"] },
              { name: "AI Talent Development", blurb: `role-based learning paths for leaders, specialists, and all staff.`, pillars: ["Talent & Skills", "Culture & Change Readiness"] },
              { name: "Annual Reassessment", blurb: `track progress year-on-year against the same benchmark.`, pillars: [] },
            ];
            const matched = services.map((s) => {
              const hits = s.pillars.filter((p) => gapByPillar.has(p));
              const worst = hits.length
                ? Math.min(...hits.map((p) => gapByPillar.get(p)!))
                : Number.POSITIVE_INFINITY;
              return { ...s, hits, worst };
            });
            matched.sort((a, b) => a.worst - b.worst);
            return (
              <ul className="report-body">
                {matched.map((s) => (
                  <li key={s.name}>
                    <strong>{s.name}</strong> - {s.blurb}
                    {s.hits.length > 0 && (
                      <span className="report-muted">
                        {" "}Addresses {s.hits.join(" and ")}, currently{" "}
                        {s.hits
                          .map((p) => `${gapByPillar.get(p)!.toFixed(2)} (${pctOfTarget(gapByPillar.get(p)!)}% of target)`)
                          .join(" and ")}
                        .
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            );
          })()}
          {/* Phase 2 explainer. Everything above this page can only report what
              respondents said about themselves, and several places in the report
              point at Phase 2 as the step that tests those answers - so the
              client needs to know what it is. It is a Division/Enterprise
              deliverable, so a Department reader is told plainly that it is an
              OPTIONAL addition rather than something already coming to them. */}
          <div
            style={{
              marginTop: "18pt",
              padding: "14pt 16pt",
              background: "var(--ara-bg-soft)",
              border: "1pt solid var(--ara-line)",
              borderLeft: "3pt solid var(--ara-accent)",
              borderRadius: "6pt",
            }}
          >
            <h3 className="report-h3" style={{ marginTop: 0 }}>
              Phase 2: consultant validation workshop{" "}
              <span style={{ fontWeight: 500, color: "var(--ara-mute)", fontSize: "10pt" }}>
                {hasPhase2 ? "(included in this engagement)" : "(optional addition)"}
              </span>
            </h3>
            <p className="report-body" style={{ marginBottom: "8pt" }}>
              Every score in this report comes from what your people said about
              their own organization. Phase 2 is the facilitated session that
              tests those answers against evidence, and it is what turns a
              self-assessment into a validated baseline. In a half-day to a full
              day with your consultant it covers:
            </p>
            <ul className="report-body" style={{ marginBottom: "8pt" }}>
              <li>
                <strong>Evidence review, pillar by pillar</strong> - a separate set of
                consultant probing questions, never shown to respondents, used to ask
                what exists in writing behind each score: the policy, the register,
                the pipeline, the approval record.
              </li>
              <li>
                <strong>Perception versus reality</strong> - where the evidence does not
                support the self-reported score, the gap itself becomes a finding.
                It is usually the most useful output of the day.
              </li>
              <li>
                <strong>A validated maturity band per pillar</strong> - your consultant
                records a confirmed score alongside the self-assessed one, so both are
                visible and the change is auditable.
              </li>
              <li>
                <strong>Written findings and a capability-building plan</strong> -
                bilingual notes from the session and a training plan ranked by the
                gaps confirmed on the day, issued as an updated report.
              </li>
            </ul>
            <p className="report-body report-muted" style={{ fontSize: "9pt", margin: 0 }}>
              {hasPhase2
                ? "Your consultant will schedule this session as part of the current engagement."
                : "Not included at the current engagement scope. Ask your VIFM consultant to quote it as an addition to this assessment."}
            </p>
          </div>

          <p className="report-body" style={{ marginTop: "16pt" }}>
            To discuss engagement, contact your VIFM consultant or
            email <strong>contact@viftraining.com</strong>.
          </p>
        </section>

        {/* ─── Organization Profile (moved to the end of the report per client review) ─── */}
        <section className="report-page">
          <h2 className="report-h2">{t("org_profile")}</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20pt", marginBottom: "16pt" }}>
            <div>
              <h3 className="report-h3">Client details</h3>
              <table className="report-body" style={{ width: "100%" }}>
                <tbody>
                  <tr><td style={cellLabel}>Organization</td><td style={cell}>{assessment.organization?.name ?? "-"}</td></tr>
                  <tr><td style={cellLabel}>Region</td><td style={cell}>{region}</td></tr>
                  <tr><td style={cellLabel}>Sector</td><td style={cell}>{sectorLabel}</td></tr>
                  <tr><td style={cellLabel}>Assessment year</td><td style={cell}>{assessment.assessment_year}</td></tr>
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="report-h3">Methodology</h3>
              <table className="report-body" style={{ width: "100%" }}>
                <tbody>
                  <tr><td style={cellLabel}>Question bank</td><td style={cell}>v{version?.version_number ?? "-"} {version?.version_label && `· ${version.version_label}`}</td></tr>
                  <tr><td style={cellLabel}>Phase</td><td style={cell}>{assessment.phase.replace("phase", "Phase ")}</td></tr>
                  {/* Raw enum values ("active") and internal ops shorthand
                      ("Not yet") were leaking into a client deliverable. Both
                      now read as a sentence a client can act on. */}
                  <tr>
                    <td style={cellLabel}>Scores</td>
                    <td style={cell}>
                      {overallScore?.score_frozen_at
                        ? `Final, locked ${new Date(overallScore.score_frozen_at).toLocaleDateString()}`
                        : "Preliminary - not yet locked"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <h3 className="report-h3">Respondents ({(respondents ?? []).length})</h3>
          <RespondentTable
            rows={(respondents ?? []).slice(0, ROSTER_FIRST_PAGE)}
            showRole={rosterShowRole}
            showPillars={rosterShowPillars}
          />
        </section>

        {/* Roster continuation pages - clean full pages, no bleed (client
            feedback 2026-08-31). 16 rows share page 4 with the profile; the
            remainder paginates at 30 rows per page. */}
        {(() => {
          const all = respondents ?? [];
          const rest = Math.max(0, all.length - ROSTER_FIRST_PAGE);
          if (rest === 0) return null;
          const pages = Math.ceil(rest / ROSTER_PER_PAGE);
          const per = Math.ceil(rest / pages); // even distribution - no orphan page
          return Array.from({ length: pages }, (_, pi) => (
            <section key={pi} className="report-page">
              <h2 className="report-h2">{t("org_profile")}{rtl ? " (تتمة)" : " (continued)"}</h2>
              <h3 className="report-h3">Respondents (continued)</h3>
              <RespondentTable
                rows={all.slice(ROSTER_FIRST_PAGE + pi * per, ROSTER_FIRST_PAGE + (pi + 1) * per)}
                showRole={rosterShowRole}
                showPillars={rosterShowPillars}
              />
            </section>
          ));
        })()}

        {/* ─── APPENDIX ─── */}
        <section className="report-page">
          <h2 className="report-h2">{t("appendix")}</h2>

          <h3 className="report-h3">{rtl ? "بطاقة معلومات التقييم" : "Assessment Fact Sheet"}</h3>
          {orgFactSheetRows(rtl ? "ar" : "en", { hasPhase2 }).map((r) => (
            <div
              key={r.label}
              dir={rtl ? "rtl" : "ltr"}
              style={{ display: "flex", gap: "8px", marginBottom: "5pt" }}
            >
              <span className="report-body" style={{ width: "110pt", flexShrink: 0, fontWeight: 700 }}>{r.label}</span>
              <span className="report-body report-muted" style={{ flex: 1 }}>{r.value}</span>
            </div>
          ))}

          <h3 className="report-h3">Scoring methodology</h3>
          <p className="report-body">
            Each pillar raw score is the average of answered questions on a 1-5 scale.
            The overall organizational score is the weighted average of the scored,
            in-scope pillars - each pillar contributes its raw score × its pillar
            weight, with weights renormalised over the pillars actually scored.
          </p>

          <h3 className="report-h3">Item development &amp; validation</h3>
          <p className="report-body">
            Items in the v1.1 production bank were developed through three rounds:
            initial drafting by VIFM consultants against the VIFM-AC behavioural
            framework and reference regulatory frameworks; AI-assisted expansion
            with every suggestion reviewed by at least one consultant before
            inclusion; and a bilingual rewrite in Gulf Arabic at source rather
            than back-translation. Every item is tagged at the database level to
            exactly one construct (a pillar, on the org-side) - the assessment
            locks to the question-bank version active at creation, so this
            report is reproducible against the same items even if the bank
            advances. The full methodology brief (item development, content
            validity, reliability planning, reference frameworks, limitations)
            is available as a downloadable PDF at{" "}
            <span style={{ fontFamily: "monospace", fontSize: "9pt" }}>
              caliber.viftraining.com/api/ara/methodology/pdf
            </span>
            .
          </p>

        </section>

        <section className="report-page">
          <h2 className="report-h2">{t("appendix")}{rtl ? " (تتمة)" : " (continued)"}</h2>
          {evidenceAnchors.length > 0 && (
            <>
              <h3 className="report-h3">Anchor instruments (item-by-item)</h3>
              <p className="report-body">
                Every question in this bank is content-aligned with at least
                one published instrument. The full list of distinct anchor
                instruments used across the version applied to this
                assessment is below. Per-item citations are maintained in the
                admin question bank and verified by VIFM staff before they
                appear here - AI-suggested-but-unverified anchors are
                deliberately excluded.
              </p>
              <ul className="report-body" style={{ paddingInlineStart: 18 }}>
                {evidenceAnchors.slice(0, 14).map((a) => (
                  <li key={a.citation} style={{ marginBottom: 6 }}>
                    <strong>{a.name}.</strong> {a.citation}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {evidenceAnchors.length > 14 &&
          Array.from({ length: Math.ceil((evidenceAnchors.length - 14) / 18) }, (_, ai) => (
            <section key={ai} className="report-page">
              <h2 className="report-h2">{t("appendix")}{rtl ? " (تتمة)" : " (continued)"}</h2>
              <h3 className="report-h3">Anchor instruments (continued)</h3>
              <ul className="report-body" style={{ paddingInlineStart: 18 }}>
                {evidenceAnchors.slice(14 + ai * 18, 14 + (ai + 1) * 18).map((a) => (
                  <li key={a.citation} style={{ marginBottom: 6 }}>
                    <strong>{a.name}.</strong> {a.citation}
                  </li>
                ))}
              </ul>
            </section>
          ))}

        <section className="report-page">
          <h2 className="report-h2">{t("appendix")}{rtl ? " (تتمة)" : " (continued)"}</h2>
          <h3 className="report-h3">Validity and reliability disclosures</h3>
          <p className="report-body report-muted" style={{ fontSize: "9pt" }}>
            Construct validity (does the four-factor / eight-pillar model carve
            nature at its joints?) requires confirmatory factor analysis with
            N ≥ 200 individual responses and N ≥ 50 organisational responses.
            We are accumulating responses passively and will publish loadings
            and fit indices once the threshold is met. Pre-CFA, the model is
            treated as a content-validated heuristic, not an empirically
            validated structure. Cronbach&apos;s alpha will be reported per
            construct on the same cadence. Inter-rater reliability is
            measurable from the Phase 2 audit trail and will be surfaced in
            the consultant analytics console at N ≥ 30 multi-rater workshops.
          </p>


          <h3 className="report-h3">Pillar weights used</h3>
          <table className="report-body" style={{ width: "60%", borderCollapse: "collapse" }}>
            <tbody>
              {scopedPillars.map((p) => {
                const weights = assessment.pillar_weights as Record<string, number>;
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={cell}>{p.name_en}</td>
                    <td style={cellRight}>{(weights?.[p.id] ?? 12.5).toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="report-body report-muted" style={{ fontSize: "8.5pt", marginTop: "4pt" }}>
            Configured pillar weights. For Department and Division engagements the
            overall score renormalizes these across the in-scope pillars only (so
            the in-scope weights total 100%); pillars outside the engagement scope
            do not contribute to the headline score.
          </p>

          {/* Gated on the SAME condition as the investment matrix it explains.
              Department reports stop before the strategic-output sections, so
              this was defining "investment signals" for a reader who never saw
              a single one. */}
          {hasPhase2 && (
            <>
              <h3 className="report-h3">Disclaimer</h3>
              <p className="report-body report-muted" style={{ fontSize: "9pt" }}>
                Investment signals indicate relative scale and category of financial
                commitment required. Actual costs vary based on organization size,
                existing infrastructure, vendor selection, and negotiated contracts.
                VIFM recommends conducting a detailed cost-benefit analysis for each
                high-investment initiative before budget allocation.
              </p>
            </>
          )}

          {/* The window is READ from ARA_RETENTION_YEARS - the same constant the
              purge job enforces. It previously said "three years" while the
              platform deleted at two, so the notice both contradicted the
              maximum-2-year commitment we sell on and promised the client
              access to data that would already be gone. */}
          <h3 className="report-h3">Data retention notice</h3>
          <p className="report-body report-muted" style={{ fontSize: "9pt" }}>
            Client assessment data is retained for a maximum of {ARA_RETENTION_YEARS}{" "}
            years from archival unless contractually extended, after which the
            assessment record and its supporting materials are purged. Generated
            reports are detached and retained as VIFM business records. To request
            erasure sooner, contact VIFM directly.
          </p>
        </section>

      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Pillar deep-dive pair (findings + recommendations)
// ─────────────────────────────────────────────────────────────
/** Respondent roster table - extracted so the roster can paginate across
 *  clean report pages (16 rows on the profile page, 30 per continuation). */
/**
 * Roster table. Columns that are empty for EVERY respondent are dropped rather
 * than printed as a column of "-": on a run where nobody carries a role label
 * or a per-pillar assignment (the common case), the old fixed four-column table
 * spent half its width on two blank columns and pushed a 40-person roster
 * across three pages.
 *
 * `showRole` / `showPillars` are decided once by the caller over the WHOLE
 * roster, so continuation pages keep the same columns as the first.
 */
function RespondentTable({
  rows,
  showRole,
  showPillars,
  split = true,
}: {
  rows: any[];
  showRole: boolean;
  showPillars: boolean;
  /** Internal: false on the recursive halves so the split happens exactly once. */
  split?: boolean;
}) {
  // With only Name + Status the table is narrow, so a single column left half
  // the page empty and pushed a 40-person roster over the page break. Split it
  // into two side-by-side tables: same rows, half the height.
  if (split && !showRole && !showPillars && rows.length > 8) {
    const half = Math.ceil(rows.length / 2);
    return (
      <div style={{ display: "flex", gap: "16pt", alignItems: "flex-start" }}>
        {[rows.slice(0, half), rows.slice(half)].map((part, i) => (
          <div key={i} style={{ flex: 1, minWidth: 0 }}>
            {part.length > 0 && (
              <RespondentTable
                rows={part}
                showRole={false}
                showPillars={false}
                split={false}
              />
            )}
          </div>
        ))}
      </div>
    );
  }
  return (
    <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "#f3f4f6" }}>
          <th style={cellHead}>Name</th>
          {showRole && <th style={cellHead}>Role</th>}
          {showPillars && <th style={cellHead}>Pillars assigned</th>}
          <th style={cellHead}>Status</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r: any, i: number) => (
          <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
            <td style={cell}><strong>{r.name}</strong></td>
            {showRole && <td style={cell}>{r.role_label_en ?? "-"}</td>}
            {showPillars && (
              <td style={cell}>
                {(r.assignments ?? []).length === 0
                  ? "-"
                  : r.assignments.map((a: any) => ARA_PILLARS.find((p) => p.id === a.pillar_id)?.name_en ?? a.pillar_id).join(", ")}
              </td>
            )}
            <td style={cell}>{r.completed_at ? "Completed" : "In progress"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PillarPages({
  pillarId,
  name,
  nameAr,
  row,
  notes,
  lang = "en",
  workforceNote = null,
  respondentMeans = [],
  hasPhase2 = true,
}: {
  pillarId: AraPillarId;
  name: string;
  nameAr: string;
  row: PillarScoreRow | undefined;
  notes: ConsultantNoteRow[];
  lang?: "en" | "ar";
  /** Whether the engagement includes the Phase 2 validation workshop. */
  hasPhase2?: boolean;
  /** Talent/Culture <-> workforce bridge note (Mode C); null hides it. */
  workforceNote?: string | null;
  /** Per-respondent pillar means - powers the spread band chart. */
  respondentMeans?: number[];
}) {
  const score = row?.raw_score != null ? Number(row.raw_score) : null;
  const gap = row?.benchmark_gap != null ? Number(row.benchmark_gap) : null;
  const validated = row?.consultant_validated_score != null ? Number(row.consultant_validated_score) : null;
  const selfScore = row?.self_assessment_score != null ? Number(row.self_assessment_score) : null;
  const perceptionGap = row?.perception_gap != null ? Number(row.perception_gap) : null;

  // Expressed as % of the 4.00 AI Ready target: a signed distance ("+1.34")
  // read as being ahead of target, which is the opposite of what it meant.
  const targetPct = score != null ? Math.round((score / 4.0) * 100) : null;
  const gapValue = targetPct != null ? `${targetPct}%` : "-";
  const gapTone: "positive" | "negative" | "neutral" =
    gap == null ? "neutral" : gap <= 0 ? "positive" : "negative";
  const perceptionTone: "neutral" | "warning" =
    perceptionGap != null && Math.abs(perceptionGap) > 0.5 ? "warning" : "neutral";
  const perceptionValue =
    perceptionGap != null ? (perceptionGap > 0 ? `+${perceptionGap.toFixed(2)}` : perceptionGap.toFixed(2)) : "-";

  // Pillar-SPECIFIC recommendations (the previous generator keyed only on the
  // score band, so every pillar in a band repeated the same three actions and
  // the same expected outcomes).
  const recs = recommendationsForPillar(pillarId, score);

  return (
    <>
      {/* Findings page */}
      <section className="report-page">
        <SectionHeader
          eyebrow="Pillar deep dive"
          title={name}
          kicker={nameAr}
        />
        {workforceNote && (
          <div style={{ border: "1pt solid #bcd7f0", background: "#eef5fc", borderRadius: "4pt", padding: "5pt 9pt", marginBottom: "8pt", fontSize: "8.5pt", color: "#1e4e79" }} dir={lang === "ar" ? "rtl" : "ltr"}>
            <p style={{ margin: 0 }}>{workforceNote}</p>
          </div>
        )}

        {/* Four-metric strip replaces the old score/gauge grid */}
        <div className="metric-strip">
          <Metric
            label="Raw score"
            value={score != null ? score.toFixed(2) : "-"}
            suffix="/ 5.00"
            tone={score == null ? "neutral" : score >= 4.0 ? "positive" : score < 3.0 ? "negative" : "warning"}
          />
          <Metric
            label="Progress to target"
            value={gapValue}
            suffix="of the 4.00 AI Ready target"
            tone={gapTone}
          />
          <Metric
            label="Perception gap"
            value={perceptionValue}
            suffix={selfScore != null && validated != null
              ? `self ${selfScore.toFixed(2)} · cons ${validated.toFixed(2)}`
              : "not validated"}
            tone={perceptionTone}
          />
          <Metric
            label="Maturity level"
            value={row?.maturity_label_en ?? "Unscored"}
            suffix={row?.maturity_level != null ? `L${row.maturity_level}` : ""}
            tone="brand"
          />
        </div>

        {/* Maturity band + respondent spread: the 1-5 scale banded into the
            maturity zones, a dot per respondent (cohort agreement is visible at
            a glance), the cohort mean marker, and the dashed benchmark. */}
        <div style={{ marginTop: "9pt" }}>
          <p style={{ fontSize: "8.5pt", letterSpacing: "0.08em",
            textTransform: "uppercase", color: TOKENS.mute, margin: "0 0 3pt",
            fontWeight: 600 }}>
            {lang === "ar" ? "توزيع المشاركين مقابل معيار الجاهزية" : "Respondent spread vs the AI Ready benchmark"}
          </p>
          <PillarBandChart values={respondentMeans} mean={score} lang={lang} />
          {respondentMeans.length > 1 && (
            <p style={{ fontSize: "8pt", color: TOKENS.mute, margin: "2pt 0 0" }}>
              {lang === "ar"
                ? `كل نقطة تمثل متوسط أحد المشاركين (${respondentMeans.length} مشاركاً) - التباعد الواسع يشير إلى تفاوت في التجربة${hasPhase2 ? " يستحق نقاش ورشة التحقق في المرحلة الثانية" : " يستحق المتابعة مع الفريق"}.`
                : `Each dot is one respondent's average on this pillar (${respondentMeans.length} respondents) - a wide spread signals uneven experience${hasPhase2 ? " worth probing in the Phase 2 validation workshop" : " worth following up with the team"}.`}
            </p>
          )}
        </div>

        {/* Key findings - each note is a typed card */}
        <h3 className="report-h3" style={{ marginTop: "8pt" }}>Key findings</h3>
        {notes.length === 0 ? (
          <EmptyCallout>
            {hasPhase2 ? (
              lang === "ar" ? (
                <>ستتم إضافة النتائج التفصيلية من قبل المستشار خلال ورشة التحقق في المرحلة الثانية (انظر <PageRef label="الخطوات التالية" targetId="report-next-steps" word="صفحة" />).</>
              ) : (
                <>Detailed findings are added by the consultant during the Phase 2 validation workshop (see <PageRef label="Next Steps" targetId="report-next-steps" word="page" />).</>
              )
            ) : lang === "ar" ? (
              <>لا توجد نتائج مسجّلة من المستشار لهذه الركيزة. تُنتج النتائج التفصيلية المدعومة بالأدلة في ورشة التحقق الاختيارية بالمرحلة الثانية (انظر <PageRef label="الخطوات التالية" targetId="report-next-steps" word="صفحة" />).</>
            ) : (
              <>No consultant findings are recorded for this pillar. Detailed findings tested against evidence are produced in the optional Phase 2 validation workshop (see <PageRef label="Next Steps" targetId="report-next-steps" word="page" />).</>
            )}
          </EmptyCallout>
        ) : (
          <div className="finding-stack">
            {notes.map((n, i) => (
              <FindingCard
                key={i}
                lang={lang}
                index={i + 1}
                type={inferFindingType(n.note_text)}
                text={lang === "ar" ? (n.note_text_ar ?? n.note_text) : n.note_text}
              />
            ))}
          </div>
        )}

        {/* Recommendations - same page (client request 2026-08-31: one page
            per pillar). Sequencing guidance moved to a single compact line. */}
        <h3 className="report-h3" style={{ marginTop: "8pt" }}>Recommendations</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8pt" }}>
          {recs.map((r, i) => (
            <div key={i} style={i === recs.length - 1 && recs.length % 2 === 1 ? { gridColumn: "1 / -1" } : undefined}>
              <RecommendationCard rec={r} index={i + 1} />
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

const cell: React.CSSProperties = { padding: "5pt 8pt", verticalAlign: "top" };
const cellRight: React.CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const cellLabel: React.CSSProperties = { ...cell, color: "#6b7280", fontWeight: 500, width: "40%" };
const cellHead: React.CSSProperties = { ...cell, fontWeight: 600, color: "#010131", fontSize: "10pt", textAlign: "left" };
const cellHeadRight: React.CSSProperties = { ...cellHead, textAlign: "right" };
