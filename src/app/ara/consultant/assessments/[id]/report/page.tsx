import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { ARA_PILLARS, ARA_MATURITY_LEVELS, ARA_OVERALL_BANDS } from "@/lib/constants/ara-pillars";
import { ARA_STAGE_MAP } from "@/lib/constants/ara-stages";
import { summarizeComplianceByFramework } from "@/lib/ara/compliance";
import { detectAraShadowAi } from "@/lib/ara/detectors";
import { computePeerBenchmarks } from "@/lib/ara/peer-benchmarks";
import { computeYoYComparison } from "@/lib/ara/year-on-year";
import { computeWorkforceReadiness } from "@/lib/ara/workforce-readiness";
import { ARA_INDIVIDUAL_FACTORS } from "@/lib/constants/ara-individual-factors";
import { MaturityGauge } from "./_components/maturity-gauge";
import { RadarChart } from "./_components/radar-chart";
import { ComplianceSummary } from "./_components/compliance-summary";
import { GapHeatmap, bucketResponses } from "./_components/gap-heatmap";
import { InvestmentMatrix } from "./_components/investment-matrix";
import { GanttRoadmap } from "./_components/gantt-roadmap";
import { tr, type ReportLang } from "./_components/report-i18n";
import { BilingualReport } from "./_components/bilingual-report";
import {
  SectionHeader, StatTile, Metric, FindingCard, inferFindingType,
  Callout, EmptyCallout, StatusChip, FindingsPanel, RecommendationCard,
  recommendationsFor, TOKENS,
} from "./_components/report-primitives";
import type {
  AraAssessment, AraOrganization, AraPillarId,
} from "@/types/ara";
import "./report.css";

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
      .select("pillar_id, raw_score, maturity_level, maturity_label_en, benchmark_gap, self_assessment_score, consultant_validated_score, perception_gap")
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
  const { data: responseRows } = await sb
    .from("ara_responses")
    .select("question_score, question:ara_questions(pillar_id, question_number)")
    .eq("assessment_id", assessment.id);

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

  // Mode C workforce readiness rollup — only when the assessment opted
  // into the individual layer. Tolerant of missing data: returns null
  // and the section render branch falls through to nothing.
  const workforceRollup = assessment.include_individual_layer
    ? await computeWorkforceReadiness(assessment.id).catch((e) => {
        console.error("[ara-report] workforce rollup failed:", e);
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

  const heatmapData = bucketResponses(
    ((responseRows ?? []) as unknown as Array<{
      question_score: number | null;
      question: { pillar_id: string; question_number: number } | null;
    }>)
      .filter((r) => r.question)
      .map((r) => ({
        pillar_id: r.question!.pillar_id,
        question_number: r.question!.question_number,
        question_score: r.question_score,
      }))
  );

  const pillarMap = new Map<AraPillarId, PillarScoreRow>();
  (pillarScores ?? []).forEach((p) => pillarMap.set(p.pillar_id as AraPillarId, p));

  const scoreMap = new Map<AraPillarId, number | null>();
  ARA_PILLARS.forEach((p) => {
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

  const strengths: Array<{ pillar: string; score: number }> = [];
  const gaps: Array<{ pillar: string; score: number; gap: number }> = [];
  ARA_PILLARS.forEach((p) => {
    const row = pillarMap.get(p.id);
    if (row?.raw_score == null) return;
    const s = Number(row.raw_score);
    if (s >= 4.0) strengths.push({ pillar: p.name_en, score: s });
    else if (s < 3.0) gaps.push({ pillar: p.name_en, score: s, gap: Number(row.benchmark_gap ?? 0) });
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
  const investmentData = ARA_PILLARS.map((p) => ({
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

  // Bilingual side-by-side landscape is its own layout - render it here
  // instead of the portrait EN/AR flow below.
  if (langParam === "bilingual") {
    return (
      <>
        {!bare && (
          <div className="no-print bg-gray-100 py-6 px-4 text-center">
            <p className="text-sm text-muted-foreground">
              Bilingual preview (landscape, English left · Arabic right).
              Use <strong>Download PDF</strong> on the assessment page to export.
            </p>
          </div>
        )}
        <div className={bare ? "" : "bg-gray-100 py-8"}>
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

      <div className={bare ? "" : "bg-gray-100 py-8"} dir={outerDir}>
        {/* ─── PAGE 1 - Cover ─── */}
        <section
          className="report-page flex flex-col justify-between"
          style={{ background: "#010131", color: "white" }}
        >
          <div>
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
              AI Readiness Compass Report
            </p>
            <p dir="rtl" className="text-lg" style={{ color: "white", opacity: 0.85, marginTop: 8 }}>
              تقرير بوصلة الاستعداد للذكاء الاصطناعي
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
            kicker={`Weighted aggregate of eight AI Readiness pillars, calibrated against ${region} frameworks`}
          />

          {/* KPI strip - four tiles */}
          <div className="stat-strip">
            <StatTile
              label="Overall readiness"
              value={overall != null ? overall.toFixed(2) : "—"}
              suffix="/ 5.00"
              accent={overallLabel ?? ""}
              accentColor="#5391D5"
            />
            <StatTile
              label="Maturity band"
              value={overallLabel ?? "—"}
              accent="Weighted aggregate, 8 pillars"
              accentColor="#6b7280"
            />
            <StatTile
              label="At / above benchmark"
              value={String(strengths.length)}
              suffix="/ 8"
              accent="Pillars scoring ≥ 4.00"
              accentColor="#34D399"
            />
            <StatTile
              label="Below benchmark"
              value={String(gaps.length)}
              suffix="/ 8"
              accent="Pillars requiring focus"
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
                <strong>{overall != null ? overall.toFixed(2) : "—"} / 5.00</strong>
                {overallLabel && <> ({overallLabel})</>}. The profile shows{" "}
                <strong>{strengths.length}</strong> {strengths.length === 1 ? "pillar" : "pillars"} at
                or above the AI Ready benchmark and <strong>{gaps.length}</strong>{" "}
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

          {/* Findings panels */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: "12pt", marginTop: "18pt" }}>
            <FindingsPanel
              variant="strength"
              title="Headline strengths"
              items={strengths.slice(0, 3).map(s => ({
                headline: s.pillar,
                metric: `${s.score.toFixed(2)} / 5.0`,
              }))}
            />
            <FindingsPanel
              variant="gap"
              title="Critical gaps"
              items={gaps.slice(0, 3).map(g => ({
                headline: g.pillar,
                metric: `${g.score.toFixed(2)} · ${g.gap > 0 ? "+" : ""}${g.gap.toFixed(2)} vs benchmark`,
              }))}
            />
          </div>
        </section>

        {/* ─── PAGE 3 - How to Read This Report ─── */}
        <section className="report-page">
          <h2 className="report-h2">{t("how_to_read")}</h2>
          <p className="report-body">
            This report summarises findings across eight pillars of AI Readiness.
            Each pillar is scored 1–5 against a behavioural rubric, and the
            overall score is a weighted aggregate.
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
                  <td style={cell}>{m.min.toFixed(1)}–{m.max.toFixed(1)}</td>
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
                  {b.min.toFixed(1)}–{b.max.toFixed(1)}
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

        {/* ─── PAGE 4 - Organization Profile ─── */}
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
                  <tr><td style={cellLabel}>Status</td><td style={cell}>{assessment.status}</td></tr>
                  <tr><td style={cellLabel}>Scores frozen</td><td style={cell}>{overallScore?.score_frozen_at ? new Date(overallScore.score_frozen_at).toLocaleDateString() : "Not yet"}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <h3 className="report-h3">Respondents ({(respondents ?? []).length})</h3>
          <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={cellHead}>Name</th>
                <th style={cellHead}>Role</th>
                <th style={cellHead}>Pillars assigned</th>
                <th style={cellHead}>Status</th>
              </tr>
            </thead>
            <tbody>
              {(respondents ?? []).map((r: any, i: number) => (
                <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={cell}><strong>{r.name}</strong></td>
                  <td style={cell}>{r.role_label_en ?? "-"}</td>
                  <td style={cell}>
                    {(r.assignments ?? []).length === 0
                      ? "-"
                      : r.assignments.map((a: any) => ARA_PILLARS.find((p) => p.id === a.pillar_id)?.name_en ?? a.pillar_id).join(", ")}
                  </td>
                  <td style={cell}>{r.completed_at ? "Completed" : "In progress"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ─── PAGE 5 - Radar Overview ─── */}
        <section className="report-page">
          <h2 className="report-h2">{t("pillar_overview")}</h2>
          <p className="report-body">
            The radar below plots current pillar scores against the <strong>AI Ready</strong>{" "}
            benchmark of 4.0 (dashed line). Pillars inside the dashed ring are below the
            benchmark and warrant focus.
          </p>
          <RadarChart pillarScores={scoreMap} size={440} />
        </section>

        {/* ─── PAGES 6–21 - Pillar Deep Dives (2 pages each) ─── *
         * Only emit deep-dives for pillars that are in scope for the
         * assessment's engagement stage. Stage 1 produces 4 pillar
         * pairs; Stage 2 produces 6; Stage 3 produces all 8. */}
        {ARA_PILLARS
          .filter((pillar) => stageDef.applicable_pillars.includes(pillar.id))
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
              />
            );
          })}

        {/* ─── PAGE 22 - Strengths & Gaps ─── */}
        <section className="report-page">
          <h2 className="report-h2">{t("strengths_gaps")}</h2>
          <h3 className="report-h3">Traffic-light grid</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8pt" }}>
            {ARA_PILLARS.map((p) => {
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
              : `Peer column shows indicative GCC best practice. Real peer medians unlock once ≥ ${peerBenchmarks.min_sample_required} comparable engagements have completed (current sample: ${peerBenchmarks.sample_size}).`}
          </p>
          <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={cellHead}>Pillar</th>
                <th style={cellHeadRight}>Current</th>
                <th style={cellHeadRight}>AI Ready</th>
                <th style={cellHeadRight}>
                  {peerBenchmarks.has_enough_data ? "Peer median" : "GCC Best"}
                </th>
                <th style={cellHeadRight}>Gap</th>
              </tr>
            </thead>
            <tbody>
              {ARA_PILLARS.map((p) => {
                const row = pillarMap.get(p.id);
                const s = row?.raw_score != null ? Number(row.raw_score) : null;
                const gap = s != null ? Number((4.0 - s).toFixed(2)) : null;
                const peerCell = peerBenchmarks.pillars.find((pb) => pb.pillar_id === p.id);
                const peerValue = peerBenchmarks.has_enough_data && peerCell?.median != null
                  ? peerCell.median.toFixed(2)
                  : "4.50";
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={cell}>{p.name_en}</td>
                    <td style={cellRight}>{s != null ? s.toFixed(2) : "-"}</td>
                    <td style={cellRight} className="report-muted">4.00</td>
                    <td style={cellRight} className="report-muted">{peerValue}</td>
                    <td style={{ ...cellRight, color: gap != null && gap > 0 ? "#FB7185" : "#34D399" }}>
                      {gap != null ? (gap > 0 ? `+${gap.toFixed(2)}` : gap.toFixed(2)) : "-"}
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
                      value={yoyComparison.prior_overall != null ? yoyComparison.prior_overall.toFixed(2) : "—"}
                      suffix={`/ 5.00 · ${yoyComparison.prior_year ?? ""}`}
                      accent="Prior baseline"
                      accentColor="#6b7280"
                    />
                    <StatTile
                      label={t("yoy_current_year")}
                      value={yoyComparison.current_overall != null ? yoyComparison.current_overall.toFixed(2) : "—"}
                      suffix={`/ 5.00 · ${assessment.assessment_year}`}
                      accent="This assessment"
                      accentColor="#5391D5"
                    />
                    <StatTile
                      label={t("yoy_overall_delta")}
                      value={overallDelta != null ? (overallDelta > 0 ? `+${overallDelta.toFixed(2)}` : overallDelta.toFixed(2)) : "—"}
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
                      p.delta == null ? "—" :
                      p.delta > 0 ? `+${p.delta.toFixed(2)}` :
                      p.delta.toFixed(2);
                    const pillarName = ARA_PILLARS.find((x) => x.id === p.pillar_id)?.name_en ?? p.pillar_id;
                    return (
                      <tr key={p.pillar_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                        <td style={cell}>{pillarName}</td>
                        <td style={cellRight} className="report-muted">
                          {p.prior_raw != null ? p.prior_raw.toFixed(2) : "—"}
                        </td>
                        <td style={cellRight}>
                          {p.current_raw != null ? p.current_raw.toFixed(2) : "—"}
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
            Heatmap of average question scores across pillars and question
            groups. Red cells indicate critical gaps; green cells indicate
            maturity at or above the AI Ready benchmark.
          </p>
          <div style={{ marginTop: "16pt" }}>
            <GapHeatmap scoresByPillarByBucket={heatmapData} />
          </div>
          <div style={{ display: "flex", gap: "16pt", marginTop: "12pt", fontSize: "9pt" }}>
            <span><span style={{ display: "inline-block", width: "10pt", height: "10pt", background: "#FB7185", borderRadius: "2pt", marginRight: "4pt", verticalAlign: "middle" }} />Critical (1–2)</span>
            <span><span style={{ display: "inline-block", width: "10pt", height: "10pt", background: "#FDBA74", borderRadius: "2pt", marginRight: "4pt", verticalAlign: "middle" }} />Early stage (2–3)</span>
            <span><span style={{ display: "inline-block", width: "10pt", height: "10pt", background: "#FBBF24", borderRadius: "2pt", marginRight: "4pt", verticalAlign: "middle" }} />Developing (3–4)</span>
            <span><span style={{ display: "inline-block", width: "10pt", height: "10pt", background: "#34D399", borderRadius: "2pt", marginRight: "4pt", verticalAlign: "middle" }} />At or above benchmark (4+)</span>
          </div>
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

        {/* ─── PAGE 23–24 - Roadmap (Stage 2+ only) ─── */}
        {assessment.engagement_stage !== "department" && (
          <section className="report-page">
            <h2 className="report-h2">{t("roadmap")}</h2>
            <p className="report-body">
              A phased 12-month roadmap translates findings into action across
              three horizons: immediate stabilisation (Quick Wins, months 0–3),
              institutionalisation (Build, months 3–9), and scaled transformation
              (Transform, months 9–12).
            </p>
            <div style={{ marginTop: "16pt" }}>
              <GanttRoadmap initiatives={roadmapInitiatives} />
            </div>
          </section>
        )}

        {/* ─── PAGE 25 - Regulatory Compliance ─── */}
        <section className="report-page">
          <h2 className="report-h2">{t("compliance_summary")}</h2>
          <p className="report-body">
            Compliance status against frameworks applicable to {region}, {sectorLabel.toLowerCase()} sector.
            Each framework is scored as a weighted percentage of met + partial requirements.
          </p>

          <ComplianceSummary frameworks={complianceSummaries} />

          {shadowAi.triggered && (
            <Callout tone="danger" title="Shadow AI Alert">
              Assessment responses indicate employees may be using public AI
              tools without formal organizational approval. This creates potential
              violations of data protection and cybersecurity regulations in {region}.
              Immediate action required.
            </Callout>
          )}
        </section>

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

        {/* ─── Workforce AI Readiness — Mode C only ─── *
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
              In addition to the eight pillar maturity scores, this assessment
              measured the personal AI readiness of {workforceRollup.cohort_size}{" "}
              respondent{workforceRollup.cohort_size === 1 ? "" : "s"}{" "}
              ({workforceRollup.completed_count} completed) across four VIFM
              individual readiness factors. The factors map to VIFM&apos;s
              behavioural framework — THINKING, RESULTS, PEOPLE, SELF.
              {assessment.assessment_tier === "deep_dive"
                ? " The deep-dive tier (12 items per factor) was used — research-grade reliability."
                : " The snapshot tier (6 items per factor) was used — directional reliability."}
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
                      : "—"}
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
                        {avg && avg.respondent_count > 0 ? avg.average.toFixed(2) : "—"}
                      </td>
                      <td style={cellRight}>{avg?.respondent_count ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <h3 className="report-h3">Reading the factor scores</h3>
            <ul className="report-body">
              <li><strong>4.0 and above</strong> — strong readiness on this factor; the cohort leverages AI well in this area.</li>
              <li><strong>3.0 to 3.9</strong> — developing; a clear opportunity to lift impact through targeted training or coaching.</li>
              <li><strong>Below 3.0</strong> — significant opportunity; address this factor first for the largest readiness lift.</li>
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

        {/* ─── PAGE 27 - Next Steps ─── */}
        <section className="report-page">
          <h2 className="report-h2">{t("next_steps")}</h2>
          <p className="report-body">
            Virginia Institute of Finance and Management (VIFM) offers targeted
            services mapped to the gaps identified in this assessment:
          </p>
          <ul className="report-body">
            <li><strong>AI Strategy Workshop</strong> - co-design a 12-month AI roadmap aligned to your business goals.</li>
            <li><strong>Data Foundations Programme</strong> - data quality, governance, and sovereignty.</li>
            <li><strong>AI Governance Playbook</strong> - policy templates, acceptable-use frameworks, DPIAs tailored to {region}.</li>
            <li><strong>AI Talent Development</strong> - role-based learning paths for leaders, specialists, and all staff.</li>
            <li><strong>Annual Reassessment</strong> - track progress year-on-year against the same benchmark.</li>
          </ul>
          <p className="report-body" style={{ marginTop: "16pt" }}>
            To discuss engagement, contact your VIFM consultant or
            email <strong>contact@viftraining.com</strong>.
          </p>
        </section>

        {/* ─── APPENDIX ─── */}
        <section className="report-page">
          <h2 className="report-h2">{t("appendix")}</h2>

          <h3 className="report-h3">Scoring methodology</h3>
          <p className="report-body">
            Each pillar raw score is the average of answered questions on a 1–5 scale.
            Weighted pillar scores are raw × (pillar weight ÷ 100). The overall
            organizational score is the sum of all eight weighted pillar scores.
          </p>

          <h3 className="report-h3">Item development &amp; validation</h3>
          <p className="report-body">
            Items in the v1.1 production bank were developed through three rounds:
            initial drafting by VIFM consultants against the VIFM-AC behavioural
            framework and reference regulatory frameworks; AI-assisted expansion
            with every suggestion reviewed by at least one consultant before
            inclusion; and a bilingual rewrite in Gulf Arabic at source rather
            than back-translation. Every item is tagged at the database level to
            exactly one construct (a pillar, on the org-side) — the assessment
            locks to the question-bank version active at creation, so this
            report is reproducible against the same items even if the bank
            advances. The full methodology brief (item development, content
            validity, reliability planning, reference frameworks, limitations)
            is published at{" "}
            <span style={{ fontFamily: "monospace", fontSize: "9pt" }}>
              docs/ARA-Methodology-Brief.md
            </span>{" "}
            on the VIFM platform repository.
          </p>

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
              {ARA_PILLARS.map((p) => {
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

          <h3 className="report-h3">Disclaimer</h3>
          <p className="report-body report-muted" style={{ fontSize: "9pt" }}>
            Investment signals indicate relative scale and category of financial
            commitment required. Actual costs vary based on organization size,
            existing infrastructure, vendor selection, and negotiated contracts.
            VIFM recommends conducting a detailed cost-benefit analysis for each
            high-investment initiative before budget allocation.
          </p>

          <h3 className="report-h3">Data retention notice</h3>
          <p className="report-body report-muted" style={{ fontSize: "9pt" }}>
            Client assessment data is retained for three years after archival.
            Generated reports are retained indefinitely as VIFM business records.
            To request data erasure, contact VIFM directly.
          </p>
        </section>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Pillar deep-dive pair (findings + recommendations)
// ─────────────────────────────────────────────────────────────
function PillarPages({
  pillarId,
  name,
  nameAr,
  row,
  notes,
  lang = "en",
}: {
  pillarId: AraPillarId;
  name: string;
  nameAr: string;
  row: PillarScoreRow | undefined;
  notes: ConsultantNoteRow[];
  lang?: "en" | "ar";
}) {
  const score = row?.raw_score != null ? Number(row.raw_score) : null;
  const gap = row?.benchmark_gap != null ? Number(row.benchmark_gap) : null;
  const validated = row?.consultant_validated_score != null ? Number(row.consultant_validated_score) : null;
  const selfScore = row?.self_assessment_score != null ? Number(row.self_assessment_score) : null;
  const perceptionGap = row?.perception_gap != null ? Number(row.perception_gap) : null;

  const gapValue = gap != null ? (gap > 0 ? `+${gap.toFixed(2)}` : gap.toFixed(2)) : "—";
  const gapTone: "positive" | "negative" | "neutral" =
    gap == null ? "neutral" : gap <= 0 ? "positive" : "negative";
  const perceptionTone: "neutral" | "warning" =
    perceptionGap != null && Math.abs(perceptionGap) > 0.5 ? "warning" : "neutral";
  const perceptionValue =
    perceptionGap != null ? (perceptionGap > 0 ? `+${perceptionGap.toFixed(2)}` : perceptionGap.toFixed(2)) : "—";

  const recs = recommendationsFor(name, score);

  return (
    <>
      {/* Findings page */}
      <section className="report-page">
        <SectionHeader
          eyebrow="Pillar deep dive · Findings"
          title={name}
          kicker={nameAr}
        />

        {/* Four-metric strip replaces the old score/gauge grid */}
        <div className="metric-strip">
          <Metric
            label="Raw score"
            value={score != null ? score.toFixed(2) : "—"}
            suffix="/ 5.00"
            tone={score == null ? "neutral" : score >= 4.0 ? "positive" : score < 3.0 ? "negative" : "warning"}
          />
          <Metric
            label="Benchmark gap"
            value={gapValue}
            suffix="vs 4.00"
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
            suffix={score != null ? `L${Math.max(1, Math.min(5, Math.ceil(score)))}` : ""}
            tone="brand"
          />
        </div>

        {/* Benchmark bar — slimmer, brand colors */}
        <div style={{ marginTop: "14pt" }}>
          <p style={{ fontSize: "8.5pt", letterSpacing: "0.08em",
            textTransform: "uppercase", color: TOKENS.mute, margin: "0 0 4pt",
            fontWeight: 600 }}>
            Score vs AI Ready benchmark
          </p>
          <div style={{ position: "relative", height: "14pt",
            background: TOKENS.line, borderRadius: "3pt", overflow: "hidden" }}>
            <div style={{
              position: "absolute", top: 0, left: 0, height: "100%",
              width: `${((score ?? 0) / 5) * 100}%`,
              background:
                score != null && score >= 4.0 ? TOKENS.emerald :
                score != null && score >= 3.0 ? TOKENS.amber :
                TOKENS.rose,
              borderRadius: "3pt",
            }} />
            <div style={{
              position: "absolute", top: "-2pt", left: "80%",
              height: "calc(100% + 4pt)", borderLeft: `2pt dashed ${TOKENS.navy}`,
            }} />
          </div>
          <div style={{ fontSize: "8pt", color: TOKENS.mute, marginTop: "3pt",
            textAlign: "right", letterSpacing: "0.05em" }}>
            4.0 · AI Ready benchmark
          </div>
        </div>

        {/* Key findings - each note is a typed card */}
        <h3 className="report-h3" style={{ marginTop: "18pt" }}>Key findings</h3>
        {notes.length === 0 ? (
          <EmptyCallout>
            Detailed findings will be added by the consultant during the Phase 2 workshop.
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
      </section>

      {/* Recommendations page */}
      <section className="report-page">
        <SectionHeader
          eyebrow="Pillar deep dive · Recommendations"
          title={name}
          kicker="Targeted actions to elevate this pillar toward the AI Ready benchmark"
        />

        <div className="rec-stack">
          {recs.map((r, i) => (
            <RecommendationCard key={i} rec={r} index={i + 1} />
          ))}
        </div>

        <Callout tone="info" title="How to sequence">
          Work top-to-bottom: the Quick Win actions unblock the Build actions,
          which in turn unlock the Transform action. Each action has been sized
          so a typical GCC organisation can complete it within a single quarter
          without new headcount.
        </Callout>
      </section>
    </>
  );
}

const cell: React.CSSProperties = { padding: "5pt 8pt", verticalAlign: "top" };
const cellRight: React.CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const cellLabel: React.CSSProperties = { ...cell, color: "#6b7280", fontWeight: 500, width: "40%" };
const cellHead: React.CSSProperties = { ...cell, fontWeight: 600, color: "#010131", fontSize: "10pt", textAlign: "left" };
const cellHeadRight: React.CSSProperties = { ...cellHead, textAlign: "right" };
