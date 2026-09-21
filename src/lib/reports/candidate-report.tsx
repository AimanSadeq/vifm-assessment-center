import React from "react";
import { Document, Font, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Keep email addresses and links whole. React-PDF hyphenates by default, which
// broke the participant contact across a line as "asadeq@viftrain- ing.com" -
// unreadable, and worse, uncopyable for someone trying to raise a concern.
// Ordinary words keep wrapping normally.
Font.registerHyphenationCallback((word) => (/[@/]/.test(word) ? [word] : word.split("­")));
import type { ReportData } from "./report-types";
import { getCompetencyGap, GAP_TONES, type GapBadgeData } from "@/lib/scoring/competency-gap";

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

// Brand-token palette - aligned with the AI Readiness Compass design
// system. The 5 score bars now ride the rose -> amber -> teal -> emerald
// -> gold gradient rather than the Bootstrap red/orange/green of the
// pre-Compass era.
const C = {
  // Identity
  primary: "#010131",   // Navy
  accent: "#5391D5",    // Brand blue
  navy: "#121140",
  // Text
  text: "#121232",
  textLight: "#6b7280",
  textMuted: "#9ca3af",
  metaLight: "#8899bb",
  // Surfaces
  bg: "#ffffff",
  bgSoft: "#fafbfc",
  bgPanel: "#f9fafb",
  border: "#e5e7eb",
  borderSoft: "#f3f4f6",
  // Semantic tones (brand-token analogues for evidence + alerts)
  positive: "#059669",  // Emerald-600 - for "Strength" copy
  positiveBg: "#ecfdf5",
  negative: "#E11D48",  // Rose-600 - for "Development Need" copy
  negativeBg: "#fef2f2",
  warning: "#D97706",   // Amber-600 - for "Suggested action" headers
  warningBg: "#fffbeb",
  observation: "#1e3a8a",
  observationBg: "#eff6ff",
  // Accent halo for the cover gold underline
  gold: "#FBBF24",
  // Five maturity bands - 1 (lowest) to 5 (highest)
  bar1: "#FB7185", // rose
  bar2: "#FBBF24", // amber
  bar3: "#5391D5", // accent blue
  bar4: "#34D399", // emerald
  bar5: "#FBBF24", // gold (same hue as amber but reads as "leading" in context)
};

const s = StyleSheet.create({
  page: { paddingTop: 50, paddingBottom: 50, paddingHorizontal: 50, fontFamily: "Helvetica", fontSize: 10, color: C.text },

  // ─── Cover (navy hero with gold accent) ───
  coverPage: { paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0, fontFamily: "Helvetica", backgroundColor: C.primary },
  coverBanner: { paddingTop: 80, paddingBottom: 60, paddingHorizontal: 60 },
  coverGoldRule: { width: 36, height: 2, backgroundColor: C.gold, marginBottom: 18 },
  coverConfidential: { fontSize: 8, color: "#ffffff", opacity: 0.65, letterSpacing: 3, marginBottom: 24, textTransform: "uppercase" },
  coverEyebrow: { fontSize: 9, color: C.accent, letterSpacing: 2.5, marginBottom: 6, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  coverTitle: { fontSize: 32, color: "#ffffff", fontFamily: "Helvetica-Bold", marginBottom: 4, letterSpacing: -0.4 },
  coverSubtitle: { fontSize: 12, color: "#ffffff", opacity: 0.75, marginBottom: 0 },
  coverNamePill: { marginTop: 36, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  coverNamePillText: { fontSize: 11, color: "#ffffff", fontFamily: "Helvetica-Bold", letterSpacing: 0.4 },
  coverDetails: { paddingHorizontal: 60, paddingTop: 28, paddingBottom: 24, backgroundColor: "rgba(255,255,255,0.04)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)" },
  coverDetailsHeading: { fontSize: 8, color: "#ffffff", opacity: 0.5, letterSpacing: 2.5, marginBottom: 12, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  coverRow: { flexDirection: "row", marginBottom: 7 },
  coverLabel: { width: 130, fontSize: 9, color: "#ffffff", opacity: 0.55 },
  coverValue: { fontSize: 9.5, color: "#ffffff", fontFamily: "Helvetica-Bold" },
  coverFooter: { position: "absolute", bottom: 30, left: 60, right: 60, paddingTop: 10 },
  coverFooterText: { fontSize: 7, color: "#ffffff", opacity: 0.45, textAlign: "center", letterSpacing: 0.6 },

  // ─── Section header (eyebrow + title + accent rule) ───
  sectionEyebrow: { fontSize: 8, color: C.textLight, letterSpacing: 2, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 4 },
  sectionTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 8, letterSpacing: -0.2 },
  sectionRule: { width: 24, height: 1.5, backgroundColor: C.accent, marginBottom: 12 },

  subSection: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 6, marginTop: 14 },
  bodyText: { fontSize: 9.5, lineHeight: 1.6, color: C.text, marginBottom: 8 },

  // ─── Stat tile strip on Summary page ───
  statStrip: { flexDirection: "row", gap: 8, marginBottom: 18 },
  statTile: { flex: 1, padding: 10, backgroundColor: C.bgSoft, borderTopWidth: 2, borderTopColor: C.accent, borderRadius: 4, borderWidth: 0.5, borderColor: C.border },
  statTileLabel: { fontSize: 7.5, color: C.textLight, letterSpacing: 1.5, fontFamily: "Helvetica-Bold", marginBottom: 4, textTransform: "uppercase" },
  statTileValue: { fontSize: 22, fontFamily: "Helvetica-Bold", color: C.primary, lineHeight: 1, letterSpacing: -0.4 },
  statTileSuffix: { fontSize: 8.5, color: C.textLight, marginTop: 4 },

  // ─── OAR callout (kept but cleaner) ───
  oarBox: { backgroundColor: C.bgSoft, borderLeftWidth: 3, borderLeftColor: C.accent, borderTopWidth: 0.5, borderRightWidth: 0.5, borderBottomWidth: 0.5, borderColor: C.border, borderRadius: 4, padding: 16, marginBottom: 18 },
  oarRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 4 },
  oarNum: { fontSize: 36, fontFamily: "Helvetica-Bold", color: C.primary, marginRight: 12, letterSpacing: -0.6 },
  oarLabel: { fontSize: 12, color: C.textLight },
  oarRec: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.accent, marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" },

  // ─── Competency rating bars (clean tracks) ───
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  barName: { fontSize: 9, width: 140, color: C.text },
  barTrack: { flex: 1, height: 6, backgroundColor: C.borderSoft, borderRadius: 3, marginRight: 8 },
  barFill: { height: 6, borderRadius: 3 },
  barLabel: { fontSize: 8, color: C.textLight, width: 56, textAlign: "right" },

  // ─── Competency card (left-border accent) ───
  compCard: { marginBottom: 12, borderWidth: 0.5, borderColor: C.border, borderRadius: 4, borderLeftWidth: 3 },
  compHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: C.bgSoft, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: C.border },
  compName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.primary },
  compCluster: { fontSize: 7, color: C.textLight, marginTop: 2, letterSpacing: 0.4 },
  compBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  compBadgeText: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#ffffff", letterSpacing: 0.3 },
  compBody: { padding: 12 },

  // ─── Finding-card evidence blocks (Compass-style) ───
  findGroup: { marginTop: 8, padding: 9, borderRadius: 3, borderLeftWidth: 2 },
  findGroupTitle: { fontSize: 7.5, letterSpacing: 1.5, fontFamily: "Helvetica-Bold", marginBottom: 5, textTransform: "uppercase" },
  findItem: { flexDirection: "row", marginBottom: 4 },
  findGlyph: { width: 12, fontSize: 9, fontFamily: "Helvetica-Bold" },
  findExercise: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.accent, marginRight: 4 },
  findText: { flex: 1, fontSize: 8.5, lineHeight: 1.45, color: C.text },

  // ─── Exercise rating row ───
  exRatRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3, borderBottomWidth: 0.5, borderBottomColor: C.borderSoft },
  exRatName: { fontSize: 8.5, color: C.text },
  exRatScore: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },

  // ─── Development tips ───
  devTip: { fontSize: 8.5, lineHeight: 1.45, color: C.text, marginBottom: 3, paddingLeft: 10 },

  // ─── Summary chips ───
  summaryRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  summaryBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, marginRight: 5, marginBottom: 5, borderWidth: 0.5 },
  summaryBadgeText: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },

  // ─── Footer ───
  footer: { position: "absolute", bottom: 26, left: 50, right: 50, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: C.borderSoft, paddingTop: 6 },
  footerText: { fontSize: 7, color: C.textLight, letterSpacing: 0.5 },
  confidential: { fontSize: 7, color: C.negative, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
});

function scoreColor(n: number): string {
  return [, C.bar1, C.bar2, C.bar3, C.bar4, C.bar5][n] ?? C.bar3;
}

const gapPillStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 8,
    borderWidth: 0.5,
    alignSelf: "flex-start",
  },
  pillText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.2,
  },
});

function GapPill({ data }: { data: GapBadgeData }) {
  const tone = GAP_TONES[data.severity];
  return (
    <View
      style={[
        gapPillStyles.pill,
        { backgroundColor: tone.bg, borderColor: tone.border },
      ]}
    >
      <Text style={[gapPillStyles.pillText, { color: tone.fg }]}>
        {data.label}
      </Text>
    </View>
  );
}

/**
 * SectionHeader (PDF) - eyebrow + title + accent rule.
 * Mirrors the Compass design language so AC pages feel cohesive
 * with the AI Readiness Compass report.
 */
function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View>
      <Text style={s.sectionEyebrow}>{eyebrow}</Text>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.sectionRule} />
    </View>
  );
}

function StatTile({ label, value, suffix, accent }: { label: string; value: string; suffix?: string; accent?: string }) {
  const style = accent ? [s.statTile, { borderTopColor: accent }] : [s.statTile];
  return (
    <View style={style}>
      <Text style={s.statTileLabel}>{label}</Text>
      {/* Long values ("Ready with Development") overflow the tile at the headline
          size, so step the size down as the text grows rather than clip it. */}
      <Text style={[s.statTileValue, value.length > 18 ? { fontSize: 12 } : value.length > 10 ? { fontSize: 15 } : {}]}>
        {value}
      </Text>
      {suffix && <Text style={s.statTileSuffix}>{suffix}</Text>}
    </View>
  );
}

function Footer({ name }: { name: string }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.confidential}>STRICTLY CONFIDENTIAL</Text>
      <Text style={s.footerText}>{name} · VIFM Assessment Center®</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function CoverPage({ d }: { d: ReportData }) {
  return (
    <Page size="A4" style={s.coverPage}>
      <View style={s.coverBanner}>
        <View style={s.coverGoldRule} />
        <Text style={s.coverConfidential}>Confidential · For Internal VIFM Use</Text>
        <Text style={s.coverEyebrow}>VIFM Assessment Center®</Text>
        <Text style={s.coverTitle}>Talent Assessment Report</Text>
        <Text style={s.coverSubtitle}>
          {d.engagementName}{d.targetRole ? ` · ${d.targetRole}` : ""}
        </Text>
        <View style={s.coverNamePill}>
          <Text style={s.coverNamePillText}>{d.candidateName}</Text>
        </View>
      </View>
      <View style={s.coverDetails}>
        <Text style={s.coverDetailsHeading}>Assessment summary</Text>
        {[
          ["Organization", d.organizationName],
          ...(d.targetRole ? [["Target Role", d.targetRole]] : []),
          ["Assessment Dates", d.assessmentDates],
          ["Assessors", d.assessorNames.join(", ") || "-"],
          ["Report Generated", d.generatedAt],
        ].map(([label, value]) => (
          <View key={label as string} style={s.coverRow}>
            <Text style={s.coverLabel}>{label as string}</Text>
            <Text style={s.coverValue}>{value as string}</Text>
          </View>
        ))}
      </View>
      <View style={s.coverFooter}>
        <Text style={s.coverFooterText}>
          Virginia Institute of Finance and Management · Confidential Assessment Report
        </Text>
      </View>
    </Page>
  );
}

function AboutPage({ d }: { d: ReportData }) {
  return (
    <Page size="A4" style={s.page}>
      <SectionHeader eyebrow="Methodology" title="About the Assessment Centre" />
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
          {n} - {BARS[n]}
        </Text>
      ))}
      <Text style={[s.bodyText, { marginTop: 6 }]}>
        The overall competency rating is not necessarily an average of the scores from the exercises - some activities are rated more heavily than others based on the competency-to-exercise matrix.
      </Text>
      <Text style={s.bodyText}>
        This report provides information around the participant&apos;s strengths and development areas in relation to skills and behaviours important for the target role. You may regard this report as being particularly relevant for the next 24 months.
      </Text>
      <Footer name={d.candidateName} />
    </Page>
  );
}

function SummaryPage({ d }: { d: ReportData }) {
  // Compute headline stats for the stat strip.
  const scoredComps = d.competencies.filter((c) => c.consensusScore != null);
  const strengthsCount = scoredComps.filter((c) => (c.consensusScore ?? 0) >= 4).length;
  const developmentCount = scoredComps.filter((c) => (c.consensusScore ?? 0) <= 2).length;

  return (
    <Page size="A4" style={s.page}>
      <SectionHeader eyebrow="Executive view" title="Summary of Performance" />

      {/* Stat tile strip - quick read of the headline numbers */}
      <View style={s.statStrip}>
        <StatTile
          label="Overall rating"
          value={d.overallScore ? `${d.overallScore}/5` : "-"}
          suffix={d.overallScore ? (BARS[d.overallScore] ?? "") : "Pending"}
          accent={d.overallScore ? scoreColor(d.overallScore) : C.textMuted}
        />
        <StatTile
          label="Recommendation"
          value={d.recommendation ? (OAR_LABELS[d.recommendation] ?? "-") : "-"}
          suffix={
            // Say how this figure was reached. A selection centre calculates it
            // (BPS 7.4), so calling it a consensus would contradict the closing
            // page and misdescribe the method.
            !d.recommendation
              ? "Pending wash-up"
              : d.integrationMethod === "weighted_average"
                ? "Calculated from competency ratings"
                : "Per assessor consensus"
          }
          accent={
            d.recommendation === "ready_now" ? C.positive :
            d.recommendation === "ready_with_development" ? C.bar2 :
            d.recommendation === "not_ready" ? C.negative :
            C.accent
          }
        />
        <StatTile
          label="Strengths"
          value={String(strengthsCount)}
          suffix={`Of ${scoredComps.length} scored`}
          accent={C.positive}
        />
        <StatTile
          label="Development needs"
          value={String(developmentCount)}
          suffix={`Of ${scoredComps.length} scored`}
          accent={C.negative}
        />
      </View>

      {/* OAR narrative */}
      <View style={s.oarBox}>
        {d.overallScore ? (
          <>
            <View style={s.oarRow}>
              <Text style={s.oarNum}>{d.overallScore}/5</Text>
              <Text style={s.oarLabel}>{BARS[d.overallScore] ?? ""}</Text>
            </View>
            {d.recommendation && (
              <Text style={s.oarRec}>Recommendation · {OAR_LABELS[d.recommendation] ?? d.recommendation}</Text>
            )}
            {d.executiveSummary && <Text style={[s.bodyText, { marginTop: 4 }]}>{d.executiveSummary}</Text>}
          </>
        ) : (
          <Text style={{ fontSize: 10, color: C.textLight }}>Overall Assessment Rating not yet finalized.</Text>
        )}
      </View>

      {/* Data-quality caveat - flags a report built on thin or single-rater
          evidence, so a reader never mistakes a sparse report for a complete one. */}
      {(d.hasAssessorData === false || (d.raterCount != null && d.raterCount < 2)) && (
        <View style={{ marginTop: 8, padding: 8, backgroundColor: "#FEF7E6", borderRadius: 4, borderLeftWidth: 3, borderLeftColor: "#D97706" }}>
          <Text style={{ fontSize: 8.5, color: "#92400E", lineHeight: 1.4 }}>
            {d.hasAssessorData === false
              ? "Note: this report was generated with limited observation data - some competencies may show no recorded evidence. Treat the scores as indicative."
              : "Note: ratings reflect a single assessor, so inter-rater reliability is reduced. Treat the scores as indicative."}
          </Text>
        </View>
      )}

      {/* Competency score bars */}
      <Text style={s.subSection}>Competency Ratings</Text>
      {d.competencies.map((c) => {
        const gap = getCompetencyGap(c.consensusScore);
        return (
          <View key={c.competencyName} style={s.barRow}>
            <Text style={s.barName}>{c.competencyName}</Text>
            <View style={s.barTrack}>
              {c.consensusScore ? <View style={[s.barFill, { width: `${(c.consensusScore / 5) * 100}%`, backgroundColor: scoreColor(c.consensusScore) }]} /> : null}
            </View>
            <Text style={[s.barLabel, { width: 40 }]}>{c.consensusScore ? `${c.consensusScore}/5` : "Pending"}</Text>
            {gap ? <GapPill data={gap} /> : null}
          </View>
        );
      })}

      {/* Top strengths / development - chips with semantic borders */}
      {d.topStrengths.length > 0 && (
        <>
          <Text style={[s.subSection, { color: C.positive }]}>Key Strengths</Text>
          <View style={s.summaryRow}>
            {d.topStrengths.map((name) => (
              <View key={name} style={[s.summaryBadge, { backgroundColor: C.positiveBg, borderColor: C.positive }]}>
                <Text style={[s.summaryBadgeText, { color: C.positive }]}>{name}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      {d.topDevelopmentAreas.length > 0 && (
        <>
          <Text style={[s.subSection, { color: C.warning }]}>
            {d.developmentAreasAreLowest ? "Lowest Rated Competencies" : "Key Development Areas"}
          </Text>
          {d.developmentAreasAreLowest && (
            <Text style={[s.bodyText, { marginTop: -2, marginBottom: 4, fontSize: 8.5, color: C.textMuted }]}>
              No competency was rated 2 or below. These are the lowest rated, shown as the natural place to focus.
            </Text>
          )}
          <View style={s.summaryRow}>
            {d.topDevelopmentAreas.map((name) => (
              <View key={name} style={[s.summaryBadge, { backgroundColor: C.warningBg, borderColor: C.warning }]}>
                <Text style={[s.summaryBadgeText, { color: C.warning }]}>{name}</Text>
              </View>
            ))}
          </View>
        </>
      )}
      {(d.technicalCertifications?.length ?? 0) > 0 && (
        <>
          <Text style={[s.subSection, { color: "#4338ca" }]}>Technical Certifications</Text>
          <View style={s.summaryRow}>
            {d.technicalCertifications!.map((c) => (
              <View key={c.domainNameEn} style={[s.summaryBadge, { backgroundColor: "#eef2ff", borderColor: "#6366f1" }]}>
                <Text style={[s.summaryBadgeText, { color: "#3730a3" }]}>
                  {c.domainNameEn}{c.level != null ? ` · Level ${c.level}/5` : ""}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
      <Footer name={d.candidateName} />
    </Page>
  );
}

/**
 * FindingGroup (PDF) - left-border accented panel that holds typed
 * evidence (Strengths / Development Areas / Suggested actions). Mirrors
 * the FindingCard pattern from the Compass HTML report.
 */
function FindingGroup({
  variant, title, children,
}: {
  variant: "strength" | "development" | "action";
  title: string;
  children: React.ReactNode;
}) {
  const tone = {
    strength:    { bg: C.positiveBg, bd: C.positive,  fg: C.positive },
    development: { bg: C.negativeBg, bd: C.negative,  fg: C.negative },
    action:      { bg: C.warningBg,  bd: C.warning,   fg: C.warning },
  }[variant];

  return (
    <View style={[s.findGroup, { backgroundColor: tone.bg, borderLeftColor: tone.bd }]} wrap={false}>
      <Text style={[s.findGroupTitle, { color: tone.fg }]}>{title}</Text>
      {children}
    </View>
  );
}

function CompetencyPages({ d }: { d: ReportData }) {
  return (
    <Page size="A4" style={s.page} wrap>
      <SectionHeader eyebrow="Per-competency findings" title="Competency Detail" />
      {d.competencies.map((c) => {
        const sc = c.consensusScore ?? 0;
        const accent = c.consensusScore ? scoreColor(c.consensusScore) : C.textMuted;
        const gap = getCompetencyGap(c.consensusScore);
        return (
          <View
            key={c.competencyName}
            style={[s.compCard, { borderLeftColor: accent }]}
            wrap={false}
          >
            <View style={s.compHead}>
              <View>
                <Text style={s.compName}>{c.competencyName}</Text>
                <Text style={s.compCluster}>
                  {c.domainName.toUpperCase()} · {c.clusterName}
                  {c.weight ? ` · WEIGHT ${c.weight}` : ""}
                </Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                {gap ? <GapPill data={gap} /> : null}
                {c.consensusScore ? (
                  <View style={[s.compBadge, { backgroundColor: scoreColor(c.consensusScore) }]}>
                    <Text style={s.compBadgeText}>{sc}/5 · {BARS[sc]}</Text>
                  </View>
                ) : (
                  <View style={[s.compBadge, { backgroundColor: C.borderSoft }]}>
                    <Text style={[s.compBadgeText, { color: C.textLight }]}>Pending</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={s.compBody}>
              {/* Exercise ratings strip */}
              {c.exerciseRatings.length > 0 && (
                <>
                  <Text style={[s.findGroupTitle, { color: C.textLight, marginBottom: 4 }]}>Exercise ratings</Text>
                  {c.exerciseRatings.map((er) => (
                    <View key={er.exerciseName} style={s.exRatRow}>
                      <Text style={s.exRatName}>{er.exerciseName}</Text>
                      <Text style={[s.exRatScore, { color: scoreColor(er.score) }]}>
                        {er.score}/5 · {BARS[er.score]}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              {c.strengths.length > 0 && (
                <FindingGroup variant="strength" title="Observed strengths">
                  {c.strengths.map((ev, i) => (
                    <View key={i} style={s.findItem}>
                      <Text style={[s.findGlyph, { color: C.positive }]}>+</Text>
                      <Text style={s.findText}>
                        <Text style={s.findExercise}>[{ev.exerciseName}]</Text> {ev.text}
                      </Text>
                    </View>
                  ))}
                </FindingGroup>
              )}

              {c.developmentAreas.length > 0 && (
                <FindingGroup variant="development" title="Development areas">
                  {c.developmentAreas.map((ev, i) => (
                    <View key={i} style={s.findItem}>
                      <Text style={[s.findGlyph, { color: C.negative }]}>−</Text>
                      <Text style={s.findText}>
                        <Text style={s.findExercise}>[{ev.exerciseName}]</Text> {ev.text}
                      </Text>
                    </View>
                  ))}
                </FindingGroup>
              )}

              {c.developmentTips.length > 0 && (
                <FindingGroup variant="action" title="Suggested development actions">
                  {c.developmentTips.map((tip, i) => (
                    <Text key={i} style={s.devTip}>· {tip}</Text>
                  ))}
                </FindingGroup>
              )}
            </View>
          </View>
        );
      })}
      <Footer name={d.candidateName} />
    </Page>
  );
}

function DevRecsPage({ d }: { d: ReportData }) {
  return (
    <Page size="A4" style={s.page}>
      <SectionHeader eyebrow="Action plan" title="Development Recommendations" />
      {d.developmentRecommendations.length === 0 ? (
        <Text style={s.bodyText}>
          No formal development recommendations have been recorded for this candidate. Please refer to the development actions suggested within each competency section above.
        </Text>
      ) : (
        <>
          {/* Header row */}
          <View style={{ flexDirection: "row", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: C.primary, marginBottom: 4 }}>
            <Text style={{ width: 130, fontSize: 8, fontFamily: "Helvetica-Bold", color: C.textLight }}>Competency</Text>
            <Text style={{ flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold", color: C.textLight }}>Recommendation</Text>
            <Text style={{ width: 50, fontSize: 8, fontFamily: "Helvetica-Bold", color: C.textLight, textAlign: "right" }}>Priority</Text>
          </View>
          {d.developmentRecommendations.map((rec, i) => (
            <View key={i} style={{ flexDirection: "row", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: C.border }}>
              <Text style={{ width: 130, fontSize: 9, fontFamily: "Helvetica-Bold" }}>{rec.competencyName}</Text>
              <Text style={{ flex: 1, fontSize: 9, lineHeight: 1.4 }}>{rec.recommendation}</Text>
              <Text style={{ width: 50, fontSize: 8, textAlign: "right", color: C.textLight }}>{rec.priority}</Text>
            </View>
          ))}
        </>
      )}
      <Footer name={d.candidateName} />
    </Page>
  );
}

/**
 * What this report may be used for, what it cannot carry, and who to ask.
 *
 * The standard requires every report to explain permitted use, its limitations
 * and its technical qualities (8.12), to state the risks of deciding on the data
 * (8.9), to say that decisions belong to the client (8.2), to give a contact for
 * questions (8.20) and to tell the participant how to challenge a result (5.49).
 * None of it is boilerplate: the wording changes with how this centre actually
 * reached its rating and how much of its content has been expert-reviewed.
 */
function UsingThisReportPage({ d }: { d: ReportData }) {
  const computed = d.integrationMethod === "weighted_average";
  const contentPending =
    d.contentApproved && d.contentApproved.total > 0 && d.contentApproved.approved < d.contentApproved.total;
  const contact = d.contactName
    ? `${d.contactName}${d.contactEmail ? ` (${d.contactEmail})` : ""}`
    : "the VIFM consultant who arranged this assessment";

  return (
    <Page size="A4" style={s.page}>
      <SectionHeader eyebrow="Use and limitations" title="Using This Report" />

      <Text style={s.subSection}>What this report is for</Text>
      <Text style={s.bodyText}>
        This report describes how {d.candidateName} performed against the competencies assessed at this centre. It is
        evidence for a decision, not the decision itself: any decision that follows, and its consequences, rests with
        the client organisation. It should be read alongside other information about the person, never on its own.
      </Text>

      <Text style={s.subSection}>How the overall rating was reached</Text>
      <Text style={s.bodyText}>
        {computed
          ? "This centre supports a selection decision, so the overall rating is calculated from the agreed competency "
            + "ratings using weights fixed when the centre was designed. It is not a figure the assessor panel agreed "
            + "in discussion."
          : "Assessors reached the overall rating by discussing the evidence recorded against each competency and "
            + "agreeing a view."}
        {computed && d.computedScore != null ? ` The calculated rating is ${d.computedScore.toFixed(2)}.` : ""}
        {d.panelDisagrees
          ? " The panel recorded that it disagrees with the calculated rating; that disagreement is held with the "
            + "assessment record and is available on request."
          : ""}
      </Text>

      <Text style={s.subSection}>What it cannot tell you</Text>
      <Text style={s.bodyText}>
        An assessment centre samples behaviour in simulated situations over a short period. It cannot account for
        performance in a real job over time, for circumstances on the day, or for growth since the assessment. Ratings
        carry measurement error, and small differences between people, or between one competency and another, should
        not be treated as meaningful.
        {d.raterCount === 1
          ? " Only one assessor rated this participant, so there is no second view to check these ratings against."
          : ""}
        {d.hasAssessorData === false
          ? " No assessor observations underpin these scores, so they should be treated as provisional."
          : ""}
      </Text>

      <Text style={s.subSection}>Technical quality</Text>
      <Text style={s.bodyText}>
        {contentPending
          ? `The behavioural content used at this centre is under expert review: ${d.contentApproved?.approved} of `
            + `${d.contentApproved?.total} indicators have been approved by a subject-matter expert so far. Until that `
            + "review is complete, treat these results as indicative and do not use them as the sole basis for a "
            + "hiring, promotion or termination decision."
          : "The behavioural content used at this centre has been reviewed and approved by subject-matter experts. "
            + "VIFM continues to collect evidence on the reliability and validity of these assessments, and that "
            + "evidence is available to clients on request."}
      </Text>

      <Text style={s.subSection}>Questions and challenges</Text>
      <Text style={s.bodyText}>
        Questions about this report, or about how the assessment was run, should go to {contact}.
        {" "}
        {d.appealsNote
          ? d.appealsNote
          : "A participant who wishes to query or challenge a result should raise it with that contact, who will "
            + "explain how the concern will be reviewed and by whom."}
        {" "}
        A concern or an appeal can also be raised from your own assessment portal, under &quot;Questions or
        concerns&quot;. It is recorded with the assessment, answered in writing, and raising one does not
        change your results.
      </Text>

      <Text style={[s.bodyText, { marginTop: 10, fontSize: 8.5, color: C.textMuted }]}>
        Report generated {d.generatedAt}
        {d.checkedByName ? ` · Checked before release by ${d.checkedByName}` : ""}
        {" · Held for 24 months from the assessment date, then deleted."}
      </Text>
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
      <UsingThisReportPage d={data} />
    </Document>
  );
}
