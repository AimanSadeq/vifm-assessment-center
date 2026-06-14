// Talent-acquisition lens on an AC result. Same data as the candidate report,
// re-framed for screening + pipeline: outcome signal, competency coverage vs the
// role bar, next steps in the funnel, and a defensibility note for the file.
import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  C, sh, recLabel, recColor, CoverHero, SectionHeader, Footer,
  CompetencyMatrix, type AudienceReportProps,
} from "./_audience-shared";

const AUDIENCE = "Talent Acquisition Summary";
const TARGET = 3;

function pipelineSignal(rec: string | null): { label: string; color: string; text: string } {
  if (rec === "ready_now")
    return { label: "Advance", color: C.positive, text: "Meets or exceeds the role bar across the profile - advance to hiring-manager review / offer stage." };
  if (rec === "not_ready")
    return { label: "Hold", color: C.negative, text: "Falls below the role bar on key competencies - hold pending hiring-manager review or re-assessment. Not an automatic reject." };
  return { label: "Advance with note", color: C.warning, text: "Meets the bar overall with specific development areas - advance to hiring-manager review with the development note attached." };
}

export function TalentAcquisitionReport({ data }: AudienceReportProps) {
  const comps = data.competencies;
  const atOrAbove = comps.filter((c) => (c.consensusScore ?? 0) >= TARGET);
  const below = comps.filter((c) => (c.consensusScore ?? 0) < TARGET);
  const strengths = comps.filter((c) => (c.consensusScore ?? 0) >= 4);
  const pct = comps.length ? Math.round((atOrAbove.length / comps.length) * 100) : 0;
  const sig = pipelineSignal(data.recommendation);

  return (
    <Document
      title={`Talent Acquisition Summary - ${data.candidateName}`}
      author="VIFM Assessment Center"
    >
      {/* Cover */}
      <Page size="A4" style={sh.cover}>
        <CoverHero
          eyebrow="Assessment Center · For Talent Acquisition"
          title="Screening Summary"
          subtitle={data.targetRole ? `Pipeline for ${data.targetRole}` : "Structured screening outcome"}
          candidateName={data.candidateName}
          audience={AUDIENCE}
          rows={[
            ["Organisation", data.organizationName],
            ["Target role", data.targetRole ?? "-"],
            ["Requisition", data.engagementName],
            ["Assessment dates", data.assessmentDates],
            ["Prepared", data.generatedAt],
          ]}
        />
      </Page>

      {/* Screening summary */}
      <Page size="A4" style={sh.page}>
        <SectionHeader eyebrow="Screening outcome" title="Where this candidate sits" />

        <View style={[sh.verdictBox, { borderLeftWidth: 3, borderLeftColor: sig.color }]}>
          <View style={sh.verdictTop}>
            <Text style={[sh.verdictRec, { color: sig.color, fontSize: 15 }]}>{sig.label}</Text>
            <Text style={{ fontSize: 11, color: C.textLight, marginLeft: 10 }}>
              {recLabel(data.recommendation)} · {data.overallScore != null ? data.overallScore.toFixed(1) : "-"}/5
            </Text>
          </View>
          <Text style={sh.verdictText}>{sig.text}</Text>
        </View>

        <View style={sh.statStrip}>
          <View style={sh.statTile}>
            <Text style={sh.statLabel}>Coverage</Text>
            <Text style={sh.statValue}>{pct}%</Text>
            <Text style={sh.statSuffix}>at / above bar</Text>
          </View>
          <View style={sh.statTile}>
            <Text style={sh.statLabel}>Met</Text>
            <Text style={sh.statValue}>{atOrAbove.length}</Text>
            <Text style={sh.statSuffix}>of {comps.length}</Text>
          </View>
          <View style={sh.statTile}>
            <Text style={sh.statLabel}>Gaps</Text>
            <Text style={sh.statValue}>{below.length}</Text>
            <Text style={sh.statSuffix}>below bar</Text>
          </View>
          <View style={sh.statTile}>
            <Text style={sh.statLabel}>Overall</Text>
            <Text style={sh.statValue}>{data.overallScore != null ? data.overallScore.toFixed(1) : "-"}</Text>
            <Text style={sh.statSuffix}>of 5</Text>
          </View>
        </View>

        <Text style={sh.eyebrow}>Competency coverage vs role bar (Competent, 3/5)</Text>
        <View style={{ marginBottom: 12 }}>
          <CompetencyMatrix competencies={comps} target={TARGET} />
        </View>

        {strengths.length > 0 && (
          <>
            <Text style={[sh.eyebrow, { marginTop: 6 }]}>Selling points (strengths to highlight)</Text>
            <View style={sh.chipRow}>
              {strengths.map((c) => (
                <View key={c.competencyName} style={[sh.chip, { backgroundColor: C.positiveBg, borderColor: C.positive }]}>
                  <Text style={[sh.chipText, { color: C.positive }]}>{c.competencyName}</Text>
                </View>
              ))}
            </View>
          </>
        )}
        {below.length > 0 && (
          <>
            <Text style={[sh.eyebrow, { marginTop: 6 }]}>Flags to raise with the hiring manager</Text>
            <View style={sh.chipRow}>
              {below.map((c) => (
                <View key={c.competencyName} style={[sh.chip, { backgroundColor: C.warningBg, borderColor: C.warning }]}>
                  <Text style={[sh.chipText, { color: C.warning }]}>{c.competencyName} ({c.consensusScore}/5)</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Footer name={data.candidateName} audience={AUDIENCE} />
      </Page>

      {/* Next steps + defensibility */}
      <Page size="A4" style={sh.page}>
        <SectionHeader eyebrow="Acting on this" title="Next steps & defensibility" />

        <View wrap={false} style={[sh.panel, { borderLeftColor: C.accent }]}>
          <Text style={[sh.panelTitle, { color: C.accent }]}>Recommended next steps</Text>
          {[
            `${sig.label === "Hold" ? "Hold in pipeline" : "Advance"}: ${sig.text}`,
            below.length > 0
              ? `Attach the development note on ${below.map((c) => c.competencyName).join(", ")} so the hiring manager can plan onboarding support.`
              : "No development flags - route straight to the hiring-manager shortlist.",
            "Share the candidate-facing report with the applicant (development view) and the hiring-manager brief with the decision-maker.",
            "Log the structured result against the requisition for an auditable, like-for-like comparison across applicants.",
          ].map((t, i) => (
            <View style={sh.liRow} key={i}>
              <Text style={[sh.liGlyph, { color: C.accent }]}>{">"}</Text>
              <Text style={sh.liText}>{t}</Text>
            </View>
          ))}
        </View>

        <View wrap={false} style={[sh.panel, { borderLeftColor: C.positive, backgroundColor: C.positiveBg }]}>
          <Text style={[sh.panelTitle, { color: C.positive }]}>Why this is defensible</Text>
          {[
            "Behaviour-based: scores come from observed behaviour across multiple exercises, not a single interview impression.",
            "Job-relevant: every competency maps to the role's success profile; the bar is set before assessment.",
            "Consistent: the same competencies, exercises, and rating scale apply to every applicant for the role.",
            "Multi-rater: ratings are reconciled in an assessor wash-up, reducing single-rater bias.",
            "A screening signal, never an auto-reject: a human makes the hiring decision.",
          ].map((t, i) => (
            <View style={sh.liRow} key={i}>
              <Text style={[sh.liGlyph, { color: C.positive }]}>+</Text>
              <Text style={sh.liText}>{t}</Text>
            </View>
          ))}
        </View>

        <View style={sh.note}>
          <Text style={sh.noteText}>
            Assessed across {data.exercisesUsed.length} exercises ({data.exercisesUsed.map((e) => e.name).join(", ")}).
            Role bar = Competent (3/5). Coverage = share of assessed competencies at or above the bar. Results are most
            relevant for the next ~24 months. This summary is for internal talent-acquisition use; share externally only
            with the candidate's awareness.
          </Text>
        </View>

        <Footer name={data.candidateName} audience={AUDIENCE} />
      </Page>
    </Document>
  );
}
