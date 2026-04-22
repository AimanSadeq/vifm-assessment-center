import { VifmLogo } from "@/components/shared/vifm-logo";
import { ARA_PILLARS, ARA_MATURITY_LEVELS, ARA_OVERALL_BANDS } from "@/lib/constants/ara-pillars";
import type { FrameworkComplianceSummary } from "@/lib/ara/compliance";
import type { AraPillarId } from "@/types/ara";
import { MaturityGauge } from "./maturity-gauge";
import { RadarChart } from "./radar-chart";
import { GapHeatmap } from "./gap-heatmap";
import { InvestmentMatrix } from "./investment-matrix";
import { GanttRoadmap } from "./gantt-roadmap";
import { ComplianceSummary } from "./compliance-summary";
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

type ConsultantNote = { pillar_id: string | null; note_text: string };

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

  return (
    <>
      {/* ─── Cover — already bilingual by design ─── */}
      <section
        className="report-page-bilingual-with-visual"
        style={{ background: "#010131", color: "white", gridTemplateRows: "auto 1fr auto" }}
      >
        <div><VifmLogo variant="white" size="md" /></div>
        <div style={{ textAlign: "center", alignSelf: "center" }}>
          <p style={{ fontSize: "9pt", opacity: 0.7, letterSpacing: "0.15em", margin: 0 }}>
            {p.isSandbox ? tr("en", "confidential_sample") : tr("en", "confidential_internal")}
          </p>
          <h1 style={{ fontSize: "42pt", fontWeight: 600, color: "white", margin: "30pt 0 16pt" }}>
            {p.organizationName}
          </h1>
          {p.organizationNameAr && (
            <p dir="rtl" style={{ fontSize: "24pt", color: "white", opacity: 0.9, margin: "0 0 20pt" }}>
              {p.organizationNameAr}
            </p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20pt", marginTop: "20pt" }}>
            <p style={{ color: "white", opacity: 0.85, fontSize: "14pt" }}>
              AI Readiness Assessment Report
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

      {/* ─── Executive Summary (visual span + bilingual text) ─── */}
      <section className="report-page-bilingual-with-visual">
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: "6mm" }}>
            <h2 className="report-h2" style={{ margin: 0 }}>{tr("en", "exec_summary")}</h2>
            <h2 className="report-h2" dir="rtl" style={{ margin: 0, textAlign: "right" }}>
              {tr("ar", "exec_summary")}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12mm", justifyContent: "center" }}>
            <div style={{ flex: "0 0 auto" }}>
              <MaturityGauge score={p.overall} />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "60pt", fontWeight: 600, color: "#010131", lineHeight: 1, margin: "0 0 4pt" }}>
                {p.overall != null ? p.overall.toFixed(2) : "—"}
                <span style={{ fontSize: "22pt", color: "#6b7280", fontWeight: 400 }}> / 5.00</span>
              </p>
              <p style={{ fontSize: "14pt", color: "#5391D5", fontWeight: 500 }}>
                {p.overallLabelEn ?? "—"}
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
            <h3 className="report-h3" style={{ color: "#28A745" }}>{tr("en", "headline_strengths")}</h3>
            {p.strengths.length === 0 ? (
              <p className="report-body report-muted">{tr("en", "no_strengths")}</p>
            ) : (
              <ul className="report-body">
                {p.strengths.slice(0, 3).map((s) => (
                  <li key={s.pillar}><strong>{s.pillar}</strong> — {s.score.toFixed(2)}</li>
                ))}
              </ul>
            )}
            <h3 className="report-h3" style={{ color: "#DC3545" }}>{tr("en", "critical_gaps")}</h3>
            {p.gaps.length === 0 ? (
              <p className="report-body report-muted">{tr("en", "no_gaps")}</p>
            ) : (
              <ul className="report-body">
                {p.gaps.slice(0, 3).map((g) => (
                  <li key={g.pillar}><strong>{g.pillar}</strong> — {g.score.toFixed(2)}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="col-ar" dir="rtl">
            <p className="report-body">{tr("ar", "exec_intro")}</p>
            <h3 className="report-h3" style={{ color: "#28A745" }}>{tr("ar", "headline_strengths")}</h3>
            {p.strengths.length === 0 ? (
              <p className="report-body report-muted">{tr("ar", "no_strengths")}</p>
            ) : (
              <ul className="report-body">
                {p.strengths.slice(0, 3).map((s) => {
                  const pillar = ARA_PILLARS.find((pp) => pp.name_en === s.pillar);
                  return (
                    <li key={s.pillar}><strong>{pillar?.name_ar ?? s.pillar}</strong> — {s.score.toFixed(2)}</li>
                  );
                })}
              </ul>
            )}
            <h3 className="report-h3" style={{ color: "#DC3545" }}>{tr("ar", "critical_gaps")}</h3>
            {p.gaps.length === 0 ? (
              <p className="report-body report-muted">{tr("ar", "no_gaps")}</p>
            ) : (
              <ul className="report-body">
                {p.gaps.slice(0, 3).map((g) => {
                  const pillar = ARA_PILLARS.find((pp) => pp.name_en === g.pillar);
                  return (
                    <li key={g.pillar}><strong>{pillar?.name_ar ?? g.pillar}</strong> — {g.score.toFixed(2)}</li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ─── How to Read — pure text side-by-side ─── */}
      <section className="report-page-bilingual">
        <div className="col-en">
          <h2 className="report-h2">{tr("en", "how_to_read")}</h2>
          <p className="report-body">{tr("en", "how_to_read_intro")}</p>
          <h3 className="report-h3">{tr("en", "maturity_scale")}</h3>
          <ul className="report-body">
            {ARA_MATURITY_LEVELS.map((m) => (
              <li key={m.level}>
                <strong>L{m.level} {m.label_en}</strong> ({m.min.toFixed(1)}–{m.max.toFixed(1)}) — {tr("en", `maturity_l${m.level}` as any)}
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
                <strong>المستوى {m.level} — {m.label_ar}</strong> ({m.min.toFixed(1)}–{m.max.toFixed(1)}) — {tr("ar", `maturity_l${m.level}` as any)}
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

      {/* ─── Radar Overview ─── */}
      <section className="report-page-bilingual-with-visual">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginBottom: "6mm" }}>
          <h2 className="report-h2" style={{ margin: 0 }}>{tr("en", "pillar_overview")}</h2>
          <h2 className="report-h2" dir="rtl" style={{ margin: 0, textAlign: "right" }}>
            {tr("ar", "pillar_overview")}
          </h2>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <RadarChart pillarScores={p.scoreMap} size={400} />
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

      {/* ─── Pillar Deep Dives — one page per pillar ─── */}
      {ARA_PILLARS.map((pillar) => {
        const row = p.pillarMap.get(pillar.id);
        const pillarNotes = p.notesByPillar.get(pillar.id) ?? [];
        const score = row?.raw_score != null ? Number(row.raw_score) : null;
        const actions = actionKeys(score);
        return (
          <section key={pillar.id} className="report-page-bilingual">
            <div className="col-en">
              <p className="report-muted" style={{ fontSize: "9pt", letterSpacing: "0.1em", margin: 0, textTransform: "uppercase" }}>
                {tr("en", "pillar_deep_dive")}
              </p>
              <h2 className="report-h2">{pillar.name_en}</h2>
              <p className="report-body">
                <strong style={{ fontSize: "28pt", color: "#010131" }}>
                  {score != null ? score.toFixed(2) : "—"}
                </strong>
                <span className="report-muted" style={{ marginLeft: "8pt" }}>
                  {row?.maturity_label_en ?? "Unscored"}
                </span>
              </p>
              <h3 className="report-h3">{tr("en", "key_findings")}</h3>
              {pillarNotes.length === 0 ? (
                <p className="report-body report-muted">{tr("en", "findings_pending")}</p>
              ) : (
                <ul className="report-body">
                  {pillarNotes.map((n, i) => <li key={i}>{n.note_text}</li>)}
                </ul>
              )}
              <h3 className="report-h3">{tr("en", "suggested_actions")}</h3>
              <ul className="report-body">
                {actions.map((k) => <li key={k}>{tr("en", k)}</li>)}
              </ul>
            </div>
            <div className="col-ar" dir="rtl">
              <p className="report-muted" style={{ fontSize: "9pt", letterSpacing: "0.1em", margin: 0, textTransform: "uppercase" }}>
                {tr("ar", "pillar_deep_dive")}
              </p>
              <h2 className="report-h2">{pillar.name_ar}</h2>
              <p className="report-body">
                <strong style={{ fontSize: "28pt", color: "#010131" }}>
                  {score != null ? score.toFixed(2) : "—"}
                </strong>
                <span className="report-muted" style={{ marginRight: "8pt" }}>
                  {row?.maturity_label_en ? arabicMaturityLabel(row.maturity_label_en) : "غير مُقيَّم"}
                </span>
              </p>
              <h3 className="report-h3">{tr("ar", "key_findings")}</h3>
              {pillarNotes.length === 0 ? (
                <p className="report-body report-muted">{tr("ar", "findings_pending")}</p>
              ) : (
                <ul className="report-body">
                  {pillarNotes.map((n, i) => <li key={i}>{n.note_text}</li>)}
                </ul>
              )}
              <h3 className="report-h3">{tr("ar", "suggested_actions")}</h3>
              <ul className="report-body">
                {actions.map((k) => <li key={k}>{tr("ar", k)}</li>)}
              </ul>
            </div>
          </section>
        );
      })}

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

      {/* ─── Investment Matrix ─── */}
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

      {/* ─── Gantt Roadmap ─── */}
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
              <div style={{ padding: "8pt", background: "#fee2e2", border: "1pt solid #DC3545", borderRadius: "4pt", marginTop: "6pt" }}>
                <p style={{ fontWeight: 600, color: "#7f1d1d", margin: 0, fontSize: "10pt" }}>⚠️ {tr("en", "shadow_ai_alert")}</p>
                <p className="report-body" style={{ margin: "4pt 0 0", fontSize: "9.5pt" }}>{tr("en", "shadow_ai_body")}</p>
              </div>
            )}
          </div>
          <div className="col-ar" dir="rtl">
            <p className="report-body">{tr("ar", "compliance_intro")}</p>
            {p.shadowAiTriggered && (
              <div style={{ padding: "8pt", background: "#fee2e2", border: "1pt solid #DC3545", borderRadius: "4pt", marginTop: "6pt" }}>
                <p style={{ fontWeight: 600, color: "#7f1d1d", margin: 0, fontSize: "10pt" }}>⚠️ {tr("ar", "shadow_ai_alert")}</p>
                <p className="report-body" style={{ margin: "4pt 0 0", fontSize: "9.5pt" }}>{tr("ar", "shadow_ai_body")}</p>
              </div>
            )}
          </div>
        </div>
      </section>

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

      {/* ─── Appendix ─── */}
      <section className="report-page-bilingual">
        <div className="col-en">
          <h2 className="report-h2">{tr("en", "appendix")}</h2>
          <h3 className="report-h3">{tr("en", "scoring_methodology")}</h3>
          <p className="report-body">{tr("en", "appendix_scoring")}</p>
          <h3 className="report-h3">{tr("en", "weights_used")}</h3>
          <ul className="report-body">
            {ARA_PILLARS.map((pp) => (
              <li key={pp.id}>
                {pp.name_en} — {(p.pillarWeights?.[pp.id] ?? 12.5).toFixed(1)}%
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
            {ARA_PILLARS.map((pp) => (
              <li key={pp.id}>
                {pp.name_ar} — {(p.pillarWeights?.[pp.id] ?? 12.5).toFixed(1)}%
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
