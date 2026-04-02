import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ReportData } from "./report-types";

const BARS: Record<number, string> = {
  1: "Significant Development Needed", 2: "Development Needed",
  3: "Competent", 4: "Strength", 5: "Significant Strength",
};
const OAR_LABELS: Record<string, string> = {
  ready_now: "Ready Now", ready_with_development: "Ready with Development", not_ready: "Not Ready",
};
const EXERCISE_LABELS: Record<string, string> = {
  in_basket: "In-Basket / E-Tray", role_play: "Role Play", group_exercise: "Group Exercise",
  case_study: "Case Study", oral_presentation: "Oral Presentation", competency_based_interview: "CBI",
};

const C = {
  primary: "#010131", accent: "#5391D5", gold: "#c4a35a",
  text: "#333333", textLight: "#666666", bg: "#ffffff", bgLight: "#f4f6f8",
  border: "#dde1e6", positive: "#16a34a", negative: "#dc2626",
  bar1: "#dc2626", bar2: "#f97316", bar3: "#5391D5", bar4: "#22c55e", bar5: "#15803d",
};

const s = StyleSheet.create({
  page: { paddingTop: 50, paddingBottom: 50, paddingHorizontal: 50, fontFamily: "Helvetica", fontSize: 10, color: C.text },
  coverPage: { paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0, fontFamily: "Helvetica" },
  coverBanner: { backgroundColor: C.primary, paddingTop: 100, paddingBottom: 70, paddingHorizontal: 60 },
  coverConfidential: { fontSize: 8, color: C.accent, letterSpacing: 3, marginBottom: 30 },
  coverTitle: { fontSize: 28, color: "#ffffff", fontFamily: "Helvetica-Bold", marginBottom: 6 },
  coverSubtitle: { fontSize: 14, color: C.accent, marginBottom: 4 },
  coverMeta: { fontSize: 10, color: "#aaaaaa", marginTop: 16 },
  coverDetails: { paddingHorizontal: 60, paddingTop: 36 },
  coverRow: { flexDirection: "row", marginBottom: 6 },
  coverLabel: { width: 130, fontSize: 10, color: C.textLight },
  coverValue: { fontSize: 10, color: C.text, fontFamily: "Helvetica-Bold" },
  coverFooter: { position: "absolute", bottom: 36, left: 60, right: 60, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 10 },
  coverFooterText: { fontSize: 7, color: C.textLight, textAlign: "center" },
  section: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 10, paddingBottom: 5, borderBottomWidth: 2, borderBottomColor: C.accent },
  subSection: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 6, marginTop: 12 },
  bodyText: { fontSize: 9.5, lineHeight: 1.6, color: C.text, marginBottom: 8 },
  // OAR
  oarBox: { backgroundColor: C.bgLight, borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 14, marginBottom: 16 },
  oarRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  oarNum: { fontSize: 32, fontFamily: "Helvetica-Bold", color: C.primary, marginRight: 10 },
  oarLabel: { fontSize: 12, color: C.textLight },
  oarRec: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.accent, marginBottom: 6 },
  // Score bar
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  barName: { fontSize: 9, width: 140 },
  barTrack: { flex: 1, height: 7, backgroundColor: "#e5e7eb", borderRadius: 3, marginRight: 6 },
  barFill: { height: 7, borderRadius: 3 },
  barLabel: { fontSize: 8, color: C.textLight, width: 50 },
  // Competency card
  compCard: { marginBottom: 14, borderWidth: 1, borderColor: C.border, borderRadius: 4 },
  compHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.bgLight, paddingHorizontal: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: C.border },
  compName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.primary },
  compCluster: { fontSize: 7, color: C.textLight },
  compBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  compBadgeText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  compBody: { padding: 10 },
  // Evidence
  evTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 3 },
  evItem: { flexDirection: "row", marginBottom: 2, paddingLeft: 6 },
  evBullet: { width: 10, fontSize: 8 },
  evExercise: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.accent, marginRight: 4 },
  evText: { flex: 1, fontSize: 8.5, lineHeight: 1.4, color: C.text },
  // Exercise rating row
  exRatRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: "#f0f0f0" },
  exRatName: { fontSize: 8.5, color: C.text },
  exRatScore: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  // Dev tips
  devTip: { fontSize: 8.5, lineHeight: 1.4, color: C.text, marginBottom: 3, paddingLeft: 8 },
  // Summary badges
  summaryRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 4 },
  summaryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginRight: 4, marginBottom: 4 },
  summaryBadgeText: { fontSize: 8, fontFamily: "Helvetica-Bold" },
  // Footer
  footer: { position: "absolute", bottom: 26, left: 50, right: 50, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6 },
  footerText: { fontSize: 7, color: C.textLight },
  confidential: { fontSize: 7, color: C.negative, fontFamily: "Helvetica-Bold" },
});

function scoreColor(n: number): string {
  return [, C.bar1, C.bar2, C.bar3, C.bar4, C.bar5][n] ?? C.bar3;
}

function Footer({ name }: { name: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.confidential}>STRICTLY CONFIDENTIAL</Text>
      <Text style={s.footerText}>{name} — VIFM Assessment Center Report</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function CoverPage({ d }: { d: ReportData }) {
  return (
    <Page size="A4" style={s.coverPage}>
      <View style={s.coverBanner}>
        <Text style={s.coverConfidential}>STRICTLY CONFIDENTIAL</Text>
        <Text style={s.coverSubtitle}>VIFM Assessment Center</Text>
        <Text style={s.coverTitle}>Talent Assessment Report</Text>
        <Text style={s.coverMeta}>{d.candidateName}</Text>
      </View>
      <View style={s.coverDetails}>
        {[
          ["Assessment", d.engagementName],
          ["Organization", d.organizationName],
          ...(d.targetRole ? [["Target Role", d.targetRole]] : []),
          ["Assessment Dates", d.assessmentDates],
          ["Assessors", d.assessorNames.join(", ") || "—"],
          ["Report Generated", d.generatedAt],
        ].map(([label, value]) => (
          <View key={label as string} style={s.coverRow}>
            <Text style={s.coverLabel}>{label as string}</Text>
            <Text style={s.coverValue}>{value as string}</Text>
          </View>
        ))}
      </View>
      <View style={s.coverFooter}>
        <Text style={s.coverFooterText}>Virginia Institute of Finance and Management — Confidential Assessment Report</Text>
      </View>
    </Page>
  );
}

function AboutPage({ d }: { d: ReportData }) {
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.section}>About the Assessment Centre</Text>
      <Text style={s.bodyText}>
        {d.candidateName} took part in a VIFM Talent Assessment Centre as part of the {d.engagementName} engagement. This report summarises the results of the assessment.
      </Text>
      <Text style={s.bodyText}>
        Assessment Centres consist of a number of different activities and exercises providing participants with a range of opportunities to demonstrate their competence. Participants are observed by trained assessors who collect behavioural evidence related to the relevant competencies.
      </Text>

      {d.exercisesUsed.length > 0 && (
        <>
          <Text style={s.subSection}>Exercises Completed</Text>
          {d.exercisesUsed.map((ex) => (
            <Text key={ex.name} style={s.bodyText}>
              • {ex.name} ({EXERCISE_LABELS[ex.type] ?? ex.type}{ex.durationMinutes ? `, ${ex.durationMinutes} minutes` : ""})
            </Text>
          ))}
        </>
      )}

      <Text style={s.subSection}>How to Use This Report</Text>
      <Text style={s.bodyText}>
        For each competency, {d.candidateName} was rated on a 1 to 5 scale:
      </Text>
      {[5, 4, 3, 2, 1].map((n) => (
        <Text key={n} style={[s.bodyText, { paddingLeft: 12, marginBottom: 2 }]}>
          {n} — {BARS[n]}
        </Text>
      ))}
      <Text style={[s.bodyText, { marginTop: 6 }]}>
        The overall competency rating is not necessarily an average of the scores from the exercises — some activities are rated more heavily than others based on the competency-to-exercise matrix.
      </Text>
      <Text style={s.bodyText}>
        This report provides information around the participant's strengths and development areas in relation to skills and behaviours important for the target role. You may regard this report as being particularly relevant for the next 24 months.
      </Text>
      <Footer name={d.candidateName} />
    </Page>
  );
}

function SummaryPage({ d }: { d: ReportData }) {
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.section}>Summary of Performance</Text>

      {/* OAR */}
      <View style={s.oarBox}>
        {d.overallScore ? (
          <>
            <View style={s.oarRow}>
              <Text style={s.oarNum}>{d.overallScore}/5</Text>
              <Text style={s.oarLabel}>{BARS[d.overallScore] ?? ""}</Text>
            </View>
            {d.recommendation && <Text style={s.oarRec}>Recommendation: {OAR_LABELS[d.recommendation] ?? d.recommendation}</Text>}
            {d.executiveSummary && <Text style={[s.bodyText, { marginTop: 4 }]}>{d.executiveSummary}</Text>}
          </>
        ) : (
          <Text style={{ fontSize: 10, color: C.textLight }}>Overall Assessment Rating not yet finalized.</Text>
        )}
      </View>

      {/* Competency score bars */}
      <Text style={s.subSection}>Competency Ratings</Text>
      {d.competencies.map((c) => (
        <View key={c.competencyName} style={s.barRow}>
          <Text style={s.barName}>{c.competencyName}</Text>
          <View style={s.barTrack}>
            {c.consensusScore ? <View style={[s.barFill, { width: `${(c.consensusScore / 5) * 100}%`, backgroundColor: scoreColor(c.consensusScore) }]} /> : null}
          </View>
          <Text style={s.barLabel}>{c.consensusScore ? `${c.consensusScore}/5` : "Pending"}</Text>
        </View>
      ))}

      {/* Top strengths / development */}
      {d.topStrengths.length > 0 && (
        <>
          <Text style={[s.subSection, { color: C.positive }]}>Key Strengths</Text>
          <View style={s.summaryRow}>
            {d.topStrengths.map((name) => (
              <View key={name} style={[s.summaryBadge, { backgroundColor: "#dcfce7" }]}>
                <Text style={[s.summaryBadgeText, { color: C.positive }]}>{name}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      {d.topDevelopmentAreas.length > 0 && (
        <>
          <Text style={[s.subSection, { color: C.bar2 }]}>Key Development Areas</Text>
          <View style={s.summaryRow}>
            {d.topDevelopmentAreas.map((name) => (
              <View key={name} style={[s.summaryBadge, { backgroundColor: "#fef3c7" }]}>
                <Text style={[s.summaryBadgeText, { color: C.bar2 }]}>{name}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      <Footer name={d.candidateName} />
    </Page>
  );
}

function CompetencyPages({ d }: { d: ReportData }) {
  return (
    <Page size="A4" style={s.page} wrap>
      <Text style={s.section}>Competency Detail</Text>
      {d.competencies.map((c) => (
        <View key={c.competencyName} style={s.compCard} wrap={false}>
          <View style={s.compHead}>
            <View>
              <Text style={s.compName}>{c.competencyName}</Text>
              <Text style={s.compCluster}>{c.domainName} — {c.clusterName}{c.weight ? ` (Weight: ${c.weight})` : ""}</Text>
            </View>
            {c.consensusScore ? (
              <View style={[s.compBadge, { backgroundColor: scoreColor(c.consensusScore) }]}>
                <Text style={s.compBadgeText}>{c.consensusScore}/5</Text>
              </View>
            ) : null}
          </View>
          <View style={s.compBody}>
            {/* Exercise ratings */}
            {c.exerciseRatings.length > 0 && (
              <>
                <Text style={s.evTitle}>Exercise Ratings</Text>
                {c.exerciseRatings.map((er) => (
                  <View key={er.exerciseName} style={s.exRatRow}>
                    <Text style={s.exRatName}>{er.exerciseName}</Text>
                    <Text style={[s.exRatScore, { color: scoreColor(er.score) }]}>{er.score}/5 — {BARS[er.score]}</Text>
                  </View>
                ))}
              </>
            )}

            {/* Strengths */}
            {c.strengths.length > 0 && (
              <>
                <Text style={[s.evTitle, { color: C.positive }]}>Strengths</Text>
                {c.strengths.map((ev, i) => (
                  <View key={i} style={s.evItem}>
                    <Text style={[s.evBullet, { color: C.positive }]}>+</Text>
                    <Text style={s.evText}>
                      <Text style={s.evExercise}>[{ev.exerciseName}]</Text> {ev.text}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* Development Areas */}
            {c.developmentAreas.length > 0 && (
              <>
                <Text style={[s.evTitle, { color: C.negative }]}>Development Areas</Text>
                {c.developmentAreas.map((ev, i) => (
                  <View key={i} style={s.evItem}>
                    <Text style={[s.evBullet, { color: C.negative }]}>−</Text>
                    <Text style={s.evText}>
                      <Text style={s.evExercise}>[{ev.exerciseName}]</Text> {ev.text}
                    </Text>
                  </View>
                ))}
              </>
            )}

            {/* Development Tips */}
            {c.developmentTips.length > 0 && (
              <>
                <Text style={[s.evTitle, { color: C.bar2 }]}>Suggested Development Actions</Text>
                {c.developmentTips.map((tip, i) => (
                  <Text key={i} style={s.devTip}>• {tip}</Text>
                ))}
              </>
            )}
          </View>
        </View>
      ))}
      <Footer name={d.candidateName} />
    </Page>
  );
}

function DevRecsPage({ d }: { d: ReportData }) {
  if (d.developmentRecommendations.length === 0) return null;
  return (
    <Page size="A4" style={s.page}>
      <Text style={s.section}>Development Recommendations</Text>
      {d.developmentRecommendations.map((rec, i) => (
        <View key={i} style={{ flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: C.border }}>
          <Text style={{ width: 130, fontSize: 9, fontFamily: "Helvetica-Bold" }}>{rec.competencyName}</Text>
          <Text style={{ flex: 1, fontSize: 9, lineHeight: 1.4 }}>{rec.recommendation}</Text>
          <Text style={{ width: 50, fontSize: 8, textAlign: "right", color: C.textLight }}>{rec.priority}</Text>
        </View>
      ))}
      <Footer name={d.candidateName} />
    </Page>
  );
}

export function CandidateReport({ data }: { data: ReportData }) {
  return (
    <Document title={`Assessment Report - ${data.candidateName}`} author="VIFM Assessment Center" subject={data.engagementName}>
      <CoverPage d={data} />
      <AboutPage d={data} />
      <SummaryPage d={data} />
      <CompetencyPages d={data} />
      <DevRecsPage d={data} />
    </Document>
  );
}
