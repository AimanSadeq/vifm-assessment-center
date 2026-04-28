import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  ARA_INDIVIDUAL_FACTORS,
  type AraIndividualFactorId,
} from "@/lib/constants/ara-individual-factors";
import { VIFM_VERTICAL_LABELS, type VifmVertical } from "@/types/database";

/**
 * Personal AI Readiness Snapshot — single-page bilingual mini-report.
 *
 * Shape matches the on-screen results layout: hero with overall score
 * and respondent identity, four-factor breakdown with per-factor tone,
 * and recommended VIFM training programmes ranked by fit.
 *
 * Pure React-PDF (same engine as the AC Learning Plan); no Puppeteer
 * dependency, so the route is fast and deploys identically to the
 * existing Learning Plan endpoint.
 */

const C = {
  primary: "#010131",
  accent: "#5391D5",
  text: "#121232",
  textLight: "#6b7280",
  textMuted: "#9ca3af",
  bg: "#ffffff",
  bgSoft: "#fafbfc",
  border: "#e5e7eb",
  positive: "#059669",
  warning: "#D97706",
  negative: "#E11D48",
  gold: "#FBBF24",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: C.text,
  },
  // Hero
  hero: {
    backgroundColor: C.primary,
    color: "#fff",
    padding: 24,
    borderRadius: 6,
    marginBottom: 18,
  },
  heroEyebrow: {
    fontSize: 8,
    color: "#fff",
    opacity: 0.7,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 4 },
  heroIdentity: { fontSize: 11, color: "#fff", opacity: 0.85 },
  heroScoreRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 14 },
  heroScoreNum: { fontSize: 38, fontFamily: "Helvetica-Bold", color: "#fff" },
  heroScoreOf: { fontSize: 11, color: "#fff", opacity: 0.6, marginBottom: 5 },
  heroVerdict: { fontSize: 9.5, color: "#fff", opacity: 0.85, lineHeight: 1.5, marginTop: 12, maxWidth: 380 },

  // Sections
  sectionEyebrow: { fontSize: 8, color: C.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4, fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 6 },
  sectionRule: { width: 24, height: 1.5, backgroundColor: C.accent, marginBottom: 10 },

  // Factor grid
  factorRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  factorCard: {
    width: "48%",
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  factorTopRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  factorDot: { width: 6, height: 6, borderRadius: 3 },
  factorDomain: { fontSize: 7, color: C.textLight, letterSpacing: 1.2, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  factorTonePill: { fontSize: 7, fontFamily: "Helvetica-Bold", paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 6, marginLeft: "auto" },
  factorName: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: C.primary },
  factorScoreRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 4 },
  factorScoreNum: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.primary },
  factorScoreOf: { fontSize: 8, color: C.textLight },
  factorDesc: { fontSize: 8, color: C.textLight, lineHeight: 1.45, marginTop: 5 },

  // Course cards
  courseCard: {
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 4,
    padding: 9,
    backgroundColor: C.bgSoft,
  },
  courseHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  courseTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: C.primary, flex: 1 },
  courseFitPill: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "#fef3c7",
    color: "#92400e",
    letterSpacing: 0.3,
  },
  courseMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4, marginBottom: 4 },
  courseMetaPill: {
    fontSize: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: C.border,
    backgroundColor: C.bg,
    color: C.text,
  },
  driverChip: {
    fontSize: 7,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1e40af",
    marginRight: 3,
    marginBottom: 3,
  },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
  },
  footerText: { fontSize: 8, color: C.textMuted },
});

export type PersonalSnapshotData = {
  respondentName: string;
  respondentEmail: string;
  language: "en" | "ar";
  generatedAt: string;
  overallScore: number;
  factorScores: Record<AraIndividualFactorId, number>;
  recommendedCourses: Array<{
    course_id: string;
    title_en: string;
    title_ar: string | null;
    code: string | null;
    vertical: VifmVertical;
    level: string;
    duration_label: string;
    total_score: number;
    drivers: Array<{ label: string; gap: number; relevance: 1 | 2 | 3 }>;
  }>;
};

function toneFor(score: number): { label: string; bg: string; fg: string } {
  if (score >= 4) return { label: "Strong", bg: "#dcfce7", fg: "#166534" };
  if (score >= 3) return { label: "Developing", bg: "#fef3c7", fg: "#92400e" };
  return { label: "Opportunity", bg: "#fee2e2", fg: "#991b1b" };
}

function verdict(score: number): string {
  if (score >= 4) return "Strong readiness. You're already getting good leverage from AI across all four factors.";
  if (score >= 3) return "Moderate readiness — two or three factors are ripe for development to lift your impact.";
  return "Significant opportunity to develop. Start with your lowest-scoring factor for the biggest lift.";
}

export function PersonalSnapshot({ data }: { data: PersonalSnapshotData }) {
  return (
    <Document
      title={`Personal AI Readiness Snapshot - ${data.respondentName}`}
      author="VIFM Assessment Center"
      subject="Personal AI Readiness Snapshot"
    >
      <Page size="A4" style={s.page} wrap>
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroEyebrow}>VIFM AI Readiness Compass · Personal</Text>
          <Text style={s.heroTitle}>Personal AI Readiness Snapshot</Text>
          <Text style={s.heroIdentity}>
            {data.respondentName} · {data.respondentEmail}
          </Text>
          <View style={s.heroScoreRow}>
            <Text style={s.heroScoreNum}>{data.overallScore.toFixed(1)}</Text>
            <Text style={s.heroScoreOf}>/ 5 overall</Text>
          </View>
          <Text style={s.heroVerdict}>{verdict(data.overallScore)}</Text>
        </View>

        {/* Factors */}
        <Text style={s.sectionEyebrow}>Per-factor breakdown</Text>
        <Text style={s.sectionTitle}>Where you stand on each VIFM factor</Text>
        <View style={s.sectionRule} />
        <View style={s.factorRow}>
          {ARA_INDIVIDUAL_FACTORS.map((f) => {
            const score = data.factorScores[f.id] ?? 0;
            const tone = toneFor(score);
            return (
              <View key={f.id} style={s.factorCard} wrap={false}>
                <View style={s.factorTopRow}>
                  <View style={[s.factorDot, { backgroundColor: f.color }]} />
                  <Text style={s.factorDomain}>{f.domain}</Text>
                  <Text style={[s.factorTonePill, { backgroundColor: tone.bg, color: tone.fg }]}>
                    {tone.label.toUpperCase()}
                  </Text>
                </View>
                <Text style={s.factorName}>{f.name_en}</Text>
                <View style={s.factorScoreRow}>
                  <Text style={s.factorScoreNum}>
                    {score > 0 ? score.toFixed(1) : "—"}
                  </Text>
                  <Text style={s.factorScoreOf}>/ 5</Text>
                </View>
                <Text style={s.factorDesc}>
                  {f.description_en.length > 145 ? f.description_en.slice(0, 145) + "…" : f.description_en}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Courses */}
        {data.recommendedCourses.length > 0 && (
          <>
            <Text style={s.sectionEyebrow}>Targeted training</Text>
            <Text style={s.sectionTitle}>Develop with VIFM programmes</Text>
            <View style={s.sectionRule} />
            {data.recommendedCourses.slice(0, 5).map((c) => {
              const isHighFit = c.total_score >= 4;
              return (
                <View key={c.course_id} style={s.courseCard} wrap={false}>
                  <View style={s.courseHead}>
                    <Text style={s.courseTitle}>
                      {c.title_en}
                      {c.code && (
                        <Text style={{ fontSize: 8, color: C.textLight, fontFamily: "Helvetica" }}>
                          {`  ${c.code}`}
                        </Text>
                      )}
                    </Text>
                    {isHighFit && <Text style={s.courseFitPill}>★ HIGH FIT · {c.total_score}</Text>}
                  </View>
                  <View style={s.courseMetaRow}>
                    <Text style={s.courseMetaPill}>
                      {VIFM_VERTICAL_LABELS[c.vertical] ?? c.vertical}
                    </Text>
                    <Text style={s.courseMetaPill}>
                      {c.level.charAt(0).toUpperCase() + c.level.slice(1)}
                    </Text>
                    <Text style={s.courseMetaPill}>{c.duration_label}</Text>
                    {!isHighFit && <Text style={s.courseMetaPill}>fit · {c.total_score}</Text>}
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                    {c.drivers.map((d, i) => (
                      <Text key={i} style={s.driverChip}>
                        {d.label} · gap {d.gap} × ×{d.relevance}
                      </Text>
                    ))}
                  </View>
                </View>
              );
            })}
          </>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>VIFM AI Readiness Compass · Personal Snapshot</Text>
          <Text style={s.footerText}>Generated {data.generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}
