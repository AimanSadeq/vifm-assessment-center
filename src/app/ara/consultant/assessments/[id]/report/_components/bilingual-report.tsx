import { VifmLogo } from "@/components/shared/vifm-logo";
import { orgFactSheetRows } from "@/lib/reports/fact-sheet-content";
import { ARA_PILLARS, ARA_MATURITY_LEVELS, ARA_OVERALL_BANDS } from "@/lib/constants/ara-pillars";
import { ARA_STAGE_MAP } from "@/lib/constants/ara-stages";
import { ARA_INDIVIDUAL_FACTORS } from "@/lib/constants/ara-individual-factors";
import { ARA_AGENTIC_DIMENSIONS } from "@/lib/constants/ara-agentic-dimensions";
import type { FrameworkComplianceSummary } from "@/lib/ara/compliance";
import type { PeerBenchmarkResult } from "@/lib/ara/peer-benchmarks";
import type { YoYComparison } from "@/lib/ara/year-on-year";
import type { WorkforceReadinessRollup } from "@/lib/ara/workforce-readiness";
import type { AgenticReadinessRollup } from "@/lib/ara/agentic-readiness";
import type { AraEngagementStage, AraPillarId, AraUseCase } from "@/types/ara";
import { MaturityGauge } from "./maturity-gauge";
import { RadarChart } from "./radar-chart";
import { GapHeatmap } from "./gap-heatmap";
import { InvestmentMatrix } from "./investment-matrix";
import { GanttRoadmap } from "./gantt-roadmap";
import { ComplianceSummary } from "./compliance-summary";
import {
  FindingCard, inferFindingType,
  StatTile, Metric, Callout, EmptyCallout, FindingsPanel, TOKENS,
} from "./report-primitives";
import { tr } from "./report-i18n";

type PillarRow = {
  pillar_id: string;
  raw_score: number | null;
  maturity_label_en: string | null;
  benchmark_gap: number | null;
  self_assessment_score: number | null;
  consultant_validated_score: number | null;
  perception_gap: number | null;
};

type ConsultantNote = {
  pillar_id: string | null;
  note_text: string;
  note_text_ar?: string | null;
};

export type BilingualReportProps = {
  organizationName: string;
  organizationNameAr: string | null;
  region: "uae" | "saudi";
  sector: string;
  isSandbox: boolean;
  reportDate: string;
  overall: number | null;
  overallLabelEn: string | null;
  overallLabelAr: string | null;
  pillarMap: Map<AraPillarId, PillarRow>;
  scoreMap: Map<AraPillarId, number | null>;
  strengths: Array<{ pillar: string; score: number }>;
  gaps: Array<{ pillar: string; score: number; gap: number }>;
  heatmapData: Map<AraPillarId, Map<number, number>>;
  investmentData: Array<{ pillar_id: AraPillarId; raw_score: number | null; pillar_weight: number }>;
  roadmapInitiatives: Array<{ name: string; horizon: "quick" | "build" | "transform"; pillar: string }>;
  complianceSummaries: FrameworkComplianceSummary[];
  notesByPillar: Map<string, ConsultantNote[]>;
  shadowAiTriggered: boolean;
  pillarWeights: Record<string, number>;
  peerBenchmarks: PeerBenchmarkResult;
  useCases: Array<Pick<AraUseCase, "id" | "name" | "stage" | "pillar_id" | "risk_level" | "value_level" | "business_owner">>;
  /** Engagement stage drives pillar filtering + which sections render.
   *  Optional during the in-flight migration; defaults to "enterprise"
   *  so existing call sites keep compiling without a breaking change. */
  engagementStage?: AraEngagementStage;
  scopeLabel?: string | null;
  scopeLabelAr?: string | null;
  /** Year-on-year comparison vs the prior assessment for this org.
   *  Null when no prior exists; { compatible: false, ... } when prior
   *  used a different major question-bank version. */
  yoyComparison?: YoYComparison | null;
  /** Respondents list for the Organization Profile page. Optional
   *  during the in-flight migration. */
  respondents?: Array<{
    name: string;
    role_label_en: string | null;
    completed_at: string | null;
    assignments?: Array<{ pillar_id: string }>;
  }>;
  /** Current assessment year - shown in the YoY KPI strip. */
  currentYear?: number;
  /** Pillars in scope (migration 00029). Honours the per-assessment
   *  pillars_in_scope override when set, falls back to the stage default
   *  when null. Caller resolves via getPillarsForAssessment. Optional -
   *  defaults to stage default when omitted (back-compat). */
  pillarsInScope?: ReadonlyArray<AraPillarId>;
  /** Workforce AI Readiness (Mode C) cohort rollup. The Workforce
   *  section renders only when includeIndividualLayer is true and at
   *  least one respondent has an overall score. */
  workforceRollup?: WorkforceReadinessRollup | null;
  /** Agentic-AI Readiness cohort rollup. The Agentic section renders
   *  only when includeAgenticLayer is true and at least one respondent
   *  has answered agentic-dimension items. */
  agenticRollup?: AgenticReadinessRollup | null;
  /** Mode C toggle - gates the Workforce AI Readiness section. */
  includeIndividualLayer?: boolean;
  /** Agentic-layer toggle - gates the Agentic-AI Readiness section. */
  includeAgenticLayer?: boolean;
  /** Individual-layer tier (snapshot | deep_dive) - shapes the
   *  Workforce reliability caption. */
  assessmentTier?: string | null;
};

/**
 * True side-by-side bilingual landscape report per handover §5.3.
 * English left column, Arabic right column, A4 landscape per page.
 * Visuals span both columns on their own pages with bilingual captions.
 */
export function BilingualReport(p: BilingualReportProps) {
  const regionEn = p.region === "uae" ? "United Arab Emirates" : "Saudi Arabia";
  const regionAr = p.region === "uae" ? "الإمارات العربية المتحدة" : "المملكة العربية السعودية";
  const sectorCap = p.sector.charAt(0).toUpperCase() + p.sector.slice(1);
  // Stage drives pillar filtering + which strategic-output sections render.
  const stageDef = ARA_STAGE_MAP[p.engagementStage ?? "enterprise"] ?? ARA_STAGE_MAP.enterprise;
  // Pillars in scope for THIS assessment (override or stage default). Every
  // pillar-driven section uses this so a subset-stage run isn't zero-filled to
  // 8 pillars in the client PDF (mirrors the deep-dive filter at ~line 501).
  const scopedPillars = ARA_PILLARS.filter((pl) =>
    (p.pillarsInScope ?? stageDef.applicable_pillars).includes(pl.id),
  );
  const stageBadgeBg =
    stageDef.tone === "teal" ? "rgba(45, 212, 191, 0.15)" :
    stageDef.tone === "violet" ? "rgba(167, 139, 250, 0.18)" :
    "rgba(251, 191, 36, 0.15)";
  const stageBadgeColor =
    stageDef.tone === "teal" ? "#5EEAD4" :
    stageDef.tone === "violet" ? "#C4B5FD" :
    "#FCD34D";

  return (
    <>
      {/* ─── Cover - already bilingual by design ─── */}
      <section
        className="report-page-bilingual-with-visual"
        style={{ background: "#010131", color: "white", gridTemplateRows: "auto 1fr auto" }}
      >
        <div><VifmLogo variant="white" size="md" /></div>
        <div style={{ textAlign: "center", alignSelf: "center" }}>
          <p style={{ fontSize: "9pt", opacity: 0.7, letterSpacing: "0.15em", margin: 0 }}>
            {p.isSandbox ? tr("en", "confidential_sample") : tr("en", "confidential_internal")}
          </p>
          {/* Stage badge - mirrors the EN report cover. */}
          <div style={{ marginTop: "16pt" }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "6pt",
              padding: "4pt 12pt", borderRadius: "999pt",
              fontSize: "9pt", fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase",
              background: stageBadgeBg, color: stageBadgeColor,
              border: `1pt solid ${stageBadgeColor}40`,
            }}>
              Stage {stageDef.number} · {stageDef.label_en}{stageDef.is_pro_bono && " · Complimentary"}
            </span>
          </div>
          <h1 style={{ fontSize: "42pt", fontWeight: 600, color: "white", margin: "16pt 0 8pt" }}>
            {p.organizationName}
          </h1>
          {p.organizationNameAr && (
            <p dir="rtl" style={{ fontSize: "24pt", color: "white", opacity: 0.9, margin: "0 0 12pt" }}>
              {p.organizationNameAr}
            </p>
          )}
          {p.scopeLabel && (
            <p style={{ color: "white", opacity: 0.85, fontSize: "16pt", margin: "0 0 8pt", fontWeight: 500 }}>
              {p.scopeLabel}
              {p.scopeLabelAr && (
                <span dir="rtl" style={{ marginLeft: "8pt", opacity: 0.75 }}> · {p.scopeLabelAr}</span>
              )}
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20pt", marginTop: "12pt" }}>
            <p style={{ color: "white", opacity: 0.85, fontSize: "14pt" }}>
              AI Readiness Compass® Report
            </p>
            <p dir="rtl" style={{ color: "white", opacity: 0.85, fontSize: "14pt" }}>
              {tr("ar", "report_title")}
            </p>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20pt", fontSize: "9pt", opacity: 0.75 }}>
          <div>
            <p style={{ margin: 0 }}>{regionEn} · {sectorCap}</p>
            <p style={{ margin: 0 }}>Report generated {p.reportDate}</p>
          </div>
          <div dir="rtl">
            <p style={{ margin: 0 }}>{regionAr} · {sectorCap}</p>
            <p style={{ margin: 0 }}>{tr("ar", "report_generated")} {p.reportDate}</p>
          </div>
        </div>
      </section>

      {/* ─── Executive Summary - now mirrors EN portrait shape: ─── *
       *   1. Bilingual heading row
       *   2. KPI StatTile strip (4 tiles spanning full width)
       *   3. Centred MaturityGauge + score block
       *   4. Bilingual narrative + FindingsPanel (strengths / gaps) */}
      <section className="report-page-bilingual-with-visual">
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: "6mm" }}>
            <h2 className="report-h2" style={{ margin: 0 }}>{tr("en", "exec_summary")}</h2>
            <h2 className="report-h2" dir="rtl" style={{ margin: 0, textAlign: "right" }}>
              {tr("ar", "exec_summary")}
            </h2>
          </div>

          {/* KPI strip - split into two language-locked halves so the
              left column reads English LTR and the right column reads
              Arabic RTL. The two halves share a single grid row to stay
              visually aligned. */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10mm",
            marginBottom: "8mm",
          }}>
            {/* English KPI strip */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6pt",
            }}>
              <StatTile
                label={tr("en", "overall_readiness")}
                value={p.overall != null ? p.overall.toFixed(2) : "-"}
                suffix="/ 5.00"
                accent={p.overallLabelEn ?? ""}
                accentColor={TOKENS.accent}
              />
              <StatTile
                label={tr("en", "maturity_band")}
                value={p.overallLabelEn ?? "-"}
                accent={tr("en", "weighted_aggregate")}
                accentColor={TOKENS.mute}
              />
              <StatTile
                label={tr("en", "headline_strengths")}
                value={String(p.strengths.length)}
                suffix="/ 8"
                accent={tr("en", "pillars_at_above_benchmark")}
                accentColor={TOKENS.emerald}
              />
              <StatTile
                label={tr("en", "critical_gaps")}
                value={String(p.gaps.length)}
                suffix="/ 8"
                accent={tr("en", "pillars_requiring_focus")}
                accentColor={TOKENS.rose}
              />
            </div>
            {/* Arabic KPI strip - RTL */}
            <div dir="rtl" style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6pt",
            }}>
              <StatTile
                label={tr("ar", "overall_readiness")}
                value={p.overall != null ? p.overall.toFixed(2) : "-"}
                suffix="/ ٥٫٠٠"
                accent={p.overallLabelAr ?? ""}
                accentColor={TOKENS.accent}
              />
              <StatTile
                label={tr("ar", "maturity_band")}
                value={p.overallLabelAr ?? "-"}
                accent={tr("ar", "weighted_aggregate")}
                accentColor={TOKENS.mute}
              />
              <StatTile
                label={tr("ar", "headline_strengths")}
                value={String(p.strengths.length)}
                suffix="/ ٨"
                accent={tr("ar", "pillars_at_above_benchmark")}
                accentColor={TOKENS.emerald}
              />
              <StatTile
                label={tr("ar", "critical_gaps")}
                value={String(p.gaps.length)}
                suffix="/ ٨"
                accent={tr("ar", "pillars_requiring_focus")}
                accentColor={TOKENS.rose}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12mm", justifyContent: "center" }}>
            <div style={{ flex: "0 0 auto" }}>
              <MaturityGauge score={p.overall} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "60pt", fontWeight: 600, color: "#010131", lineHeight: 1, margin: "0 0 4pt" }}>
                {p.overall != null ? p.overall.toFixed(2) : "-"}
                <span style={{ fontSize: "22pt", color: "#6b7280", fontWeight: 400 }}> / 5.00</span>
              </p>
              <p style={{ fontSize: "14pt", color: "#5391D5", fontWeight: 500 }}>
                {p.overallLabelEn ?? "-"}
                {p.overallLabelAr && (
                  <span dir="rtl" style={{ marginLeft: "8pt" }}>· {p.overallLabelAr}</span>
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="bilingual-text">
          <div className="col-en">
            <p className="report-body">{tr("en", "exec_intro")}</p>
            <FindingsPanel
              variant="strength"
              title={tr("en", "headline_strengths")}
              emptyMessage={tr("en", "no_strengths_panel")}
              items={p.strengths.slice(0, 3).map((s) => ({
                headline: s.pillar,
                metric: `${s.score.toFixed(2)} / 5.00`,
              }))}
            />
            <div style={{ height: "8pt" }} />
            <FindingsPanel
              variant="gap"
              title={tr("en", "critical_gaps")}
              emptyMessage={tr("en", "no_gaps_panel")}
              items={p.gaps.slice(0, 3).map((g) => ({
                headline: g.pillar,
                metric: `${g.score.toFixed(2)} · ${g.gap > 0 ? "+" : ""}${g.gap.toFixed(2)}`,
              }))}
            />
          </div>
          <div className="col-ar" dir="rtl">
            <p className="report-body">{tr("ar", "exec_intro")}</p>
            <FindingsPanel
              variant="strength"
              title={tr("ar", "headline_strengths")}
              emptyMessage={tr("ar", "no_strengths_panel")}
              items={p.strengths.slice(0, 3).map((s) => {
                const pillar = ARA_PILLARS.find((pp) => pp.name_en === s.pillar);
                return {
                  headline: pillar?.name_ar ?? s.pillar,
                  metric: `${s.score.toFixed(2)} / ٥٫٠٠`,
                };
              })}
            />
            <div style={{ height: "8pt" }} />
            <FindingsPanel
              variant="gap"
              title={tr("ar", "critical_gaps")}
              emptyMessage={tr("ar", "no_gaps_panel")}
              items={p.gaps.slice(0, 3).map((g) => {
                const pillar = ARA_PILLARS.find((pp) => pp.name_en === g.pillar);
                return {
                  headline: pillar?.name_ar ?? g.pillar,
                  metric: `${g.score.toFixed(2)} · ${g.gap > 0 ? "+" : ""}${g.gap.toFixed(2)}`,
                };
              })}
            />
          </div>
        </div>
      </section>

      {/* ─── How to Read - pure text side-by-side ─── */}
      <section className="report-page-bilingual">
        <div className="col-en">
          <h2 className="report-h2">{tr("en", "how_to_read")}</h2>
          <p className="report-body">{tr("en", "how_to_read_intro")}</p>
          <h3 className="report-h3">{tr("en", "maturity_scale")}</h3>
          <ul className="report-body">
            {ARA_MATURITY_LEVELS.map((m) => (
              <li key={m.level}>
                <strong>L{m.level} {m.label_en}</strong> ({m.min.toFixed(1)}–{m.max.toFixed(1)}) - {tr("en", `maturity_l${m.level}` as any)}
              </li>
            ))}
          </ul>
          <h3 className="report-h3">{tr("en", "overall_interpretation")}</h3>
          <ul className="report-body">
            {ARA_OVERALL_BANDS.map((b) => (
              <li key={b.label_en}>
                <strong style={{ color: b.color }}>{b.label_en}</strong> ({b.min.toFixed(1)}–{b.max.toFixed(1)})
              </li>
            ))}
          </ul>
        </div>
        <div className="col-ar" dir="rtl">
          <h2 className="report-h2">{tr("ar", "how_to_read")}</h2>
          <p className="report-body">{tr("ar", "how_to_read_intro")}</p>
          <h3 className="report-h3">{tr("ar", "maturity_scale")}</h3>
          <ul className="report-body">
            {ARA_MATURITY_LEVELS.map((m) => (
              <li key={m.level}>
                <strong>المستوى {m.level} - {m.label_ar}</strong> ({m.min.toFixed(1)}–{m.max.toFixed(1)}) - {tr("ar", `maturity_l${m.level}` as any)}
              </li>
            ))}
          </ul>
          <h3 className="report-h3">{tr("ar", "overall_interpretation")}</h3>
          <ul className="report-body">
            {ARA_OVERALL_BANDS.map((b) => (
              <li key={b.label_en}>
                <strong style={{ color: b.color }}>{b.label_ar}</strong> ({b.min.toFixed(1)}–{b.max.toFixed(1)})
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ─── Organization Profile + Respondents ─── *
       * Mirrors the EN portrait report's profile page so bilingual
       * readers see methodology + who answered. Always emitted, even
       * with zero respondents, so the table-of-contents stays stable. */}
      <section className="report-page-bilingual">
        <div className="col-en">
          <h2 className="report-h2">{tr("en", "org_profile")}</h2>
          <h3 className="report-h3">{tr("en", "respondents")} ({(p.respondents ?? []).length})</h3>
          {(p.respondents ?? []).length === 0 ? (
            <p className="report-body report-muted">No respondents recorded.</p>
          ) : (
            <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={biCellHead}>{tr("en", "name")}</th>
                  <th style={biCellHead}>{tr("en", "role")}</th>
                  <th style={biCellHead}>{tr("en", "status")}</th>
                </tr>
              </thead>
              <tbody>
                {(p.respondents ?? []).map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={biCell}><strong>{r.name}</strong></td>
                    <td style={biCell}>{r.role_label_en ?? "-"}</td>
                    <td style={biCell}>{r.completed_at ? tr("en", "completed") : tr("en", "in_progress")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="col-ar" dir="rtl">
          <h2 className="report-h2">{tr("ar", "org_profile")}</h2>
          <h3 className="report-h3">{tr("ar", "respondents")} ({(p.respondents ?? []).length})</h3>
          {(p.respondents ?? []).length === 0 ? (
            <p className="report-body report-muted">لا يوجد مستجيبون مسجلون.</p>
          ) : (
            <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={biCellHead}>{tr("ar", "name")}</th>
                  <th style={biCellHead}>{tr("ar", "role")}</th>
                  <th style={biCellHead}>{tr("ar", "status")}</th>
                </tr>
              </thead>
              <tbody>
                {(p.respondents ?? []).map((r, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={biCell}><strong>{r.name}</strong></td>
                    <td style={biCell}>{r.role_label_en ?? "-"}</td>
                    <td style={biCell}>{r.completed_at ? tr("ar", "completed") : tr("ar", "in_progress")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ─── Assessment Fact Sheet ─── */}
      <section className="report-page-bilingual">
        <div className="col-en">
          <h2 className="report-h2">Assessment Fact Sheet</h2>
          {orgFactSheetRows("en").map((r) => (
            <div key={r.label} style={{ display: "flex", gap: "8px", marginBottom: "5pt" }}>
              <span className="report-body" style={{ width: "92pt", flexShrink: 0, fontWeight: 700 }}>{r.label}</span>
              <span className="report-body report-muted" style={{ flex: 1 }}>{r.value}</span>
            </div>
          ))}
        </div>
        <div className="col-ar" dir="rtl">
          <h2 className="report-h2">بطاقة معلومات التقييم</h2>
          {orgFactSheetRows("ar").map((r) => (
            <div key={r.label} style={{ display: "flex", gap: "8px", marginBottom: "5pt" }}>
              <span className="report-body" style={{ width: "92pt", flexShrink: 0, fontWeight: 700 }}>{r.label}</span>
              <span className="report-body report-muted" style={{ flex: 1 }}>{r.value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Radar Overview ─── */}
      <section className="report-page-bilingual-with-visual">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: "6mm" }}>
          <h2 className="report-h2" style={{ margin: 0 }}>{tr("en", "pillar_overview")}</h2>
          <h2 className="report-h2" dir="rtl" style={{ margin: 0, textAlign: "right" }}>
            {tr("ar", "pillar_overview")}
          </h2>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <RadarChart pillarScores={p.scoreMap} size={400} pillars={scopedPillars} />
        </div>
        <div className="bilingual-text">
          <div className="col-en">
            <p className="report-body">{tr("en", "pillar_overview_intro")}</p>
          </div>
          <div className="col-ar" dir="rtl">
            <p className="report-body">{tr("ar", "pillar_overview_intro")}</p>
          </div>
        </div>
      </section>

      {/* ─── Pillar Deep Dives - one page per applicable pillar ─── *
       * Filtered by engagement stage. Now mirrors the EN portrait
       * pillar deep-dive shape: Metric strip on top (full-width),
       * then bilingual columns with FindingCard + RecommendationCard
       * stacks on both sides. */}
      {ARA_PILLARS
        .filter((pillar) => (p.pillarsInScope ?? stageDef.applicable_pillars).includes(pillar.id))
        .map((pillar) => {
          const row = p.pillarMap.get(pillar.id);
          const pillarNotes = p.notesByPillar.get(pillar.id) ?? [];
          const score = row?.raw_score != null ? Number(row.raw_score) : null;
          const gap = row?.benchmark_gap != null ? Number(row.benchmark_gap) : null;
          const validated = row?.consultant_validated_score != null ? Number(row.consultant_validated_score) : null;
          const selfScore = row?.self_assessment_score != null ? Number(row.self_assessment_score) : null;
          const perceptionGap = row?.perception_gap != null ? Number(row.perception_gap) : null;
          const actions = actionKeys(score);

          const gapValue = gap != null ? (gap > 0 ? `+${gap.toFixed(2)}` : gap.toFixed(2)) : "-";
          const gapTone: "positive" | "negative" | "neutral" =
            gap == null ? "neutral" : gap <= 0 ? "positive" : "negative";
          const perceptionTone: "neutral" | "warning" =
            perceptionGap != null && Math.abs(perceptionGap) > 0.5 ? "warning" : "neutral";
          const perceptionValue =
            perceptionGap != null ? (perceptionGap > 0 ? `+${perceptionGap.toFixed(2)}` : perceptionGap.toFixed(2)) : "-";

          return (
            <section key={pillar.id} className="report-page-bilingual">
              {/* Bilingual title row spans both columns */}
              <div style={{
                gridColumn: "1 / -1",
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8pt",
                marginBottom: "8pt", paddingBottom: "6pt",
                borderBottom: `1pt solid ${TOKENS.line}`,
              }}>
                <div>
                  <p className="report-muted" style={{ fontSize: "9pt", letterSpacing: "0.1em", margin: 0, textTransform: "uppercase" }}>
                    {tr("en", "pillar_deep_dive")}
                  </p>
                  <h2 className="report-h2" style={{ margin: "2pt 0 0", borderBottom: "none", paddingBottom: 0 }}>
                    {pillar.name_en}
                  </h2>
                </div>
                <div dir="rtl" style={{ textAlign: "right" }}>
                  <p className="report-muted" style={{ fontSize: "9pt", letterSpacing: "0.1em", margin: 0, textTransform: "uppercase" }}>
                    {tr("ar", "pillar_deep_dive")}
                  </p>
                  <h2 className="report-h2" style={{ margin: "2pt 0 0", borderBottom: "none", paddingBottom: 0 }}>
                    {pillar.name_ar}
                  </h2>
                </div>
              </div>

              {/* Metric strip - split into language-locked halves so the
                  English column reads LTR and the Arabic column reads RTL.
                  Sits in the EN/AR columns of the parent grid. */}
              <div className="col-en" style={{ gridRow: "2", marginBottom: "8pt" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6pt",
                }}>
                  <Metric
                    label={tr("en", "raw_score")}
                    value={score != null ? score.toFixed(2) : "-"}
                    suffix="/ 5.00"
                    tone={score == null ? "neutral" : score >= 4.0 ? "positive" : score < 3.0 ? "negative" : "warning"}
                  />
                  <Metric
                    label={tr("en", "benchmark_gap")}
                    value={gapValue}
                    suffix="vs 4.00"
                    tone={gapTone}
                  />
                  <Metric
                    label={tr("en", "perception_vs_reality")}
                    value={perceptionValue}
                    suffix={selfScore != null && validated != null
                      ? `${tr("en", "self_short")} ${selfScore.toFixed(2)} · ${tr("en", "consultant_short")} ${validated.toFixed(2)}`
                      : tr("en", "not_validated")}
                    tone={perceptionTone}
                  />
                  <Metric
                    label={tr("en", "maturity_short")}
                    value={row?.maturity_label_en ?? tr("en", "unscored")}
                    suffix={score != null ? `L${Math.max(1, Math.min(5, Math.ceil(score)))}` : ""}
                    tone="brand"
                  />
                </div>
              </div>
              <div className="col-ar" dir="rtl" style={{ gridRow: "2", marginBottom: "8pt" }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6pt",
                }}>
                  <Metric
                    label={tr("ar", "raw_score")}
                    value={score != null ? score.toFixed(2) : "-"}
                    suffix="/ ٥٫٠٠"
                    tone={score == null ? "neutral" : score >= 4.0 ? "positive" : score < 3.0 ? "negative" : "warning"}
                  />
                  <Metric
                    label={tr("ar", "benchmark_gap")}
                    value={gapValue}
                    suffix="مقابل ٤٫٠٠"
                    tone={gapTone}
                  />
                  <Metric
                    label={tr("ar", "perception_vs_reality")}
                    value={perceptionValue}
                    suffix={selfScore != null && validated != null
                      ? `${tr("ar", "self_short")} ${selfScore.toFixed(2)} · ${tr("ar", "consultant_short")} ${validated.toFixed(2)}`
                      : tr("ar", "not_validated")}
                    tone={perceptionTone}
                  />
                  <Metric
                    label={tr("ar", "maturity_short")}
                    value={row?.maturity_label_en ? arabicMaturityLabel(row.maturity_label_en) : tr("ar", "unscored")}
                    suffix={score != null ? `المستوى ${Math.max(1, Math.min(5, Math.ceil(score)))}` : ""}
                    tone="brand"
                  />
                </div>
              </div>

              {/* Findings + actions, bilingual columns (row 3 of the grid) */}
              <div className="col-en" style={{ gridRow: "3" }}>
                <h3 className="report-h3" style={{ marginTop: "4pt" }}>{tr("en", "key_findings")}</h3>
                {pillarNotes.length === 0 ? (
                  <EmptyCallout>{tr("en", "findings_pending")}</EmptyCallout>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6pt", marginTop: "4pt" }}>
                    {pillarNotes.map((n, i) => (
                      <FindingCard
                        key={i}
                        lang="en"
                        index={i + 1}
                        type={inferFindingType(n.note_text)}
                        text={n.note_text}
                      />
                    ))}
                  </div>
                )}
                <h3 className="report-h3">{tr("en", "suggested_actions")}</h3>
                <ul className="report-body">
                  {actions.map((k) => <li key={k}>{tr("en", k)}</li>)}
                </ul>
              </div>
              <div className="col-ar" dir="rtl" style={{ gridRow: "3" }}>
                <h3 className="report-h3" style={{ marginTop: "4pt" }}>{tr("ar", "key_findings")}</h3>
                {pillarNotes.length === 0 ? (
                  <EmptyCallout>{tr("ar", "findings_pending")}</EmptyCallout>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6pt", marginTop: "4pt" }}>
                    {pillarNotes.map((n, i) => (
                      <FindingCard
                        key={i}
                        lang="ar"
                        index={i + 1}
                        type={inferFindingType(n.note_text)}
                        text={n.note_text_ar ?? n.note_text}
                      />
                    ))}
                  </div>
                )}
                <h3 className="report-h3">{tr("ar", "suggested_actions")}</h3>
                <ul className="report-body">
                  {actions.map((k) => <li key={k}>{tr("ar", k)}</li>)}
                </ul>
              </div>
            </section>
          );
        })}

      {/* ─── General observations (notes not tied to a pillar) ─── *
       * NOTES-14: general (pillar_id NULL) include-in-report notes were
       * collected under "_general" but never rendered in the bilingual report
       * (only per-pillar notes were). Render them as their own bilingual
       * findings section so they reach the client report, matching the
       * single-language report's flat "Key findings". Only when present. */}
      {(() => {
        const generalNotes = p.notesByPillar.get("_general") ?? [];
        if (generalNotes.length === 0) return null;
        return (
          <section className="report-page-bilingual">
            <div className="col-en">
              <h2 className="report-h2">{tr("en", "key_findings")}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "6pt", marginTop: "4pt" }}>
                {generalNotes.map((n, i) => (
                  <FindingCard
                    key={i}
                    lang="en"
                    index={i + 1}
                    type={inferFindingType(n.note_text)}
                    text={n.note_text}
                  />
                ))}
              </div>
            </div>
            <div className="col-ar" dir="rtl">
              <h2 className="report-h2">{tr("ar", "key_findings")}</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "6pt", marginTop: "4pt" }}>
                {generalNotes.map((n, i) => (
                  <FindingCard
                    key={i}
                    lang="ar"
                    index={i + 1}
                    type={inferFindingType(n.note_text)}
                    text={n.note_text_ar ?? n.note_text}
                  />
                ))}
              </div>
            </div>
          </section>
        );
      })()}

      {/* ─── Gap Heatmap ─── */}
      <section className="report-page-bilingual-with-visual">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: "6mm" }}>
          <h2 className="report-h2" style={{ margin: 0 }}>{tr("en", "gap_heatmap")}</h2>
          <h2 className="report-h2" dir="rtl" style={{ margin: 0, textAlign: "right" }}>
            {tr("ar", "gap_heatmap")}
          </h2>
        </div>
        <div><GapHeatmap scoresByPillarByBucket={p.heatmapData} /></div>
        <div className="bilingual-text">
          <div className="col-en"><p className="report-body">{tr("en", "heatmap_intro")}</p></div>
          <div className="col-ar" dir="rtl"><p className="report-body">{tr("ar", "heatmap_intro")}</p></div>
        </div>
      </section>

      {/* ─── Investment Matrix (Stage 2+ only) ─── */}
      {p.engagementStage !== "department" && (
        <section className="report-page-bilingual-with-visual">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: "6mm" }}>
            <h2 className="report-h2" style={{ margin: 0 }}>{tr("en", "investment_matrix")}</h2>
            <h2 className="report-h2" dir="rtl" style={{ margin: 0, textAlign: "right" }}>
              {tr("ar", "investment_matrix")}
            </h2>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <InvestmentMatrix pillarData={p.investmentData} />
          </div>
          <div className="bilingual-text">
            <div className="col-en"><p className="report-body">{tr("en", "matrix_intro")}</p></div>
            <div className="col-ar" dir="rtl"><p className="report-body">{tr("ar", "matrix_intro")}</p></div>
          </div>
        </section>
      )}

      {/* ─── Gantt Roadmap (Stage 2+ only) ─── */}
      {p.engagementStage !== "department" && (
        <section className="report-page-bilingual-with-visual">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: "6mm" }}>
            <h2 className="report-h2" style={{ margin: 0 }}>{tr("en", "roadmap")}</h2>
            <h2 className="report-h2" dir="rtl" style={{ margin: 0, textAlign: "right" }}>
              {tr("ar", "roadmap")}
            </h2>
          </div>
          <div><GanttRoadmap initiatives={p.roadmapInitiatives} /></div>
          <div className="bilingual-text">
            <div className="col-en"><p className="report-body">{tr("en", "roadmap_intro")}</p></div>
            <div className="col-ar" dir="rtl"><p className="report-body">{tr("ar", "roadmap_intro")}</p></div>
          </div>
        </section>
      )}

      {/* ─── Year-on-Year comparison ─── *
       * Always rendered. Three states: no prior, baseline-reset, or
       * a compatible prior with deltas. Mirrors the EN portrait
       * report's YoY page so bilingual readers see the same view. */}
      {(() => {
        const yoy = p.yoyComparison;
        const overallDelta =
          yoy && yoy.compatible && yoy.current_overall != null && yoy.prior_overall != null
            ? Number((yoy.current_overall - yoy.prior_overall).toFixed(2))
            : null;
        return (
          <section className="report-page-bilingual">
            <div className="col-en">
              <h2 className="report-h2">{tr("en", "year_on_year")}</h2>
              <p className="report-body">{tr("en", "yoy_intro")}</p>
              {!yoy && <EmptyCallout>{tr("en", "yoy_no_prior")}</EmptyCallout>}
              {yoy && !yoy.compatible && (
                <Callout tone="info" title={tr("en", "year_on_year")}>
                  {tr("en", "yoy_baseline_reset")}
                </Callout>
              )}
              {yoy && yoy.compatible && (
                <>
                  <table className="report-body" style={{ width: "100%", borderCollapse: "collapse", marginTop: "6pt" }}>
                    <thead>
                      <tr style={{ background: "#f3f4f6" }}>
                        <th style={biCellHead}>{tr("en", "pillar")}</th>
                        <th style={biCellHeadRight}>{yoy.prior_year ?? tr("en", "yoy_prior_year")}</th>
                        <th style={biCellHeadRight}>{p.currentYear ?? tr("en", "yoy_current_year")}</th>
                        <th style={biCellHeadRight}>{tr("en", "yoy_delta")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yoy.pillars.map((pi) => {
                        const dColor = pi.delta == null ? "#6b7280" : pi.delta > 0 ? "#34D399" : pi.delta < 0 ? "#FB7185" : "#6b7280";
                        const dLabel = pi.delta == null ? "-" : pi.delta > 0 ? `+${pi.delta.toFixed(2)}` : pi.delta.toFixed(2);
                        const name = ARA_PILLARS.find((x) => x.id === pi.pillar_id)?.name_en ?? pi.pillar_id;
                        return (
                          <tr key={pi.pillar_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                            <td style={biCell}>{name}</td>
                            <td style={biCellRight} className="report-muted">{pi.prior_raw != null ? pi.prior_raw.toFixed(2) : "-"}</td>
                            <td style={biCellRight}>{pi.current_raw != null ? pi.current_raw.toFixed(2) : "-"}</td>
                            <td style={{ ...biCellRight, color: dColor, fontWeight: 500 }}>{dLabel}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {overallDelta != null && (
                    <p className="report-body" style={{ marginTop: "8pt" }}>
                      <strong>{tr("en", "yoy_overall_delta")}:</strong>{" "}
                      <span style={{ color: overallDelta > 0 ? "#34D399" : overallDelta < 0 ? "#FB7185" : "#6b7280", fontWeight: 600 }}>
                        {overallDelta > 0 ? `+${overallDelta.toFixed(2)}` : overallDelta.toFixed(2)}
                      </span>
                    </p>
                  )}
                </>
              )}
            </div>
            <div className="col-ar" dir="rtl">
              <h2 className="report-h2">{tr("ar", "year_on_year")}</h2>
              <p className="report-body">{tr("ar", "yoy_intro")}</p>
              {!yoy && <EmptyCallout>{tr("ar", "yoy_no_prior")}</EmptyCallout>}
              {yoy && !yoy.compatible && (
                <Callout tone="info" title={tr("ar", "year_on_year")}>
                  {tr("ar", "yoy_baseline_reset")}
                </Callout>
              )}
              {yoy && yoy.compatible && (
                <>
                  <table className="report-body" style={{ width: "100%", borderCollapse: "collapse", marginTop: "6pt" }}>
                    <thead>
                      <tr style={{ background: "#f3f4f6" }}>
                        <th style={biCellHead}>{tr("ar", "pillar")}</th>
                        <th style={biCellHeadRight}>{yoy.prior_year ?? tr("ar", "yoy_prior_year")}</th>
                        <th style={biCellHeadRight}>{p.currentYear ?? tr("ar", "yoy_current_year")}</th>
                        <th style={biCellHeadRight}>{tr("ar", "yoy_delta")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {yoy.pillars.map((pi) => {
                        const dColor = pi.delta == null ? "#6b7280" : pi.delta > 0 ? "#34D399" : pi.delta < 0 ? "#FB7185" : "#6b7280";
                        const dLabel = pi.delta == null ? "-" : pi.delta > 0 ? `+${pi.delta.toFixed(2)}` : pi.delta.toFixed(2);
                        const name = ARA_PILLARS.find((x) => x.id === pi.pillar_id)?.name_ar ?? pi.pillar_id;
                        return (
                          <tr key={pi.pillar_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                            <td style={biCell}>{name}</td>
                            <td style={biCellRight} className="report-muted">{pi.prior_raw != null ? pi.prior_raw.toFixed(2) : "-"}</td>
                            <td style={biCellRight}>{pi.current_raw != null ? pi.current_raw.toFixed(2) : "-"}</td>
                            <td style={{ ...biCellRight, color: dColor, fontWeight: 500 }}>{dLabel}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {overallDelta != null && (
                    <p className="report-body" style={{ marginTop: "8pt" }}>
                      <strong>{tr("ar", "yoy_overall_delta")}:</strong>{" "}
                      <span style={{ color: overallDelta > 0 ? "#34D399" : overallDelta < 0 ? "#FB7185" : "#6b7280", fontWeight: 600 }}>
                        {overallDelta > 0 ? `+${overallDelta.toFixed(2)}` : overallDelta.toFixed(2)}
                      </span>
                    </p>
                  )}
                </>
              )}
            </div>
          </section>
        );
      })()}

      {/* ─── Regulatory Compliance ─── */}
      <section className="report-page-bilingual-with-visual">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: "6mm" }}>
          <h2 className="report-h2" style={{ margin: 0 }}>{tr("en", "compliance_summary")}</h2>
          <h2 className="report-h2" dir="rtl" style={{ margin: 0, textAlign: "right" }}>
            {tr("ar", "compliance_summary")}
          </h2>
        </div>
        <div><ComplianceSummary frameworks={p.complianceSummaries} /></div>
        <div className="bilingual-text">
          <div className="col-en">
            <p className="report-body">{tr("en", "compliance_intro")}</p>
            {p.shadowAiTriggered && (
              <Callout tone="danger" title={tr("en", "shadow_ai_alert")}>
                {tr("en", "shadow_ai_body")}
              </Callout>
            )}
          </div>
          <div className="col-ar" dir="rtl">
            <p className="report-body">{tr("ar", "compliance_intro")}</p>
            {p.shadowAiTriggered && (
              <Callout tone="danger" title={tr("ar", "shadow_ai_alert")}>
                {tr("ar", "shadow_ai_body")}
              </Callout>
            )}
          </div>
        </div>
      </section>

      {/* ─── AI Use Case Portfolio ─── */}
      {p.useCases.length > 0 && (
        <section className="report-page-bilingual-with-visual">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: "6mm" }}>
            <h2 className="report-h2" style={{ margin: 0 }}>AI Use Case Portfolio</h2>
            <h2 className="report-h2" dir="rtl" style={{ margin: 0, textAlign: "right" }}>
              محفظة حالات استخدام الذكاء الاصطناعي
            </h2>
          </div>

          <div>
            {/* Stage counts */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6pt", marginBottom: "8pt" }}>
              {(["ideation", "piloting", "production", "retired"] as const).map((stg) => {
                const count = p.useCases.filter((u) => u.stage === stg).length;
                const colors = {
                  ideation: "#9ca3af",
                  piloting: "#FDBA74",
                  production: "#34D399",
                  retired: "#6b7280",
                };
                return (
                  <div key={stg} style={{ padding: "6pt", background: "#f9fafb", borderRadius: "4pt", textAlign: "center" }}>
                    <p style={{ fontSize: "18pt", fontWeight: 600, color: colors[stg], margin: 0 }}>{count}</p>
                    <p style={{ fontSize: "8pt", color: "#6b7280", margin: 0, textTransform: "uppercase" }}>{stg}</p>
                  </div>
                );
              })}
            </div>

            {/* Use case table */}
            <table className="report-body" style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={ucHead}>Use case</th>
                  <th style={ucHead}>Stage</th>
                  <th style={ucHead}>Risk</th>
                  <th style={ucHead}>Value</th>
                  <th style={ucHead}>Pillar</th>
                </tr>
              </thead>
              <tbody>
                {p.useCases.map((u) => {
                  const riskColor: Record<string, string> = {
                    low: "#34D399", medium: "#FBBF24", high: "#FDBA74", critical: "#FB7185",
                  };
                  return (
                    <tr key={u.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={ucCell}><strong>{u.name}</strong></td>
                      <td style={{ ...ucCell, textTransform: "capitalize" }}>{u.stage}</td>
                      <td style={{ ...ucCell, color: riskColor[u.risk_level], textTransform: "capitalize", fontWeight: 500 }}>
                        {u.risk_level}
                      </td>
                      <td style={{ ...ucCell, textTransform: "capitalize" }}>{u.value_level}</td>
                      <td style={ucCell}>
                        {u.pillar_id
                          ? ARA_PILLARS.find((pp) => pp.id === u.pillar_id)?.name_en ?? u.pillar_id
                          : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bilingual-text">
            <div className="col-en">
              <p className="report-body">
                Inventory of AI initiatives across the organization, scored by
                stage, risk, and business value. Use this to sequence investment
                and prioritise governance effort.
              </p>
            </div>
            <div className="col-ar" dir="rtl">
              <p className="report-body">
                جرد مبادرات الذكاء الاصطناعي عبر المنظمة، مقيّمة حسب المرحلة
                والمخاطر والقيمة التجارية. استخدم هذا لترتيب الاستثمار وتحديد
                أولويات جهد الحوكمة.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ─── Peer Benchmark (only if real peer data available) ─── */}
      {p.peerBenchmarks.has_enough_data && (
        <section className="report-page-bilingual">
          <div className="col-en">
            <h2 className="report-h2">Peer benchmark</h2>
            <p className="report-body">
              Median pillar scores from {p.peerBenchmarks.sample_size} anonymised
              peer organisations in the same region and sector.
            </p>
            <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={ucHead}>Pillar</th>
                  <th style={{ ...ucHead, textAlign: "right" }}>You</th>
                  <th style={{ ...ucHead, textAlign: "right" }}>Peer median</th>
                  <th style={{ ...ucHead, textAlign: "right" }}>Δ</th>
                </tr>
              </thead>
              <tbody>
                {scopedPillars.map((pp) => {
                  const row = p.pillarMap.get(pp.id);
                  const s = row?.raw_score != null ? Number(row.raw_score) : null;
                  const peer = p.peerBenchmarks.pillars.find((x) => x.pillar_id === pp.id)?.median;
                  const delta = s != null && peer != null ? s - peer : null;
                  return (
                    <tr key={pp.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={ucCell}>{pp.name_en}</td>
                      <td style={{ ...ucCell, textAlign: "right" }}>{s != null ? s.toFixed(2) : "-"}</td>
                      <td style={{ ...ucCell, textAlign: "right" }} className="report-muted">
                        {peer != null ? peer.toFixed(2) : "-"}
                      </td>
                      <td style={{ ...ucCell, textAlign: "right", color: delta != null ? (delta >= 0 ? "#34D399" : "#FB7185") : undefined }}>
                        {delta != null ? (delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="col-ar" dir="rtl">
            <h2 className="report-h2">المقارنة مع النظراء</h2>
            <p className="report-body">
              النتائج الوسيطة للركائز من {p.peerBenchmarks.sample_size} منظمات
              نظيرة مجهولة الهوية في نفس المنطقة والقطاع.
            </p>
            <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={ucHead}>الركيزة</th>
                  <th style={{ ...ucHead, textAlign: "left" }}>أنت</th>
                  <th style={{ ...ucHead, textAlign: "left" }}>وسيط النظراء</th>
                  <th style={{ ...ucHead, textAlign: "left" }}>الفرق</th>
                </tr>
              </thead>
              <tbody>
                {scopedPillars.map((pp) => {
                  const row = p.pillarMap.get(pp.id);
                  const s = row?.raw_score != null ? Number(row.raw_score) : null;
                  const peer = p.peerBenchmarks.pillars.find((x) => x.pillar_id === pp.id)?.median;
                  const delta = s != null && peer != null ? s - peer : null;
                  return (
                    <tr key={pp.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={ucCell}>{pp.name_ar}</td>
                      <td style={{ ...ucCell, textAlign: "left" }}>{s != null ? s.toFixed(2) : "-"}</td>
                      <td style={{ ...ucCell, textAlign: "left" }} className="report-muted">
                        {peer != null ? peer.toFixed(2) : "-"}
                      </td>
                      <td style={{ ...ucCell, textAlign: "left", color: delta != null ? (delta >= 0 ? "#34D399" : "#FB7185") : undefined }}>
                        {delta != null ? (delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ─── Next Steps ─── */}
      <section className="report-page-bilingual">
        <div className="col-en">
          <h2 className="report-h2">{tr("en", "next_steps")}</h2>
          <p className="report-body">{tr("en", "next_steps_intro")}</p>
          <ul className="report-body">
            <li>{tr("en", "service_strategy")}</li>
            <li>{tr("en", "service_data")}</li>
            <li>{tr("en", "service_governance")}</li>
            <li>{tr("en", "service_talent")}</li>
            <li>{tr("en", "service_annual")}</li>
          </ul>
          <p className="report-body" style={{ marginTop: "16pt" }}>{tr("en", "next_steps_contact")}</p>
        </div>
        <div className="col-ar" dir="rtl">
          <h2 className="report-h2">{tr("ar", "next_steps")}</h2>
          <p className="report-body">{tr("ar", "next_steps_intro")}</p>
          <ul className="report-body">
            <li>{tr("ar", "service_strategy")}</li>
            <li>{tr("ar", "service_data")}</li>
            <li>{tr("ar", "service_governance")}</li>
            <li>{tr("ar", "service_talent")}</li>
            <li>{tr("ar", "service_annual")}</li>
          </ul>
          <p className="report-body" style={{ marginTop: "16pt" }}>{tr("ar", "next_steps_contact")}</p>
        </div>
      </section>

      {/* ─── Workforce AI Readiness (Mode C) ─── *
       * Renders only when this assessment opted into the individual
       * readiness layer AND at least one respondent has a four-factor
       * overall. Cohort-level rollup only - per-respondent breakdown
       * stays in the consultant portal, not the client-facing PDF. */}
      {p.includeIndividualLayer && p.workforceRollup && p.workforceRollup.respondents.some((r) => r.overall != null) && (
        <section className="report-page-bilingual">
          <div className="col-en">
            <h2 className="report-h2">Workforce AI Readiness</h2>
            <p className="report-body">
              Alongside the eight pillar scores, this assessment measured the
              personal AI readiness of {p.workforceRollup.cohort_size}{" "}
              respondent{p.workforceRollup.cohort_size === 1 ? "" : "s"}{" "}
              ({p.workforceRollup.completed_count} completed) across four VIFM
              individual readiness factors mapped to THINKING, RESULTS, PEOPLE
              and SELF.
              {p.assessmentTier === "deep_dive"
                ? " The deep-dive tier (12 items per factor) was used - research-grade reliability."
                : " The snapshot tier (6 items per factor) was used - directional reliability."}
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10pt" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #010131" }}>
                  <th style={biCellHead}>Factor</th>
                  <th style={biCellHeadRight}>Score / 5</th>
                  <th style={biCellHeadRight}>Respondents</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: "1px solid #e5e7eb", background: "#f8fafc" }}>
                  <td style={{ ...biCell, fontWeight: 700 }}>Cohort overall</td>
                  <td style={{ ...biCellRight, fontWeight: 700 }}>
                    {p.workforceRollup.cohort_overall != null ? p.workforceRollup.cohort_overall.toFixed(2) : "-"}
                  </td>
                  <td style={biCellRight}>{p.workforceRollup.completed_count}</td>
                </tr>
                {ARA_INDIVIDUAL_FACTORS.map((f) => {
                  const avg = p.workforceRollup!.factor_averages.find((x) => x.factor_id === f.id);
                  return (
                    <tr key={f.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={biCell}>
                        <span style={{ display: "inline-block", width: "8pt", height: "8pt", borderRadius: "4pt", background: f.color, marginRight: "6pt", verticalAlign: "middle" }} />
                        <strong>{f.name_en}</strong>{" "}
                        <span style={{ fontSize: "8pt", color: "#6b7280" }}>({f.domain})</span>
                      </td>
                      <td style={biCellRight}>{avg && avg.respondent_count > 0 ? avg.average.toFixed(2) : "-"}</td>
                      <td style={biCellRight}>{avg?.respondent_count ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="report-body report-muted" style={{ fontSize: "8.5pt", marginTop: "10pt" }}>
              4.0 and above - strong readiness; 3.0 to 3.9 - developing;
              below 3.0 - a priority for targeted training. The per-respondent
              breakdown stays in the consultant portal and is not included in
              this client-facing report by default.
            </p>
          </div>
          <div className="col-ar" dir="rtl">
            <h2 className="report-h2">الجاهزية الذكية للقوى العاملة</h2>
            <p className="report-body">
              إلى جانب درجات الركائز الثماني، قاس هذا التقييم الجاهزية الشخصية
              للذكاء الاصطناعي لدى {p.workforceRollup.cohort_size} مشارك
              ({p.workforceRollup.completed_count} مكتمل) عبر أربعة عوامل
              جاهزية فردية من VIFM مرتبطة بمجالات التفكير والنتائج والأشخاص
              والذات.
              {p.assessmentTier === "deep_dive"
                ? " استُخدم المستوى المعمّق (12 عنصراً لكل عامل) - موثوقية بحثية."
                : " استُخدم المستوى السريع (6 عناصر لكل عامل) - موثوقية توجيهية."}
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10pt" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #010131" }}>
                  <th style={{ ...biCellHead, textAlign: "right" }}>العامل</th>
                  <th style={{ ...biCellHead, textAlign: "right" }}>الدرجة / 5</th>
                  <th style={{ ...biCellHead, textAlign: "right" }}>المشاركون</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: "1px solid #e5e7eb", background: "#f8fafc" }}>
                  <td style={{ ...biCell, fontWeight: 700 }}>الإجمالي للمجموعة</td>
                  <td style={{ ...biCell, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {p.workforceRollup.cohort_overall != null ? p.workforceRollup.cohort_overall.toFixed(2) : "-"}
                  </td>
                  <td style={{ ...biCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.workforceRollup.completed_count}</td>
                </tr>
                {ARA_INDIVIDUAL_FACTORS.map((f) => {
                  const avg = p.workforceRollup!.factor_averages.find((x) => x.factor_id === f.id);
                  return (
                    <tr key={f.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ ...biCell, textAlign: "right" }}>
                        <strong>{f.name_ar}</strong>{" "}
                        <span style={{ fontSize: "8pt", color: "#6b7280" }}>({AR_DOMAIN[f.domain]})</span>
                        <span style={{ display: "inline-block", width: "8pt", height: "8pt", borderRadius: "4pt", background: f.color, marginInlineStart: "6pt", verticalAlign: "middle" }} />
                      </td>
                      <td style={{ ...biCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{avg && avg.respondent_count > 0 ? avg.average.toFixed(2) : "-"}</td>
                      <td style={{ ...biCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{avg?.respondent_count ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="report-body report-muted" style={{ fontSize: "8.5pt", marginTop: "10pt" }}>
              4.0 فأعلى - جاهزية قوية؛ 3.0 إلى 3.9 - قيد التطور؛ أقل من 3.0 -
              أولوية للتدريب الموجَّه. يبقى التفصيل لكل مشارك في بوابة الاستشاري
              ولا يُدرَج في هذا التقرير الموجَّه للعميل افتراضياً.
            </p>
          </div>
        </section>
      )}

      {/* ─── Agentic-AI Readiness ─── *
       * Renders only when this assessment opted into the agentic layer
       * AND at least one respondent has answered agentic-dimension items.
       * Cohort overall + per-dimension mean across the six dimensions. */}
      {p.includeAgenticLayer && p.agenticRollup && p.agenticRollup.respondents.some((r) => r.overall != null) && (
        <section className="report-page-bilingual">
          <div className="col-en">
            <h2 className="report-h2">Agentic-AI Readiness</h2>
            <p className="report-body">
              Beyond readiness to <em>use</em> AI, this assessment measured the
              organisation&apos;s readiness to safely <em>delegate</em> work to
              autonomous AI agents. {p.agenticRollup.completed_count}{" "}
              respondent{p.agenticRollup.completed_count === 1 ? "" : "s"}{" "}
              answered six governance dimensions that extend the Governance and
              Model Management pillars to the frontier of autonomous AI.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10pt" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #010131" }}>
                  <th style={biCellHead}>Dimension</th>
                  <th style={biCellHeadRight}>Score / 5</th>
                  <th style={biCellHeadRight}>Respondents</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: "1px solid #e5e7eb", background: "#f8fafc" }}>
                  <td style={{ ...biCell, fontWeight: 700 }}>Cohort overall</td>
                  <td style={{ ...biCellRight, fontWeight: 700 }}>
                    {p.agenticRollup.cohort_overall != null ? p.agenticRollup.cohort_overall.toFixed(2) : "-"}
                  </td>
                  <td style={biCellRight}>{p.agenticRollup.completed_count}</td>
                </tr>
                {ARA_AGENTIC_DIMENSIONS.map((d) => {
                  const avg = p.agenticRollup!.dimension_averages.find((x) => x.dimension_id === d.id);
                  return (
                    <tr key={d.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={biCell}>
                        <span style={{ display: "inline-block", width: "8pt", height: "8pt", borderRadius: "4pt", background: d.color, marginRight: "6pt", verticalAlign: "middle" }} />
                        <strong>{d.name_en}</strong>
                      </td>
                      <td style={biCellRight}>{avg && avg.respondent_count > 0 ? avg.average.toFixed(2) : "-"}</td>
                      <td style={biCellRight}>{avg?.respondent_count ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="report-body report-muted" style={{ fontSize: "8.5pt", marginTop: "10pt" }}>
              4.0 and above - mature controls; 3.0 to 3.9 - developing, tighten
              controls before widening autonomy; below 3.0 - a significant gap
              to close before granting agents autonomy in this area.
            </p>
          </div>
          <div className="col-ar" dir="rtl">
            <h2 className="report-h2">الجاهزية للذكاء الاصطناعي الوكيل</h2>
            <p className="report-body">
              إضافةً إلى الجاهزية لاستخدام الذكاء الاصطناعي، قاس هذا التقييم
              جاهزية المنظمة لتفويض العمل بأمان إلى وكلاء ذكاء اصطناعي مستقلين.
              أجاب {p.agenticRollup.completed_count} مشارك عن ست أبعاد حوكمة
              تمتدّ بركيزتَي الحوكمة وإدارة النماذج إلى حدود الذكاء الاصطناعي
              المستقل.
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "10pt" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #010131" }}>
                  <th style={{ ...biCellHead, textAlign: "right" }}>البُعد</th>
                  <th style={{ ...biCellHead, textAlign: "right" }}>الدرجة / 5</th>
                  <th style={{ ...biCellHead, textAlign: "right" }}>المشاركون</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: "1px solid #e5e7eb", background: "#f8fafc" }}>
                  <td style={{ ...biCell, fontWeight: 700 }}>الإجمالي للمجموعة</td>
                  <td style={{ ...biCell, textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {p.agenticRollup.cohort_overall != null ? p.agenticRollup.cohort_overall.toFixed(2) : "-"}
                  </td>
                  <td style={{ ...biCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{p.agenticRollup.completed_count}</td>
                </tr>
                {ARA_AGENTIC_DIMENSIONS.map((d) => {
                  const avg = p.agenticRollup!.dimension_averages.find((x) => x.dimension_id === d.id);
                  return (
                    <tr key={d.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                      <td style={{ ...biCell, textAlign: "right" }}>
                        <strong>{d.name_ar}</strong>
                        <span style={{ display: "inline-block", width: "8pt", height: "8pt", borderRadius: "4pt", background: d.color, marginInlineStart: "6pt", verticalAlign: "middle" }} />
                      </td>
                      <td style={{ ...biCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{avg && avg.respondent_count > 0 ? avg.average.toFixed(2) : "-"}</td>
                      <td style={{ ...biCell, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{avg?.respondent_count ?? 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="report-body report-muted" style={{ fontSize: "8.5pt", marginTop: "10pt" }}>
              4.0 فأعلى - ضوابط ناضجة؛ 3.0 إلى 3.9 - قيد التطور، عزّز الضوابط
              قبل توسيع الاستقلالية؛ أقل من 3.0 - فجوة كبيرة يجب معالجتها قبل
              منح الوكلاء استقلاليةً في هذا المجال.
            </p>
          </div>
        </section>
      )}

      {/* ─── Appendix ─── */}
      <section className="report-page-bilingual">
        <div className="col-en">
          <h2 className="report-h2">{tr("en", "appendix")}</h2>
          <h3 className="report-h3">{tr("en", "scoring_methodology")}</h3>
          <p className="report-body">{tr("en", "appendix_scoring")}</p>
          <h3 className="report-h3">{tr("en", "weights_used")}</h3>
          <ul className="report-body">
            {scopedPillars.map((pp) => (
              <li key={pp.id}>
                {pp.name_en} - {(p.pillarWeights?.[pp.id] ?? 12.5).toFixed(1)}%
              </li>
            ))}
          </ul>
          <h3 className="report-h3">{tr("en", "disclaimer")}</h3>
          <p className="report-body report-muted" style={{ fontSize: "9pt" }}>{tr("en", "appendix_disclaimer")}</p>
          <h3 className="report-h3">{tr("en", "retention_notice")}</h3>
          <p className="report-body report-muted" style={{ fontSize: "9pt" }}>{tr("en", "appendix_retention")}</p>
        </div>
        <div className="col-ar" dir="rtl">
          <h2 className="report-h2">{tr("ar", "appendix")}</h2>
          <h3 className="report-h3">{tr("ar", "scoring_methodology")}</h3>
          <p className="report-body">{tr("ar", "appendix_scoring")}</p>
          <h3 className="report-h3">{tr("ar", "weights_used")}</h3>
          <ul className="report-body">
            {scopedPillars.map((pp) => (
              <li key={pp.id}>
                {pp.name_ar} - {(p.pillarWeights?.[pp.id] ?? 12.5).toFixed(1)}%
              </li>
            ))}
          </ul>
          <h3 className="report-h3">{tr("ar", "disclaimer")}</h3>
          <p className="report-body report-muted" style={{ fontSize: "9pt" }}>{tr("ar", "appendix_disclaimer")}</p>
          <h3 className="report-h3">{tr("ar", "retention_notice")}</h3>
          <p className="report-body report-muted" style={{ fontSize: "9pt" }}>{tr("ar", "appendix_retention")}</p>
        </div>
      </section>
    </>
  );
}

/** Arabic labels for the four VIFM AC domains the individual factors map to. */
const AR_DOMAIN: Record<string, string> = {
  THINKING: "التفكير",
  RESULTS: "النتائج",
  PEOPLE: "الأشخاص",
  SELF: "الذات",
};

const ucCell: React.CSSProperties = { padding: "4pt 6pt", verticalAlign: "top", fontSize: "8.5pt" };
const ucHead: React.CSSProperties = { ...ucCell, fontWeight: 600, color: "#010131", fontSize: "9pt", textAlign: "left" };

const biCell: React.CSSProperties = { padding: "5pt 8pt", verticalAlign: "top", fontSize: "9pt" };
const biCellRight: React.CSSProperties = { ...biCell, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const biCellHead: React.CSSProperties = { ...biCell, fontWeight: 600, color: "#010131", fontSize: "9.5pt", textAlign: "left" };
const biCellHeadRight: React.CSSProperties = { ...biCellHead, textAlign: "right" };

function actionKeys(score: number | null): Array<"action_foundation" | "action_owner" | "action_benchmark" | "action_formalise" | "action_pilot" | "action_crossfunc" | "action_scale" | "action_close_gap" | "action_cadence" | "action_coe" | "action_mentor" | "action_annual"> {
  if (score == null || score < 2.0) return ["action_foundation", "action_owner", "action_benchmark"];
  if (score < 3.0) return ["action_formalise", "action_pilot", "action_crossfunc"];
  if (score < 4.0) return ["action_scale", "action_close_gap", "action_cadence"];
  return ["action_coe", "action_mentor", "action_annual"];
}

function arabicMaturityLabel(enLabel: string): string {
  const m = ARA_MATURITY_LEVELS.find((x) => x.label_en === enLabel);
  return m?.label_ar ?? enLabel;
}
