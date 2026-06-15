// Talent-acquisition lens on an AC result. The primary selection report: it
// states the competencies measured, the candidate's results, an explanation of
// each, a Fit Score, and a recommendation to pursue (or not) - decision support
// for the recruiter, never an automatic hire/no-hire.
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  C, sh, BARS, scoreColor, fitLabel, fitBand, fitColor, CoverHero, SectionHeader, Footer,
  CompetencyMatrix, buildDecisionPoints, DecisionReadout, ScoreDots, behaviourPrediction,
  type AudienceReportProps,
} from "./_audience-shared";

const AUDIENCE = "Talent Acquisition Report";
const TARGET = 3;

const t = StyleSheet.create({
  card: { marginBottom: 8, borderWidth: 0.5, borderColor: C.border, borderRadius: 4, borderLeftWidth: 3, padding: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  name: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.primary, flex: 1, paddingRight: 8 },
  pill: { paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 9 },
  pillText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  scoreTag: { fontSize: 6.5, color: C.textMuted, letterSpacing: 0.4, marginLeft: 8, textTransform: "uppercase" },
  explain: { fontSize: 8, lineHeight: 1.4, color: C.textLight, marginBottom: 4 },
  predict: { fontSize: 8.5, lineHeight: 1.45, color: C.text },
});

function fitText(rec: string | null): string {
  if (rec === "ready_now")
    return "Strong fit against the role profile - recommend advancing to the hiring manager.";
  if (rec === "not_ready")
    return "Limited fit against the role bar at this stage - recommend not pursuing for this role now. This is a screening signal, not an automatic reject.";
  return "Conditional fit - recommend pursuing, with a development plan attached for the flagged competencies.";
}

export function TalentAcquisitionReport({ data }: AudienceReportProps) {
  const comps = data.competencies;
  const atOrAbove = comps.filter((c) => (c.consensusScore ?? 0) >= TARGET);
  const below = comps.filter((c) => (c.consensusScore ?? 0) < TARGET);
  const pct = comps.length ? Math.round((atOrAbove.length / comps.length) * 100) : 0;
  const oar = data.overallScore;
  const rc = fitColor(data.recommendation);

  return (
    <Document title={`Talent Acquisition Report - ${data.candidateName}`} author="VIFM Behavioural Assessment">
      {/* Cover */}
      <Page size="A4" style={sh.cover}>
        <CoverHero
          eyebrow="Behavioural Psychometric · For Talent Acquisition"
          title="Talent Acquisition Report"
          subtitle={data.targetRole ? `Selection for ${data.targetRole}` : "Structured selection report"}
          candidateName={data.candidateName}
          audience={AUDIENCE}
          rows={[
            ["Organisation", data.organizationName],
            ["Target role", data.targetRole ?? "-"],
            ["Requisition", data.engagementName],
            ["Date completed", data.assessmentDates],
            ["Prepared", data.generatedAt],
          ]}
        />
      </Page>

      {/* Fit + results */}
      <Page size="A4" style={sh.page}>
        <SectionHeader eyebrow="Selection outcome" title="Fit score & result" />

        <View style={[sh.verdictBox, { borderLeftWidth: 3, borderLeftColor: rc, marginBottom: 10 }]}>
          <Text style={[sh.statLabel, { marginBottom: 4 }]}>Fit score &amp; recommendation</Text>
          <View style={sh.verdictTop}>
            <Text style={[sh.verdictNum, { color: rc }]}>{oar != null ? oar.toFixed(1) : "-"}</Text>
            <View>
              <Text style={[sh.verdictRec, { color: rc }]}>{fitLabel(data.recommendation)}</Text>
              <Text style={{ fontSize: 8.5, color: C.textLight, marginTop: 1 }}>{fitBand(data.recommendation)} · fit score out of 5</Text>
            </View>
          </View>
          <Text style={[sh.verdictText, { marginTop: 8 }]}>{fitText(data.recommendation)}</Text>
        </View>

        <View style={[sh.statStrip, { marginBottom: 10 }]}>
          <View style={sh.statTile}>
            <Text style={sh.statLabel}>Fit score</Text>
            <Text style={sh.statValue}>{oar != null ? oar.toFixed(1) : "-"}</Text>
            <Text style={sh.statSuffix}>of 5</Text>
          </View>
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
            <Text style={sh.statLabel}>Below bar</Text>
            <Text style={sh.statValue}>{below.length}</Text>
            <Text style={sh.statSuffix}>flagged</Text>
          </View>
        </View>

        <DecisionReadout points={buildDecisionPoints(comps, TARGET, oar, data.recommendation)} />

        <Text style={sh.eyebrow}>Results vs role bar (Competent, 3/5)</Text>
        <View style={{ marginBottom: 4 }}>
          <CompetencyMatrix competencies={comps} target={TARGET} />
        </View>

        <Footer name={data.candidateName} audience={AUDIENCE} />
      </Page>

      {/* Competencies measured + explanations */}
      <Page size="A4" style={sh.page}>
        <SectionHeader eyebrow="What was measured" title="Competencies, results & what each assesses" />
        <Text style={[sh.body, { marginBottom: 8 }]}>
          Each competency below maps to the role&apos;s success profile and was scored 1-5 by the VIFM online
          behavioural psychometric assessment. The bar for this role is Competent (3/5).
        </Text>
        {comps.map((c) => {
          const score = c.consensusScore ?? 0;
          const col = scoreColor(score);
          return (
            <View key={c.competencyName} wrap={false} style={[t.card, { borderLeftColor: col }]}>
              <View style={t.head}>
                <Text style={t.name}>{c.competencyName}</Text>
                <View style={[t.pill, { backgroundColor: col }]}>
                  <Text style={t.pillText}>{score}/5 · {BARS[score]}</Text>
                </View>
              </View>
              <View style={t.barRow}>
                <ScoreDots score={score} />
                <Text style={t.scoreTag}>{c.domainName} · {c.clusterName}</Text>
              </View>
              {c.explanation ? <Text style={t.explain}>{c.explanation}</Text> : null}
              <Text style={t.predict}>{behaviourPrediction(c)}</Text>
            </View>
          );
        })}
        <Footer name={data.candidateName} audience={AUDIENCE} />
      </Page>

      {/* Next steps + defensibility */}
      <Page size="A4" style={sh.page}>
        <SectionHeader eyebrow="Acting on this" title="Next steps & assurance" />

        <View wrap={false} style={[sh.panel, { borderLeftColor: C.accent }]}>
          <Text style={[sh.panelTitle, { color: C.accent }]}>Recommended next steps</Text>
          {[
            fitText(data.recommendation),
            below.length > 0
              ? `Attach a development note on ${below.map((c) => c.competencyName).join(", ")} so the hiring manager can weigh it and plan support.`
              : "No flags to attach - route straight to the hiring-manager shortlist.",
            "Release the candidate-facing results report to the applicant (results only) and the hiring-manager brief to the decision-maker.",
            "Log the structured result against the requisition for an auditable, like-for-like comparison across applicants.",
          ].map((x, i) => (
            <View key={i} style={sh.liRow}>
              <Text style={[sh.liGlyph, { color: C.accent }]}>{">"}</Text>
              <Text style={sh.liText}>{x}</Text>
            </View>
          ))}
        </View>

        <View wrap={false} style={[sh.panel, { borderLeftColor: C.positive, backgroundColor: C.positiveBg }]}>
          <Text style={[sh.panelTitle, { color: C.positive }]}>How this assessment works</Text>
          {[
            "Same assessment, same scoring: every applicant completes the identical online psychometric, removing interviewer bias.",
            "Job-relevant: every competency maps to the role's success profile, and the bar is set before the assessment.",
            "Consistent: the same competencies and 1-5 scale apply to every applicant for the role.",
            "Objective: responses are scored against a fixed competency framework, not a single rater's judgement.",
            "A fit signal, never an automatic decision: a person makes the hiring call.",
          ].map((x, i) => (
            <View key={i} style={sh.liRow}>
              <Text style={[sh.liGlyph, { color: C.positive }]}>+</Text>
              <Text style={sh.liText}>{x}</Text>
            </View>
          ))}
        </View>

        <View style={sh.note}>
          <Text style={sh.noteText}>
            Measured across {comps.length} behavioural competencies mapped to the role profile, via the VIFM online
            behavioural psychometric assessment. Fit score is the overall rating out of 5; the role bar is Competent
            (3/5); coverage is the share of competencies at or above the bar. Results are most relevant for the next
            ~24 months. For internal talent-acquisition use.
          </Text>
        </View>

        <Footer name={data.candidateName} audience={AUDIENCE} />
      </Page>
    </Document>
  );
}
