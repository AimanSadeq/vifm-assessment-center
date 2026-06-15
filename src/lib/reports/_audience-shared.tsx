// Shared React-PDF primitives + brand tokens for the audience-specific AC
// reports (hiring-manager + talent-acquisition lenses). Kept visually aligned
// with candidate-report.tsx so the three reports read as one family.
import React from "react";
import { Text, View, Image, StyleSheet } from "@react-pdf/renderer";
import { readFileSync } from "fs";
import { join } from "path";
import { getCompetencyGap, GAP_TONES } from "@/lib/scoring/competency-gap";
import type { ReportData, ReportCompetencyData } from "./report-types";

// VIFM logo assets, inlined as data URIs so the same render path works from the
// build script and any server route. White wordmark for the navy cover; the
// full-colour wordmark for the white content pages. Server-only module.
function logoDataUri(file: string): string {
  try {
    const buf = readFileSync(join(process.cwd(), "public", "images", file));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}
const LOGO_WHITE = logoDataUri("vifm-logo-white.png"); // ratio ~3.14
const LOGO_COLOR = logoDataUri("vifm-logo-light.png"); // ratio ~2.56

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

// Selection-decision language: a hiring "fit" recommendation, NOT a hire/no-hire
// verdict. Maps the assessment outcome to a "recommend to pursue" framing.
const FIT_LABELS: Record<string, string> = {
  ready_now: "Recommend to pursue",
  ready_with_development: "Recommend to pursue, with a development plan",
  not_ready: "Not recommended to pursue at this stage",
};
const FIT_BAND: Record<string, string> = {
  ready_now: "Strong fit",
  ready_with_development: "Conditional fit",
  not_ready: "Limited fit",
};
export function fitLabel(rec: string | null): string {
  if (!rec) return "Under review";
  return FIT_LABELS[rec] ?? rec;
}
export function fitBand(rec: string | null): string {
  if (!rec) return "Pending";
  return FIT_BAND[rec] ?? "";
}
export const fitColor = recColor;
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
  matRow: { flexDirection: "row", alignItems: "center", paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: C.borderSoft },
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
    <View style={{ height: "100%" }}>
      <View style={sh.coverBanner}>
        {LOGO_WHITE ? <Image src={LOGO_WHITE} style={{ width: 150, height: 48, marginBottom: 26 }} /> : null}
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
          Virginia Institute of Finance and Management · Behavioural Psychometric Assessment · {props.audience}
        </Text>
      </View>
    </View>
  );
}

export function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={sh.eyebrow}>{eyebrow}</Text>
        <Text style={sh.title}>{title}</Text>
        <View style={sh.rule} />
      </View>
      {LOGO_COLOR ? <Image src={LOGO_COLOR} style={{ width: 84, height: 33, marginTop: 2 }} /> : null}
    </View>
  );
}

export function Footer({ name, audience }: { name: string; audience: string }) {
  return (
    <View style={sh.footer} fixed>
      <Text style={sh.confidential}>STRICTLY CONFIDENTIAL</Text>
      <Text style={sh.footerText}>
        {name} · {audience} · VIFM Behavioural Assessment
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

/**
 * Turns the headline selection numbers into plain-English narrative, computed
 * from the actual competencies (works for any candidate, not just the sample):
 *   - the fit score (what the average means vs the role bar)
 *   - how many competencies sit at/above the bar (and which)
 *   - how many sit below (and that below-bar = develop, not disqualify)
 *   - how many are clear strengths (and what a 4-5 actually signifies)
 */
export type DecisionPoint = { lead: string; text: string };

export function buildDecisionPoints(
  comps: ReportCompetencyData[],
  target: number,
  oar: number | null,
  rec: string | null,
): DecisionPoint[] {
  const total = comps.length;
  const atOrAbove = comps.filter((c) => (c.consensusScore ?? 0) >= target);
  const below = comps.filter((c) => (c.consensusScore ?? 0) < target);
  const strengths = comps
    .filter((c) => (c.consensusScore ?? 0) >= 4)
    .sort((a, b) => (b.consensusScore ?? 0) - (a.consensusScore ?? 0));
  const names = (xs: ReportCompetencyData[]) => xs.map((c) => c.competencyName).join(", ");
  const points: DecisionPoint[] = [];

  if (oar != null) {
    const rel =
      oar >= target + 1 ? "comfortably above" :
      oar >= target ? "above" :
      oar >= target - 0.5 ? "just below" : "below";
    points.push({
      lead: `Fit score ${oar.toFixed(1)} of 5.`,
      text:
        `The average result across all ${total} competencies, weighted to the role. At ${oar.toFixed(1)} it sits ` +
        `${rel} the Competent bar (3.0) - a ${fitBand(rec).toLowerCase()}. It summarises the rows below; it is ` +
        `not a pass mark.`,
    });
  }

  points.push({
    lead: `${atOrAbove.length} of ${total} above the bar.`,
    text: atOrAbove.length
      ? `The candidate meets or exceeds the role bar (Competent, ${target}/5) on ${atOrAbove.length} of ${total} ` +
        `competencies${atOrAbove.length <= 6 ? ` - ${names(atOrAbove)}` : ""}. That is how much of the role ` +
        `profile is already covered today.`
      : `No competency currently reaches the role bar (Competent, ${target}/5).`,
  });

  points.push({
    lead: below.length ? `${below.length} below the bar.` : "None below the bar.",
    text: below.length
      ? `${below.length === 1 ? "One competency falls" : `${below.length} competencies fall`} short of the bar - ` +
        `${names(below)}. Below-bar signals where development is indicated, not that the candidate is unsuitable; ` +
        `these are the areas to probe in interview and plan support for.`
      : `Every assessed competency meets or exceeds the bar - no development gaps were flagged.`,
  });

  points.push({
    lead: `${strengths.length} clear ${strengths.length === 1 ? "strength" : "strengths"}.`,
    text: strengths.length
      ? `${strengths.length === 1 ? "One competency was scored" : `${strengths.length} competencies were scored`} ` +
        `4 or 5 - ${names(strengths)}. A 4-5 (Strength / Significant Strength) means the behaviour showed ` +
        `consistently and beyond what the role requires: what the candidate brings from day one.`
      : `No competency reached the 4-5 strength band; the profile clusters around the Competent line.`,
  });

  return points;
}

/** Narrative readout that explains each headline number in one line. */
export function DecisionReadout({ points, tone = C.accent }: { points: DecisionPoint[]; tone?: string }) {
  return (
    <View wrap={false} style={[sh.panel, { borderLeftColor: tone }]}>
      <Text style={[sh.panelTitle, { color: tone }]}>Reading the result</Text>
      {points.map((p, i) => (
        <View style={sh.liRow} key={i}>
          <Text style={[sh.liGlyph, { color: tone }]}>{"•"}</Text>
          <Text style={sh.liText}>
            <Text style={sh.liLabel}>{p.lead} </Text>{p.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

// VIFM behavioural domain palette (matches the candidate skills dashboard).
export const DOMAIN_TONE: Record<string, string> = {
  THINKING: "#5391D5", RESULTS: "#059669", PEOPLE: "#D97706", SELF: "#7C3AED",
};

/** A 5-segment score bar (1-5), filled to the score and toned by band. */
export function ScoreDots({ score, height = 6 }: { score: number | null; height?: number }) {
  const s = score ?? 0;
  const col = scoreColor(s);
  return (
    <View style={{ flexDirection: "row" }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View
          key={n}
          style={{ width: 16, height, borderRadius: 2, marginRight: 2, backgroundColor: n <= s ? col : C.borderSoft }}
        />
      ))}
    </View>
  );
}

/** Domain section header: a colour chip + the domain name. */
export function DomainHeader({ name, marginTop = 10 }: { name: string; marginTop?: number }) {
  const tone = DOMAIN_TONE[name] ?? C.textLight;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop, marginBottom: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: tone, marginRight: 7 }} />
      <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: C.primary, letterSpacing: 0.5 }}>{name}</Text>
    </View>
  );
}

/** Group competencies by domain, preserving first-seen order. */
export function groupByDomain(comps: ReportCompetencyData[]): { name: string; items: ReportCompetencyData[] }[] {
  const out: { name: string; items: ReportCompetencyData[] }[] = [];
  for (const c of comps) {
    let g = out.find((x) => x.name === c.domainName);
    if (!g) { g = { name: c.domainName, items: [] }; out.push(g); }
    g.items.push(c);
  }
  return out;
}

// --- Band-based narrative generators (data-driven; weave per-competency band
// into plain prose so reports read well for any candidate, not just the sample).

/** Second-person "your result" line for the candidate report - consistently warm and direct. */
export function resultNarrative(c: ReportCompetencyData): string {
  const s = c.consensusScore ?? 0;
  if (s >= 5) return "You show real strength here - it is one of the clearest patterns in your results, and you sustain it even under pressure.";
  if (s === 4) return "You show strength here. You apply it consistently, and it is something colleagues can count on.";
  if (s === 3) return "You are solid here, meeting what the role asks in familiar situations. With more stretch, you could make this a signature strength.";
  if (s === 2) return "You have room to grow here. Your responses suggest it shows less consistently than the role expects, and focused practice will move it forward.";
  if (s === 1) return "You have clear room to grow here. It is not yet showing consistently, so it is a good place to focus your energy.";
  return "There was not enough evidence to rate this competency.";
}

/** Third-person "this candidate is likely to..." line for the TA report. */
export function behaviourPrediction(c: ReportCompetencyData): string {
  const s = c.consensusScore ?? 0;
  if (s >= 5) return "This candidate is very likely to demonstrate this consistently and beyond what the role requires - a clear differentiator.";
  if (s === 4) return "This candidate is likely to demonstrate this reliably and above the role bar.";
  if (s === 3) return "This candidate is likely to meet the role bar on this in most situations.";
  if (s === 2) return "This candidate may apply this less consistently than the role needs; targeted support is indicated.";
  if (s === 1) return "This candidate is likely to find this challenging without development; treat it as a priority gap.";
  return "Not enough evidence was gathered to predict behaviour on this competency.";
}

/** "Where they stand" development statement for the manager report. */
export function developmentStatement(c: ReportCompetencyData): string {
  const s = c.consensusScore ?? 0;
  if (s >= 4) return "A strength to build on. This is applied consistently and above the role bar - the goal is to extend it through stretch work and chances to model it for others.";
  if (s === 3) return "Solid and on target. Reliable in familiar situations; development here is about sustaining it under greater complexity and pressure.";
  if (s === 2) return "A development priority. This sits below the role bar today, so focused effort here will have the most impact.";
  if (s === 1) return "A high-priority development area. This is well below the role bar and deserves early, structured attention.";
  return "Not enough evidence was gathered to advise on this competency.";
}

/** Development tips for a competency: prefer stored tips, then evidence, then a band fallback. */
export function developmentTipsFor(c: ReportCompetencyData): string[] {
  if (c.developmentTips?.length) return c.developmentTips;
  const fromAreas = (c.developmentAreas ?? []).map((d) => d.text).filter(Boolean);
  if (fromAreas.length) return fromAreas;
  const s = c.consensusScore ?? 0;
  if (s >= 4) return [
    "Give them a stretch assignment that puts this strength to work on a harder problem.",
    "Ask them to coach a peer in this area - teaching it deepens the strength and spreads it.",
  ];
  return [
    "Agree one specific, observable behaviour to practise over the next 30 days.",
    "Build in feedback on it after key meetings or deliverables, and review what changed.",
    "Pair them with a colleague who is strong here and compare approaches.",
  ];
}

export type AudienceReportProps = { data: ReportData };
