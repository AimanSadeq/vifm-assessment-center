import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { ARA_PILLARS, ARA_MATURITY_LEVELS, ARA_OVERALL_BANDS } from "@/lib/constants/ara-pillars";
import { summarizeComplianceByFramework } from "@/lib/ara/compliance";
import { detectAraShadowAi } from "@/lib/ara/detectors";
import { MaturityGauge } from "./_components/maturity-gauge";
import { RadarChart } from "./_components/radar-chart";
import { ComplianceSummary } from "./_components/compliance-summary";
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
  include_in_report: boolean;
};

export default async function AraReportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { bare?: string };
}) {
  const bare = searchParams?.bare === "1";
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
      .select("overall_score, overall_label_en, score_frozen_at")
      .eq("assessment_id", assessment.id)
      .maybeSingle<{
        overall_score: number | null;
        overall_label_en: string | null;
        score_frozen_at: string | null;
      }>(),
    sb
      .from("ara_consultant_notes")
      .select("pillar_id, note_text, include_in_report")
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

  const reportDate = new Date().toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

  const region = assessment.region === "uae" ? "United Arab Emirates" : "Saudi Arabia";
  const sectorLabel = assessment.sector.charAt(0).toUpperCase() + assessment.sector.slice(1);

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

      <div className={bare ? "" : "bg-gray-100 py-8"}>
        {/* ─── PAGE 1 — Cover ─── */}
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
              Confidential — {assessment.is_sandbox ? "Sample — Not for Client Distribution" : "For Internal VIFM Use"}
            </p>
            <h1 className="report-h1" style={{ color: "white", fontSize: "36pt", margin: "40pt 0 16pt" }}>
              {assessment.organization?.name ?? "Client"}
            </h1>
            <p className="text-lg" style={{ color: "white", opacity: 0.85 }}>
              AI Readiness Assessment Report
            </p>
            <p dir="rtl" className="text-lg" style={{ color: "white", opacity: 0.85, marginTop: 8 }}>
              تقرير تقييم الاستعداد للذكاء الاصطناعي
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

        {/* ─── PAGE 2 — Executive Summary ─── */}
        <section className="report-page">
          <h2 className="report-h2">Executive Summary</h2>
          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: "20pt", marginBottom: "16pt" }}>
            <div>
              <p className="report-muted uppercase" style={{ fontSize: "9pt", letterSpacing: "0.05em" }}>
                Overall AI Readiness
              </p>
              <p style={{ fontSize: "48pt", fontWeight: 600, color: "#010131", lineHeight: 1, margin: "4pt 0" }}>
                {overall != null ? overall.toFixed(2) : "—"}
                <span style={{ fontSize: "18pt", color: "#6b7280", fontWeight: 400 }}> / 5.00</span>
              </p>
              {overallLabel && (
                <p style={{ fontSize: "14pt", color: "#5391D5", fontWeight: 500, marginBottom: "12pt" }}>
                  {overallLabel}
                </p>
              )}
              <p className="report-body">
                This assessment benchmarks {assessment.organization?.name ?? "the organization"} across
                eight AI Readiness pillars. The overall score reflects a weighted aggregate of
                pillar-level maturity, calibrated against {region} regulatory frameworks.
              </p>
            </div>
            <div>
              <MaturityGauge score={overall} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16pt" }}>
            <div>
              <h3 className="report-h3" style={{ color: "#28A745" }}>Headline strengths</h3>
              {strengths.length === 0 ? (
                <p className="report-body report-muted">
                  No pillars currently scoring at Advanced or above.
                </p>
              ) : (
                <ul className="report-body">
                  {strengths.slice(0, 3).map((s) => (
                    <li key={s.pillar}>
                      <strong>{s.pillar}</strong> — {s.score.toFixed(2)} / 5.0
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="report-h3" style={{ color: "#DC3545" }}>Critical gaps</h3>
              {gaps.length === 0 ? (
                <p className="report-body report-muted">
                  No pillars scoring below Developing — solid foundation.
                </p>
              ) : (
                <ul className="report-body">
                  {gaps.slice(0, 3).map((g) => (
                    <li key={g.pillar}>
                      <strong>{g.pillar}</strong> — {g.score.toFixed(2)} / 5.0 ({g.gap > 0 ? "+" : ""}
                      {g.gap.toFixed(2)} vs AI Ready benchmark)
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* ─── PAGE 3 — How to Read This Report ─── */}
        <section className="report-page">
          <h2 className="report-h2">How to Read This Report</h2>
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
          <ul className="report-body">
            <li><strong style={{ color: "#28A745" }}>🟢 Compliant</strong> — fully meets the requirement.</li>
            <li><strong style={{ color: "#FFC107" }}>🟡 Partially Compliant</strong> — partial evidence; gaps remain.</li>
            <li><strong style={{ color: "#DC3545" }}>🔴 Action Required</strong> — requirement not met.</li>
            <li><strong className="report-muted">⚪ Needs Verification</strong> — evidence not yet provided.</li>
          </ul>
        </section>

        {/* ─── PAGE 4 — Organization Profile ─── */}
        <section className="report-page">
          <h2 className="report-h2">Organization Profile</h2>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20pt", marginBottom: "16pt" }}>
            <div>
              <h3 className="report-h3">Client details</h3>
              <table className="report-body" style={{ width: "100%" }}>
                <tbody>
                  <tr><td style={cellLabel}>Organization</td><td style={cell}>{assessment.organization?.name ?? "—"}</td></tr>
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
                  <tr><td style={cellLabel}>Question bank</td><td style={cell}>v{version?.version_number ?? "—"} {version?.version_label && `· ${version.version_label}`}</td></tr>
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
                  <td style={cell}>{r.role_label_en ?? "—"}</td>
                  <td style={cell}>
                    {(r.assignments ?? []).length === 0
                      ? "—"
                      : r.assignments.map((a: any) => ARA_PILLARS.find((p) => p.id === a.pillar_id)?.name_en ?? a.pillar_id).join(", ")}
                  </td>
                  <td style={cell}>{r.completed_at ? "Completed" : "In progress"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* ─── PAGE 5 — Radar Overview ─── */}
        <section className="report-page">
          <h2 className="report-h2">Pillar Overview</h2>
          <p className="report-body">
            The radar below plots current pillar scores against the <strong>AI Ready</strong>{" "}
            benchmark of 4.0 (dashed line). Pillars inside the dashed ring are below the
            benchmark and warrant focus.
          </p>
          <RadarChart pillarScores={scoreMap} size={440} />
        </section>

        {/* ─── PAGES 6–21 — Pillar Deep Dives (2 pages each) ─── */}
        {ARA_PILLARS.map((pillar) => {
          const row = pillarMap.get(pillar.id);
          const pillarNotes = notesByPillar.get(pillar.id) ?? [];

          return (
            <PillarPages
              key={pillar.id}
              pillarId={pillar.id}
              name={pillar.name_en}
              nameAr={pillar.name_ar}
              row={row}
              notes={pillarNotes}
            />
          );
        })}

        {/* ─── PAGE 22 — Strengths & Gaps ─── */}
        <section className="report-page">
          <h2 className="report-h2">Strengths &amp; Gaps Summary</h2>
          <h3 className="report-h3">Traffic-light grid</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8pt" }}>
            {ARA_PILLARS.map((p) => {
              const row = pillarMap.get(p.id);
              const s = row?.raw_score != null ? Number(row.raw_score) : null;
              const bg =
                s == null ? "#f3f4f6"
                : s >= 4.0 ? "#28A745"
                : s >= 3.0 ? "#FFC107"
                : "#DC3545";
              const fg = s == null ? "#6b7280" : "white";
              return (
                <div
                  key={p.id}
                  style={{ background: bg, color: fg, padding: "10pt", borderRadius: "6pt", fontSize: "9pt" }}
                >
                  <p style={{ fontWeight: 600, margin: 0 }}>{p.name_en}</p>
                  <p style={{ fontSize: "16pt", fontWeight: 600, margin: "4pt 0 0" }}>
                    {s != null ? s.toFixed(2) : "—"}
                  </p>
                  <p style={{ fontSize: "8pt", opacity: 0.9, margin: 0 }}>
                    {row?.maturity_label_en ?? "—"}
                  </p>
                </div>
              );
            })}
          </div>

          <h3 className="report-h3">Benchmark comparison</h3>
          <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={cellHead}>Pillar</th>
                <th style={cellHeadRight}>Current</th>
                <th style={cellHeadRight}>AI Ready</th>
                <th style={cellHeadRight}>GCC Best</th>
                <th style={cellHeadRight}>Gap</th>
              </tr>
            </thead>
            <tbody>
              {ARA_PILLARS.map((p) => {
                const row = pillarMap.get(p.id);
                const s = row?.raw_score != null ? Number(row.raw_score) : null;
                const gap = s != null ? Number((4.0 - s).toFixed(2)) : null;
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={cell}>{p.name_en}</td>
                    <td style={cellRight}>{s != null ? s.toFixed(2) : "—"}</td>
                    <td style={cellRight} className="report-muted">4.00</td>
                    <td style={cellRight} className="report-muted">4.50</td>
                    <td style={{ ...cellRight, color: gap != null && gap > 0 ? "#DC3545" : "#28A745" }}>
                      {gap != null ? (gap > 0 ? `+${gap.toFixed(2)}` : gap.toFixed(2)) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* ─── PAGE 23–24 — Roadmap (simplified — 3 horizons) ─── */}
        <section className="report-page">
          <h2 className="report-h2">AI Readiness Roadmap</h2>
          <p className="report-body">
            A phased 12-month roadmap translates findings into action across three horizons.
          </p>

          {[
            { horizon: "Quick Wins", timeframe: "0–3 months", color: "#00b4ff", items: gaps.slice(0, 2).map((g) => `Stabilise ${g.pillar} fundamentals`) },
            { horizon: "Build", timeframe: "3–9 months", color: "#5391D5", items: gaps.slice(0, 3).map((g) => `Institutionalise ${g.pillar} practices`) },
            { horizon: "Transform", timeframe: "9–12 months", color: "#010131", items: strengths.slice(0, 2).map((s) => `Scale ${s.pillar} leadership`) },
          ].map((h) => (
            <div key={h.horizon} style={{ borderLeft: `4pt solid ${h.color}`, paddingLeft: "10pt", marginBottom: "14pt" }}>
              <h3 className="report-h3" style={{ color: h.color, margin: "0 0 4pt" }}>
                {h.horizon} <span className="report-muted" style={{ fontWeight: 400 }}>· {h.timeframe}</span>
              </h3>
              {h.items.length === 0 ? (
                <p className="report-body report-muted">Refine in Phase 2 workshop.</p>
              ) : (
                <ul className="report-body">
                  {h.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>

        {/* ─── PAGE 25 — Regulatory Compliance ─── */}
        <section className="report-page">
          <h2 className="report-h2">Regulatory Compliance Summary</h2>
          <p className="report-body">
            Compliance status against frameworks applicable to {region}, {sectorLabel.toLowerCase()} sector.
            Each framework is scored as a weighted percentage of met + partial requirements.
          </p>

          <ComplianceSummary frameworks={complianceSummaries} />

          {shadowAi.triggered && (
            <div
              style={{
                marginTop: "16pt",
                padding: "12pt",
                background: "#fee2e2",
                border: "1pt solid #DC3545",
                borderRadius: "6pt",
              }}
            >
              <p style={{ fontWeight: 600, color: "#7f1d1d", margin: 0 }}>
                ⚠️ Shadow AI Alert
              </p>
              <p className="report-body" style={{ marginTop: "4pt" }}>
                Assessment responses indicate employees may be using public AI tools
                without formal organizational approval. This creates potential
                violations of data protection and cybersecurity regulations in {region}.
                Immediate action required.
              </p>
            </div>
          )}
        </section>

        {/* ─── PAGE 26 — Supporting Materials ─── */}
        {(materials ?? []).length > 0 && (
          <section className="report-page">
            <h2 className="report-h2">Supporting Materials</h2>
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
                    <td style={cell}>{m.respondent?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ─── PAGE 27 — Next Steps ─── */}
        <section className="report-page">
          <h2 className="report-h2">Next Steps with VIFM</h2>
          <p className="report-body">
            Virginia Institute of Finance and Management (VIFM) offers targeted
            services mapped to the gaps identified in this assessment:
          </p>
          <ul className="report-body">
            <li><strong>AI Strategy Workshop</strong> — co-design a 12-month AI roadmap aligned to your business goals.</li>
            <li><strong>Data Foundations Programme</strong> — data quality, governance, and sovereignty.</li>
            <li><strong>AI Governance Playbook</strong> — policy templates, acceptable-use frameworks, DPIAs tailored to {region}.</li>
            <li><strong>AI Talent Development</strong> — role-based learning paths for leaders, specialists, and all staff.</li>
            <li><strong>Annual Reassessment</strong> — track progress year-on-year against the same benchmark.</li>
          </ul>
          <p className="report-body" style={{ marginTop: "16pt" }}>
            To discuss engagement, contact your VIFM consultant or
            email <strong>contact@viftraining.com</strong>.
          </p>
        </section>

        {/* ─── APPENDIX ─── */}
        <section className="report-page">
          <h2 className="report-h2">Appendix</h2>

          <h3 className="report-h3">Scoring methodology</h3>
          <p className="report-body">
            Each pillar raw score is the average of answered questions on a 1–5 scale.
            Weighted pillar scores are raw × (pillar weight ÷ 100). The overall
            organizational score is the sum of all eight weighted pillar scores.
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
}: {
  pillarId: AraPillarId;
  name: string;
  nameAr: string;
  row: PillarScoreRow | undefined;
  notes: ConsultantNoteRow[];
}) {
  const score = row?.raw_score != null ? Number(row.raw_score) : null;
  const gap = row?.benchmark_gap != null ? Number(row.benchmark_gap) : null;
  const validated = row?.consultant_validated_score != null ? Number(row.consultant_validated_score) : null;
  const selfScore = row?.self_assessment_score != null ? Number(row.self_assessment_score) : null;
  const perceptionGap = row?.perception_gap != null ? Number(row.perception_gap) : null;

  return (
    <>
      {/* Findings */}
      <section className="report-page">
        <p className="report-muted uppercase" style={{ fontSize: "9pt", letterSpacing: "0.1em", margin: 0 }}>
          Pillar Deep Dive
        </p>
        <h2 className="report-h2">
          {name}
          <span className="report-muted" dir="rtl" style={{ fontSize: "12pt", fontWeight: 400, marginLeft: "12pt" }}>
            {nameAr}
          </span>
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20pt", marginBottom: "16pt" }}>
          <div>
            <p className="report-muted" style={{ fontSize: "9pt", margin: 0 }}>Raw score</p>
            <p style={{ fontSize: "36pt", fontWeight: 600, color: "#010131", margin: "2pt 0", lineHeight: 1 }}>
              {score != null ? score.toFixed(2) : "—"}
            </p>
            <p className="report-muted" style={{ fontSize: "10pt" }}>
              {row?.maturity_label_en ?? "Unscored"}
            </p>
            {gap != null && (
              <p className="report-body" style={{ marginTop: "8pt" }}>
                <strong>{gap > 0 ? `+${gap.toFixed(2)}` : gap.toFixed(2)}</strong> vs AI Ready benchmark (4.00)
              </p>
            )}
          </div>
          <div>
            <p className="report-muted" style={{ fontSize: "9pt", margin: "0 0 4pt" }}>
              Score vs benchmark
            </p>
            <div style={{ position: "relative", height: "20pt", background: "#f3f4f6", borderRadius: "4pt" }}>
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  height: "100%",
                  width: `${((score ?? 0) / 5) * 100}%`,
                  background: score != null && score >= 4.0 ? "#28A745" : score != null && score >= 3.0 ? "#FFC107" : "#DC3545",
                  borderRadius: "4pt",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "-2pt",
                  left: "80%",
                  height: "calc(100% + 4pt)",
                  borderLeft: "2pt dashed #374151",
                }}
              />
            </div>
            <div style={{ fontSize: "8pt", color: "#6b7280", marginTop: "2pt", textAlign: "right" }}>
              ↑ 4.0 benchmark
            </div>

            {validated != null && selfScore != null && (
              <div style={{ marginTop: "16pt" }}>
                <p className="report-muted" style={{ fontSize: "9pt", margin: "0 0 4pt" }}>
                  Perception vs Reality
                </p>
                <p className="report-body" style={{ margin: 0 }}>
                  Client rated <strong>{selfScore.toFixed(2)}</strong> · Consultant validated <strong>{validated.toFixed(2)}</strong> · Gap{" "}
                  <strong style={{ color: perceptionGap != null && perceptionGap > 0 ? "#DC3545" : "#28A745" }}>
                    {perceptionGap != null ? (perceptionGap > 0 ? `+${perceptionGap.toFixed(2)}` : perceptionGap.toFixed(2)) : "—"}
                  </strong>
                </p>
              </div>
            )}
          </div>
        </div>

        <h3 className="report-h3">Key findings</h3>
        {notes.length === 0 ? (
          <p className="report-body report-muted">
            Detailed findings will be added by the consultant during the Phase 2 workshop.
          </p>
        ) : (
          <ul className="report-body">
            {notes.map((n, i) => (
              <li key={i}>{n.note_text}</li>
            ))}
          </ul>
        )}
      </section>

      {/* Recommendations */}
      <section className="report-page">
        <p className="report-muted uppercase" style={{ fontSize: "9pt", letterSpacing: "0.1em", margin: 0 }}>
          Pillar Deep Dive · Recommendations
        </p>
        <h2 className="report-h2">{name}</h2>

        <p className="report-body">
          Targeted actions to elevate this pillar from its current level to the
          AI Ready benchmark.
        </p>

        <h3 className="report-h3">Suggested actions</h3>
        <ul className="report-body">
          {score == null || score < 2.0 ? (
            <>
              <li>Establish foundational understanding of {name.toLowerCase()} within leadership.</li>
              <li>Assign an accountable owner and allocate initial budget.</li>
              <li>Benchmark against peer organizations in {name.toLowerCase()}.</li>
            </>
          ) : score < 3.0 ? (
            <>
              <li>Formalise policies and processes covering {name.toLowerCase()}.</li>
              <li>Pilot one initiative with clear success metrics.</li>
              <li>Build cross-functional engagement across relevant teams.</li>
            </>
          ) : score < 4.0 ? (
            <>
              <li>Scale proven pilots into production.</li>
              <li>Close the gap to the AI Ready benchmark with targeted upskilling.</li>
              <li>Introduce measurement and review cadence.</li>
            </>
          ) : (
            <>
              <li>Share your practices internally as a centre of excellence.</li>
              <li>Mentor other pillars using the patterns that worked here.</li>
              <li>Continue annual benchmarking to retain leadership.</li>
            </>
          )}
        </ul>
      </section>
    </>
  );
}

const cell: React.CSSProperties = { padding: "5pt 8pt", verticalAlign: "top" };
const cellRight: React.CSSProperties = { ...cell, textAlign: "right", fontVariantNumeric: "tabular-nums" };
const cellLabel: React.CSSProperties = { ...cell, color: "#6b7280", fontWeight: 500, width: "40%" };
const cellHead: React.CSSProperties = { ...cell, fontWeight: 600, color: "#010131", fontSize: "10pt", textAlign: "left" };
const cellHeadRight: React.CSSProperties = { ...cellHead, textAlign: "right" };
