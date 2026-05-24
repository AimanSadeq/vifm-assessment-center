import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ReportData } from "./report-types";
import { getCompetencyGap, GAP_TONES } from "@/lib/scoring/competency-gap";
import { formatFitScore } from "@/lib/recommender/format";

const C = {
  primary: "#010131",
  accent: "#5391D5",
  navy: "#121140",
  text: "#121232",
  textLight: "#6b7280",
  textMuted: "#9ca3af",
  bg: "#ffffff",
  bgSoft: "#fafbfc",
  border: "#e5e7eb",
  borderSoft: "#f3f4f6",
  positive: "#059669",
  positiveBg: "#ecfdf5",
  warning: "#D97706",
  warningBg: "#fffbeb",
  negative: "#E11D48",
  negativeBg: "#fef2f2",
  gold: "#FBBF24",
  // Timeline phase colors
  phase30: "#E11D48", // rose - immediate
  phase60: "#D97706", // amber - near-term
  phase90: "#059669", // emerald - sustained
};

const s = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 50,
    paddingHorizontal: 50,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: C.text,
  },

  // Cover
  coverPage: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    fontFamily: "Helvetica",
    backgroundColor: C.primary,
  },
  coverBanner: { paddingTop: 90, paddingBottom: 50, paddingHorizontal: 60 },
  coverGoldRule: { width: 36, height: 2, backgroundColor: C.gold, marginBottom: 20 },
  coverEyebrow: {
    fontSize: 9,
    color: C.accent,
    letterSpacing: 2.5,
    marginBottom: 6,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  coverTitle: { fontSize: 32, color: "#ffffff", fontFamily: "Helvetica-Bold", letterSpacing: -0.4, marginBottom: 6 },
  coverSubtitle: { fontSize: 12, color: "#ffffff", opacity: 0.78 },
  coverNamePill: {
    marginTop: 36,
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  coverNamePillText: { fontSize: 11, color: "#ffffff", fontFamily: "Helvetica-Bold", letterSpacing: 0.4 },
  coverInsideBox: {
    marginTop: 38,
    padding: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  coverInsideHeading: {
    fontSize: 8,
    color: "#ffffff",
    opacity: 0.55,
    letterSpacing: 2.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  coverInsideItem: { fontSize: 10, color: "#ffffff", opacity: 0.85, marginBottom: 5 },
  coverFooter: { position: "absolute", bottom: 30, left: 60, right: 60, paddingTop: 10 },
  coverFooterText: { fontSize: 7, color: "#ffffff", opacity: 0.45, textAlign: "center", letterSpacing: 0.6 },

  // Section header
  sectionEyebrow: {
    fontSize: 8,
    color: C.textLight,
    letterSpacing: 2,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 8, letterSpacing: -0.2 },
  sectionRule: { width: 24, height: 1.5, backgroundColor: C.accent, marginBottom: 14 },
  bodyText: { fontSize: 9.5, lineHeight: 1.6, color: C.text, marginBottom: 10 },

  // Timeline
  timelineRow: { flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 12 },
  phaseCard: {
    flex: 1,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: C.border,
    backgroundColor: C.bgSoft,
    padding: 12,
    borderTopWidth: 3,
  },
  phaseLabel: { fontSize: 7.5, letterSpacing: 1.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 4 },
  phaseTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 3 },
  phaseSubtitle: { fontSize: 8, color: C.textLight, marginBottom: 8 },
  phaseItem: { fontSize: 8.5, color: C.text, marginBottom: 4, lineHeight: 1.45 },
  phaseEmpty: { fontSize: 8.5, color: C.textMuted, fontStyle: "italic" },

  // Competency cards
  compCard: {
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 4,
    borderLeftWidth: 3,
  },
  compHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: C.bgSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: C.border,
  },
  compName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.primary },
  compCluster: { fontSize: 7, color: C.textLight, marginTop: 2, letterSpacing: 0.4 },
  compBody: { padding: 12 },

  pill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    alignSelf: "flex-start",
  },
  pillText: { fontSize: 7.5, fontFamily: "Helvetica-Bold", letterSpacing: 0.2 },

  groupTitle: { fontSize: 7.5, letterSpacing: 1.5, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 5, color: C.textLight },
  tipItem: { flexDirection: "row", marginBottom: 4 },
  tipBullet: { width: 10, fontSize: 9, color: C.accent, fontFamily: "Helvetica-Bold" },
  tipText: { flex: 1, fontSize: 8.5, lineHeight: 1.45, color: C.text },

  recommendationBox: {
    marginTop: 8,
    padding: 9,
    borderRadius: 3,
    borderLeftWidth: 2,
    borderLeftColor: C.accent,
    backgroundColor: "#eff6ff",
  },

  // Course recommendation cards (Day 3f)
  courseCard: {
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 4,
    padding: 10,
    backgroundColor: C.bgSoft,
  },
  courseTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.primary },
  courseTitleAr: { fontSize: 8.5, color: C.textLight, marginTop: 2 },
  courseMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
    marginBottom: 6,
  },
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
  courseFitPill: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "#fef3c7",
    color: "#92400e",
    letterSpacing: 0.3,
  },
  driverChip: {
    fontSize: 7.5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1e40af",
    marginRight: 4,
    marginBottom: 4,
  },

  footer: {
    position: "absolute",
    bottom: 26,
    left: 50,
    right: 50,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: C.borderSoft,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: C.textLight, letterSpacing: 0.5 },
  confidential: { fontSize: 7, color: C.negative, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },

  // Closing
  closingBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 4,
    backgroundColor: C.bgSoft,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
  },
  closingHeading: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 6 },
});

const PHASE_LABELS = {
  high: { weeks: "First 30 days", subtitle: "Mission-critical gaps. Start immediately.", color: C.phase30 },
  medium: { weeks: "Days 30–60", subtitle: "Build momentum on broader development.", color: C.phase60 },
  low: { weeks: "Days 60–90", subtitle: "Sustain growth — round out the profile.", color: C.phase90 },
};

function GapPill({
  score,
  target,
}: {
  score: number | null;
  target?: number;
}) {
  const data = getCompetencyGap(score, target);
  if (!data) return null;
  const tone = GAP_TONES[data.severity];
  return (
    <View style={[s.pill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <Text style={[s.pillText, { color: tone.fg }]}>{data.label}</Text>
    </View>
  );
}

function PhaseCard({
  phase,
  recs,
}: {
  phase: "high" | "medium" | "low";
  recs: ReportData["developmentRecommendations"];
}) {
  const labels = PHASE_LABELS[phase];
  return (
    <View style={[s.phaseCard, { borderTopColor: labels.color }]}>
      <Text style={[s.phaseLabel, { color: labels.color }]}>{labels.weeks}</Text>
      <Text style={s.phaseTitle}>
        {phase === "high" ? "Now" : phase === "medium" ? "Next" : "Later"}
      </Text>
      <Text style={s.phaseSubtitle}>{labels.subtitle}</Text>
      {recs.length === 0 ? (
        <Text style={s.phaseEmpty}>No items at this priority.</Text>
      ) : (
        recs.map((r, i) => (
          <View key={i} style={{ marginBottom: 6 }}>
            <Text style={[s.phaseItem, { fontFamily: "Helvetica-Bold" }]}>
              · {r.competencyName}
            </Text>
            <Text style={[s.phaseItem, { paddingLeft: 8 }]}>
              {r.recommendation.length > 130
                ? r.recommendation.slice(0, 130) + "…"
                : r.recommendation}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

function Footer({ name }: { name: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.confidential}>STRICTLY CONFIDENTIAL</Text>
      <Text style={s.footerText}>{name} · Learning Plan</Text>
      <Text
        style={s.footerText}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

function CoverPage({ d }: { d: ReportData }) {
  return (
    <Page size="A4" style={s.coverPage}>
      <View style={s.coverBanner}>
        <View style={s.coverGoldRule} />
        <Text style={s.coverEyebrow}>VIFM Assessment Center</Text>
        <Text style={s.coverTitle}>Personalized Learning Plan</Text>
        <Text style={s.coverSubtitle}>
          {d.engagementName}
          {d.targetRole ? ` · ${d.targetRole}` : ""}
        </Text>
        <View style={s.coverNamePill}>
          <Text style={s.coverNamePillText}>{d.candidateName}</Text>
        </View>

        <View style={s.coverInsideBox}>
          <Text style={s.coverInsideHeading}>What&apos;s inside</Text>
          <Text style={s.coverInsideItem}>· Your 30 / 60 / 90 day development roadmap</Text>
          <Text style={s.coverInsideItem}>· Targeted actions for each development competency</Text>
          <Text style={s.coverInsideItem}>· Practical tips drawn from VIFM&apos;s competency framework</Text>
          <Text style={s.coverInsideItem}>· Reflection prompts for your next coaching conversation</Text>
        </View>
      </View>
      <View style={s.coverFooter}>
        <Text style={s.coverFooterText}>
          Virginia Institute of Finance and Management · Companion to your Assessment Report
        </Text>
      </View>
    </Page>
  );
}

function RoadmapPage({ d }: { d: ReportData }) {
  const recs = d.developmentRecommendations ?? [];
  const high = recs.filter((r) => r.priority === "high");
  const medium = recs.filter((r) => r.priority === "medium");
  const low = recs.filter((r) => r.priority === "low" || (r.priority !== "high" && r.priority !== "medium"));

  return (
    <Page size="A4" style={s.page}>
      <Text style={s.sectionEyebrow}>Action plan</Text>
      <Text style={s.sectionTitle}>Your 30 / 60 / 90 Day Roadmap</Text>
      <View style={s.sectionRule} />

      <Text style={s.bodyText}>
        Below is your development roadmap, sequenced from the most pressing
        gaps to longer-term opportunities. Treat the first 30 days as
        non-negotiable — that&apos;s where the highest-impact behaviour change
        lives.
      </Text>

      <View style={s.timelineRow}>
        <PhaseCard phase="high" recs={high} />
        <PhaseCard phase="medium" recs={medium} />
        <PhaseCard phase="low" recs={low} />
      </View>

      {recs.length === 0 && (
        <View style={s.closingBox}>
          <Text style={s.closingHeading}>No recommendations yet</Text>
          <Text style={[s.bodyText, { marginBottom: 0 }]}>
            Your assessor team is still finalising the development plan. The
            per-competency tips on the next pages still apply — start there.
          </Text>
        </View>
      )}

      <Footer name={d.candidateName} />
    </Page>
  );
}

function CompetencyDevelopmentPage({ d }: { d: ReportData }) {
  // Only competencies where there is a measurable gap — score < target.
  // Use default target 3; competencies missing a score are skipped.
  const focus = d.competencies.filter((c) => {
    if (c.consensusScore == null) return false;
    return c.consensusScore < 4;
  });

  // Pull recommendation by competency name (case-insensitive).
  const recByName = new Map(
    d.developmentRecommendations.map((r) => [r.competencyName.toLowerCase(), r])
  );

  return (
    <Page size="A4" style={s.page} wrap>
      <Text style={s.sectionEyebrow}>Targeted development</Text>
      <Text style={s.sectionTitle}>Per-Competency Action Cards</Text>
      <View style={s.sectionRule} />

      {focus.length === 0 ? (
        <Text style={s.bodyText}>
          No competencies fell below target. Use the Roadmap page to sustain
          your strengths and broaden your range.
        </Text>
      ) : (
        focus.map((c) => {
          const rec = recByName.get(c.competencyName.toLowerCase());
          return (
            <View key={c.competencyName} style={s.compCard} wrap={false}>
              <View style={s.compHead}>
                <View>
                  <Text style={s.compName}>{c.competencyName}</Text>
                  <Text style={s.compCluster}>
                    {c.domainName.toUpperCase()} · {c.clusterName}
                  </Text>
                </View>
                <GapPill score={c.consensusScore} />
              </View>
              <View style={s.compBody}>
                {c.developmentTips.length > 0 && (
                  <>
                    <Text style={s.groupTitle}>Specific actions to practice</Text>
                    {c.developmentTips.slice(0, 5).map((tip, i) => (
                      <View key={i} style={s.tipItem}>
                        <Text style={s.tipBullet}>·</Text>
                        <Text style={s.tipText}>{tip}</Text>
                      </View>
                    ))}
                  </>
                )}

                {rec && (
                  <View style={s.recommendationBox}>
                    <Text style={s.groupTitle}>Recommended focus</Text>
                    <Text style={[s.tipText, { fontSize: 9 }]}>{rec.recommendation}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })
      )}

      <View style={s.closingBox}>
        <Text style={s.closingHeading}>Bring this plan to your next coaching conversation</Text>
        <Text style={[s.bodyText, { marginBottom: 4 }]}>
          Useful prompts to discuss with your manager, mentor, or coach:
        </Text>
        <Text style={[s.tipText, { marginBottom: 3 }]}>
          · Which 1–2 actions in &quot;Now&quot; will I commit to in the next two weeks?
        </Text>
        <Text style={[s.tipText, { marginBottom: 3 }]}>
          · What specific situations at work could I use to practice each behaviour?
        </Text>
        <Text style={[s.tipText, { marginBottom: 3 }]}>
          · Who can give me feedback on these specific behaviours over the next 90 days?
        </Text>
        <Text style={[s.tipText, { marginBottom: 0 }]}>
          · How will I know I&apos;ve made progress — what does &quot;good&quot; look like?
        </Text>
      </View>

      <Footer name={d.candidateName} />
    </Page>
  );
}

function CoursesPage({ d }: { d: ReportData }) {
  const courses = d.recommendedCourses ?? [];
  if (courses.length === 0) return null;

  return (
    <Page size="A4" style={s.page} wrap>
      <Text style={s.sectionEyebrow}>Targeted training</Text>
      <Text style={s.sectionTitle}>Recommended VIFM Programmes</Text>
      <View style={s.sectionRule} />

      <Text style={s.bodyText}>
        These VIFM training courses map to the competencies where your
        scores fell below target. They&apos;re ordered by fit — calculated
        as the sum of (gap size × course relevance) across the
        competencies the course develops. Discuss with your manager or
        VIFM consultant which course best fits your current development
        priority.
      </Text>

      {courses.map((c) => {
        const isHighFit = c.total_score >= 4;
        return (
          <View key={c.course_id} style={s.courseCard} wrap={false}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.courseTitle}>
                  {c.title_en}
                  {c.code && (
                    <Text style={{ fontSize: 8, color: C.textLight, fontFamily: "Helvetica" }}>{`  ${c.code}`}</Text>
                  )}
                </Text>
                {c.title_ar && <Text style={s.courseTitleAr}>{c.title_ar}</Text>}
              </View>
              {isHighFit && (
                <Text style={s.courseFitPill}>★ HIGH FIT · {formatFitScore(c.total_score)}</Text>
              )}
            </View>

            <View style={s.courseMetaRow}>
              <Text style={s.courseMetaPill}>{c.vertical}</Text>
              <Text style={s.courseMetaPill}>{c.level.charAt(0).toUpperCase() + c.level.slice(1)}</Text>
              <Text style={s.courseMetaPill}>{c.duration_label}</Text>
              {!isHighFit && (
                <Text style={s.courseMetaPill}>fit score · {formatFitScore(c.total_score)}</Text>
              )}
            </View>

            <Text style={[s.groupTitle, { marginTop: 4 }]}>Why this course</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {c.drivers.map((d, i) => (
                <Text key={i} style={s.driverChip}>
                  {d.label} · gap {formatFitScore(d.gap)} × ×{d.relevance}
                </Text>
              ))}
            </View>
            {c.drivers[0]?.rationale && (
              <Text style={[s.tipText, { marginTop: 4, fontSize: 8, color: C.textLight }]}>
                {c.drivers[0].rationale}
              </Text>
            )}
          </View>
        );
      })}

      <Footer name={d.candidateName} />
    </Page>
  );
}

export function LearningPlan({ data }: { data: ReportData }) {
  return (
    <Document
      title={`Learning Plan - ${data.candidateName}`}
      author="VIFM Assessment Center"
      subject={`${data.engagementName} - Learning Plan`}
    >
      <CoverPage d={data} />
      <RoadmapPage d={data} />
      <CompetencyDevelopmentPage d={data} />
      <CoursesPage d={data} />
    </Document>
  );
}
