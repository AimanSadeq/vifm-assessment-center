// Shared React-PDF primitives + brand tokens for the audience-specific AC
// reports (hiring-manager + talent-acquisition lenses). Kept visually aligned
// with candidate-report.tsx so the three reports read as one family.
import React from "react";
import { Text, View, StyleSheet } from "@react-pdf/renderer";
import { getCompetencyGap, GAP_TONES } from "@/lib/scoring/competency-gap";
import type { ReportData, ReportCompetencyData } from "./report-types";

export const C = {
  primary: "#010131", accent: "#5391D5", navy: "#121140",
  text: "#121232", textLight: "#6b7280", textMuted: "#9ca3af",
  bg: "#ffffff", bgSoft: "#fafbfc", bgPanel: "#f9fafb",
  border: "#e5e7eb", borderSoft: "#f3f4f6",
  positive: "#059669", positiveBg: "#ecfdf5",
  negative: "#E11D48", negativeBg: "#fef2f2",
  warning: "#D97706", warningBg: "#fffbeb",
  info: "#1e3a8a", infoBg: "#eff6ff",
  gold: "#FBBF24",
  bar1: "#FB7185", bar2: "#FBBF24", bar3: "#5391D5", bar4: "#34D399", bar5: "#FBBF24",
};

export const BARS: Record<number, string> = {
  1: "Significant Development Needed", 2: "Development Needed",
  3: "Competent", 4: "Strength", 5: "Significant Strength",
};
const REC_LABELS: Record<string, string> = {
  ready_now: "Ready Now", ready_with_development: "Ready with Development", not_ready: "Not Ready",
};
export function recLabel(rec: string | null): string {
  if (!rec) return "Pending";
  return REC_LABELS[rec] ?? rec;
}
export function recColor(rec: string | null): string {
  if (rec === "ready_now") return C.positive;
  if (rec === "not_ready") return C.negative;
  return C.warning; // ready_with_development / pending
}
export function scoreColor(n: number | null): string {
  if (n == null) return C.textMuted;
  return [, C.bar1, C.bar2, C.bar3, C.bar4, C.bar5][Math.round(n)] ?? C.bar3;
}

export const sh = StyleSheet.create({
  page: { paddingTop: 46, paddingBottom: 54, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 10, color: C.text },
  // Cover
  cover: { paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0, fontFamily: "Helvetica", backgroundColor: C.primary },
  coverBanner: { paddingTop: 80, paddingBottom: 56, paddingHorizontal: 60 },
  goldRule: { width: 36, height: 2, backgroundColor: C.gold, marginBottom: 18 },
  coverConfidential: { fontSize: 8, color: "#ffffff", opacity: 0.65, letterSpacing: 3, marginBottom: 22, textTransform: "uppercase" },
  coverEyebrow: { fontSize: 9, color: C.accent, letterSpacing: 2.5, marginBottom: 6, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  coverTitle: { fontSize: 30, color: "#ffffff", fontFamily: "Helvetica-Bold", marginBottom: 4, letterSpacing: -0.4 },
  coverSubtitle: { fontSize: 12, color: "#ffffff", opacity: 0.75 },
  namePill: { marginTop: 34, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  namePillText: { fontSize: 11, color: "#ffffff", fontFamily: "Helvetica-Bold", letterSpacing: 0.4 },
  coverDetails: { paddingHorizontal: 60, paddingTop: 26, paddingBottom: 24, backgroundColor: "rgba(255,255,255,0.04)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.10)" },
  coverDetailsHeading: { fontSize: 8, color: "#ffffff", opacity: 0.5, letterSpacing: 2.5, marginBottom: 12, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  coverRow: { flexDirection: "row", marginBottom: 7 },
  coverLabel: { width: 130, fontSize: 9, color: "#ffffff", opacity: 0.55 },
  coverValue: { fontSize: 9.5, color: "#ffffff", fontFamily: "Helvetica-Bold", flex: 1 },
  coverFooter: { position: "absolute", bottom: 30, left: 60, right: 60 },
  coverFooterText: { fontSize: 7, color: "#ffffff", opacity: 0.45, textAlign: "center", letterSpacing: 0.6 },
  // Section header
  eyebrow: { fontSize: 8, color: C.textLight, letterSpacing: 2, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 4 },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 8, letterSpacing: -0.2 },
  rule: { width: 24, height: 1.5, backgroundColor: C.accent, marginBottom: 12 },
  body: { fontSize: 9.5, lineHeight: 1.55, color: C.text, marginBottom: 8 },
  // Verdict callout
  verdictBox: { borderRadius: 5, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: C.border },
  verdictTop: { flexDirection: "row", alignItems: "baseline", marginBottom: 6 },
  verdictNum: { fontSize: 34, fontFamily: "Helvetica-Bold", marginRight: 10, letterSpacing: -0.6 },
  verdictRec: { fontSize: 13, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
  verdictText: { fontSize: 9.5, lineHeight: 1.55, color: C.text },
  // Stat strip
  statStrip: { flexDirection: "row", gap: 8, marginBottom: 16 },
  statTile: { flex: 1, padding: 10, backgroundColor: C.bgSoft, borderTopWidth: 2, borderTopColor: C.accent, borderRadius: 4, borderWidth: 0.5, borderColor: C.border },
  statLabel: { fontSize: 7.5, color: C.textLight, letterSpacing: 1.2, fontFamily: "Helvetica-Bold", marginBottom: 4, textTransform: "uppercase" },
  statValue: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.primary, lineHeight: 1, letterSpacing: -0.4 },
  statSuffix: { fontSize: 8, color: C.textLight, marginTop: 4 },
  // Competency matrix
  matRow: { flexDirection: "row", alignItems: "center", paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: C.borderSoft },
  matName: { width: 168, fontSize: 8.5, color: C.text, paddingRight: 6 },
  matCluster: { fontSize: 6.5, color: C.textMuted },
  matTrack: { flex: 1, height: 6, backgroundColor: C.borderSoft, borderRadius: 3, marginRight: 8 },
  matFill: { height: 6, borderRadius: 3 },
  matGap: { width: 118, alignItems: "flex-end" },
  pill: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 8, borderWidth: 0.5 },
  pillText: { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 0.2 },
  // Chips
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, marginRight: 5, marginBottom: 5, borderWidth: 0.5 },
  chipText: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 0.2 },
  // Panels
  panel: { borderRadius: 4, padding: 12, marginBottom: 10, borderWidth: 0.5, borderColor: C.border, borderLeftWidth: 3 },
  panelTitle: { fontSize: 8, letterSpacing: 1.2, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 6 },
  liRow: { flexDirection: "row", marginBottom: 5 },
  liGlyph: { width: 11, fontSize: 9, fontFamily: "Helvetica-Bold" },
  liText: { flex: 1, fontSize: 9, lineHeight: 1.45, color: C.text },
  liLabel: { fontFamily: "Helvetica-Bold", color: C.primary },
  // Footer
  footer: { position: "absolute", bottom: 26, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 0.5, borderTopColor: C.borderSoft, paddingTop: 6 },
  footerText: { fontSize: 7, color: C.textLight, letterSpacing: 0.5 },
  confidential: { fontSize: 7, color: C.negative, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  // Note box
  note: { backgroundColor: C.bgPanel, borderRadius: 4, padding: 11, borderWidth: 0.5, borderColor: C.border, marginTop: 4 },
  noteText: { fontSize: 8, lineHeight: 1.5, color: C.textLight },
});

export function CoverHero(props: {
  eyebrow: string; title: string; subtitle: string;
  candidateName: string; rows: Array<[string, string]>; audience: string;
}) {
  return (
    <View>
      <View style={sh.coverBanner}>
        <View style={sh.goldRule} />
        <Text style={sh.coverConfidential}>Strictly Confidential</Text>
        <Text style={sh.coverEyebrow}>{props.eyebrow}</Text>
        <Text style={sh.coverTitle}>{props.title}</Text>
        <Text style={sh.coverSubtitle}>{props.subtitle}</Text>
        <View style={sh.namePill}>
          <Text style={sh.namePillText}>{props.candidateName}</Text>
        </View>
      </View>
      <View style={sh.coverDetails}>
        <Text style={sh.coverDetailsHeading}>Assessment Detail</Text>
        {props.rows.map(([k, v]) => (
          <View style={sh.coverRow} key={k}>
            <Text style={sh.coverLabel}>{k}</Text>
            <Text style={sh.coverValue}>{v}</Text>
          </View>
        ))}
      </View>
      <View style={sh.coverFooter}>
        <Text style={sh.coverFooterText}>
          Virginia Institute of Finance and Management · VIFM Assessment Center · {props.audience}
        </Text>
      </View>
    </View>
  );
}

export function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View>
      <Text style={sh.eyebrow}>{eyebrow}</Text>
      <Text style={sh.title}>{title}</Text>
      <View style={sh.rule} />
    </View>
  );
}

export function Footer({ name, audience }: { name: string; audience: string }) {
  return (
    <View style={sh.footer} fixed>
      <Text style={sh.confidential}>STRICTLY CONFIDENTIAL</Text>
      <Text style={sh.footerText}>
        {name} · {audience} · VIFM Assessment Center
      </Text>
    </View>
  );
}

/** Competency table: name + cluster, a 5-segment score track, and a gap pill vs target. */
export function CompetencyMatrix({ competencies, target = 3 }: { competencies: ReportCompetencyData[]; target?: number }) {
  return (
    <View>
      {competencies.map((c) => {
        const score = c.consensusScore ?? 0;
        const gap = getCompetencyGap(score, target);
        const tone = gap ? GAP_TONES[gap.severity] : null;
        return (
          <View style={sh.matRow} key={c.competencyName} wrap={false}>
            <View style={sh.matName}>
              <Text>{c.competencyName}</Text>
              <Text style={sh.matCluster}>{c.domainName} · {c.clusterName}</Text>
            </View>
            <View style={sh.matTrack}>
              <View style={[sh.matFill, { width: `${(score / 5) * 100}%`, backgroundColor: scoreColor(score) }]} />
            </View>
            <View style={sh.matGap}>
              {gap && tone ? (
                <View style={[sh.pill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
                  <Text style={[sh.pillText, { color: tone.fg }]}>{score}/5 · {gap.label}</Text>
                </View>
              ) : (
                <Text style={{ fontSize: 7, color: C.textMuted }}>{score}/5</Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export type AudienceReportProps = { data: ReportData };
