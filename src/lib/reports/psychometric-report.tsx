import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

/**
 * VIFM Psychometrics - professional result report (React-PDF, English).
 *
 * Renders one completed cognitive or personality result. When the instrument is
 * CALIBRATED (a norm group ≥ the minimum exists for every scale) each scale shows
 * a percentile + a 1–10 sten band; otherwise it shows the indicative raw-score
 * band only and says so plainly. Personality results carry a validity statement.
 * Every page states the tier so the report can never over-claim its own rigour.
 *
 * English-only for now (same stance as the Personal Snapshot - React-PDF doesn't
 * shape Arabic; a Puppeteer port can follow when bilingual is prioritised).
 */

const C = {
  primary: "#010131",
  accent: "#5391D5",
  indigo: "#4338ca",
  text: "#121232",
  textLight: "#6b7280",
  textMuted: "#9ca3af",
  bgSoft: "#f7f8fb",
  border: "#e5e7eb",
  track: "#eef1f6",
  positive: "#059669",
  warning: "#D97706",
  negative: "#E11D48",
};

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 50, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 10, color: C.text },

  hero: { backgroundColor: C.primary, color: "#fff", padding: 22, borderRadius: 6, marginBottom: 16 },
  heroEyebrow: { fontSize: 8, color: "#fff", opacity: 0.7, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 },
  heroTitle: { fontSize: 20, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 4 },
  heroIdentity: { fontSize: 10.5, color: "#fff", opacity: 0.85 },
  heroPillRow: { flexDirection: "row", gap: 6, marginTop: 12 },
  heroPill: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#fff", backgroundColor: "rgba(255,255,255,0.18)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, letterSpacing: 1, textTransform: "uppercase" },

  sectionEyebrow: { fontSize: 8, color: C.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4, fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 6 },
  sectionRule: { width: 24, height: 1.5, backgroundColor: C.accent, marginBottom: 10 },

  legendBox: { borderWidth: 0.5, borderColor: C.border, borderRadius: 4, padding: 10, marginBottom: 16, backgroundColor: C.bgSoft },
  legendTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 4 },
  legendBody: { fontSize: 8.5, color: C.textLight, lineHeight: 1.5 },

  // scale card
  scaleCard: { borderWidth: 0.5, borderColor: C.border, borderRadius: 4, padding: 11, marginBottom: 8 },
  scaleTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 3 },
  scaleName: { fontSize: 11.5, fontFamily: "Helvetica-Bold", color: C.primary },
  bandPill: { fontSize: 7.5, fontFamily: "Helvetica-Bold", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  scaleStatRow: { flexDirection: "row", alignItems: "baseline", gap: 14, marginTop: 2, marginBottom: 6 },
  scaleStat: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  scaleStatNum: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.indigo },
  scaleStatLabel: { fontSize: 7.5, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.5 },

  // sten band (1-10)
  stenWrap: { marginTop: 4, marginBottom: 4 },
  stenRow: { flexDirection: "row", gap: 2 },
  stenCell: { flex: 1, height: 12, borderRadius: 2, alignItems: "center", justifyContent: "center" },
  stenCellText: { fontSize: 6.5, color: "#fff", fontFamily: "Helvetica-Bold" },
  stenScale: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  stenScaleText: { fontSize: 6, color: C.textMuted },

  // percentile bar
  pctTrack: { height: 7, backgroundColor: C.track, borderRadius: 4, marginTop: 4, position: "relative" },
  pctFill: { height: 7, backgroundColor: C.accent, borderRadius: 4 },

  predicts: { fontSize: 7.5, color: C.textMuted, marginTop: 6, fontStyle: "italic" },
  scaleDefinition: { fontSize: 8, color: C.textLight, lineHeight: 1.5, marginTop: 4 },
  scaleNarrative: { fontSize: 8, color: C.text, fontFamily: "Helvetica-Bold", lineHeight: 1.5, marginTop: 3 },

  // validity / disclaimer panels
  panel: { borderWidth: 0.5, borderColor: C.border, borderRadius: 4, padding: 11, marginBottom: 10, backgroundColor: C.bgSoft },
  panelTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 4 },
  panelBody: { fontSize: 8.5, color: C.textLight, lineHeight: 1.5 },
  validityRow: { flexDirection: "row", gap: 16, marginTop: 4, marginBottom: 4 },
  validityStat: { flexDirection: "column" },
  validityNum: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.primary },
  validityLabel: { fontSize: 7.5, color: C.textLight },

  disclaimerBox: { borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 10, marginTop: 4 },
  disclaimerTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 3 },
  disclaimerBody: { fontSize: 8, color: C.textLight, lineHeight: 1.5 },

  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", paddingTop: 8, borderTopWidth: 0.5, borderTopColor: C.border },
  footerText: { fontSize: 8, color: C.textMuted },
});

export type PsyReportScale = {
  key: string;
  name: string;
  predicts: string[];
  raw: number;        // cognitive: % correct; personality: 1–5 mean
  rawLabel: string;   // e.g. "62%" or "3.4 / 5"
  band: "low" | "below" | "average" | "above" | "high";
  bandLabel: string;
  sten?: number;
  percentile?: number;
  /** Fuller "what this measures" definition (cognitive subtests). */
  definition?: string;
  /** Score-band narrative for this scale. */
  narrative?: string;
};

export type PsyReportData = {
  kind: "cognitive" | "personality";
  instrumentName: string;
  takerName: string;
  date: string;
  tier: "indicative" | "calibrated";
  normSource?: string | null;
  scales: PsyReportScale[];
  overall?: { label: string; normalized: number; bandLabel: string; percentile?: number };
  validity?: { socialDesirability: number; inconsistency: number; flag: boolean };
};

const BAND_TONE: Record<PsyReportScale["band"], { bg: string; fg: string }> = {
  low: { bg: "#fee2e2", fg: "#991b1b" },
  below: { bg: "#fef3c7", fg: "#92400e" },
  average: { bg: "#e5e7eb", fg: "#374151" },
  above: { bg: "#dbeafe", fg: "#1e40af" },
  high: { bg: "#dcfce7", fg: "#166534" },
};

function stenTone(i: number): string {
  // 1-4 low (amber), 5-6 mid (slate), 7-10 high (blue→green)
  if (i <= 4) return "#fbbf24";
  if (i <= 6) return "#94a3b8";
  if (i <= 8) return "#5391D5";
  return "#059669";
}

function StenBand({ sten }: { sten: number }) {
  return (
    <View style={s.stenWrap}>
      <View style={s.stenRow}>
        {Array.from({ length: 10 }, (_, idx) => {
          const n = idx + 1;
          const active = n === sten;
          return (
            <View key={n} style={[s.stenCell, { backgroundColor: active ? stenTone(n) : "#eef1f6" }]}>
              <Text style={[s.stenCellText, { color: active ? "#fff" : "#cbd5e1" }]}>{n}</Text>
            </View>
          );
        })}
      </View>
      <View style={s.stenScale}>
        <Text style={s.stenScaleText}>Low (1)</Text>
        <Text style={s.stenScaleText}>Average (5–6)</Text>
        <Text style={s.stenScaleText}>High (10)</Text>
      </View>
    </View>
  );
}

export function PsychometricReport({ data }: { data: PsyReportData }) {
  const calibrated = data.tier === "calibrated";
  return (
    <Document title={`VIFM Psychometric Report - ${data.takerName}`} author="VIFM Assessment Center" subject={data.instrumentName}>
      <Page size="A4" style={s.page} wrap>
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroEyebrow}>VIFM Psychometrics® · Foundations</Text>
          <Text style={s.heroTitle}>{data.instrumentName}®</Text>
          <Text style={s.heroIdentity}>{data.takerName} · {data.date}</Text>
          <View style={s.heroPillRow}>
            <Text style={s.heroPill}>{calibrated ? "Tier 2 · Norm-referenced" : "Tier 1 · Indicative"}</Text>
            <Text style={s.heroPill}>{data.kind === "cognitive" ? "Logical®" : "Personality · Big Five"}</Text>
          </View>
        </View>

        {/* How to read */}
        <View style={s.legendBox}>
          <Text style={s.legendTitle}>How to read this report</Text>
          <Text style={s.legendBody}>
            {calibrated
              ? `Each scale is reported as a percentile and a sten (standard-ten) score relative to the VIFM reference group${data.normSource ? ` (${data.normSource})` : ""}. A percentile of 70 means the result is at or above 70% of that group; stens run 1–10 with 5–6 as the average band. ${data.kind === "cognitive" ? "Higher is stronger." : "Scores reflect typical disposition, not ability - there is no 'good' or 'bad' profile."}`
              : `This is an INDICATIVE result: scales are reported as raw-score bands, not norm-referenced percentiles. Percentiles and stens become available once a calibrated norm group is established. ${data.kind === "cognitive" ? "Bands reflect % correct." : "Bands reflect the 1–5 self-report mean per trait."}`}
          </Text>
        </View>

        {/* Scales */}
        <Text style={s.sectionEyebrow}>Results</Text>
        <Text style={s.sectionTitle}>{data.kind === "cognitive" ? "Reasoning subtests" : "Big-Five traits"}</Text>
        <View style={s.sectionRule} />

        {data.scales.map((sc) => {
          const tone = BAND_TONE[sc.band];
          return (
            <View key={sc.key} style={s.scaleCard} wrap={false}>
              <View style={s.scaleTopRow}>
                <Text style={s.scaleName}>{sc.name}</Text>
                <Text style={[s.bandPill, { backgroundColor: tone.bg, color: tone.fg }]}>{sc.bandLabel.toUpperCase()}</Text>
              </View>
              <View style={s.scaleStatRow}>
                <View style={s.scaleStat}>
                  <Text style={s.scaleStatNum}>{sc.rawLabel}</Text>
                  <Text style={s.scaleStatLabel}>raw</Text>
                </View>
                {calibrated && sc.percentile != null && (
                  <View style={s.scaleStat}>
                    <Text style={s.scaleStatNum}>{Math.round(sc.percentile)}</Text>
                    <Text style={s.scaleStatLabel}>percentile</Text>
                  </View>
                )}
                {calibrated && sc.sten != null && (
                  <View style={s.scaleStat}>
                    <Text style={s.scaleStatNum}>{sc.sten}</Text>
                    <Text style={s.scaleStatLabel}>sten</Text>
                  </View>
                )}
              </View>

              {calibrated && sc.sten != null && <StenBand sten={sc.sten} />}
              {calibrated && sc.percentile != null && (
                <View style={s.pctTrack}>
                  <View style={[s.pctFill, { width: `${Math.max(2, Math.min(100, sc.percentile))}%` }]} />
                </View>
              )}

              {sc.definition && <Text style={s.scaleDefinition}>{sc.definition}</Text>}
              {sc.narrative && <Text style={s.scaleNarrative}>{sc.narrative}</Text>}

              {sc.predicts.length > 0 && (
                <Text style={s.predicts}>Predicts (foundations): {sc.predicts.join(" · ")}</Text>
              )}
            </View>
          );
        })}

        {/* Overall (cognitive g) */}
        {data.overall && (
          <View style={[s.scaleCard, { borderColor: C.accent }]} wrap={false}>
            <View style={s.scaleTopRow}>
              <Text style={s.scaleName}>{data.overall.label}</Text>
              <Text style={[s.bandPill, { backgroundColor: "#e0e7ff", color: "#3730a3" }]}>{data.overall.bandLabel.toUpperCase()}</Text>
            </View>
            <View style={s.scaleStatRow}>
              <View style={s.scaleStat}>
                <Text style={s.scaleStatNum}>{Math.round(data.overall.normalized)}</Text>
                <Text style={s.scaleStatLabel}>composite (0–100)</Text>
              </View>
              {calibrated && data.overall.percentile != null && (
                <View style={s.scaleStat}>
                  <Text style={s.scaleStatNum}>{Math.round(data.overall.percentile)}</Text>
                  <Text style={s.scaleStatLabel}>percentile</Text>
                </View>
              )}
            </View>
          </View>
        )}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>VIFM Psychometrics® · {calibrated ? "Norm-referenced" : "Indicative"} report</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* Page 2 - validity, interpretation, methodology */}
      <Page size="A4" style={s.page} wrap>
        <Text style={s.sectionEyebrow}>Interpretation</Text>
        <Text style={s.sectionTitle}>Reading this result responsibly</Text>
        <View style={s.sectionRule} />

        {data.validity && (
          <View style={s.panel}>
            <Text style={s.panelTitle}>Response validity</Text>
            <View style={s.validityRow}>
              <View style={s.validityStat}>
                <Text style={s.validityNum}>{data.validity.socialDesirability.toFixed(2)}</Text>
                <Text style={s.validityLabel}>Social desirability (1–5)</Text>
              </View>
              <View style={s.validityStat}>
                <Text style={s.validityNum}>{data.validity.inconsistency.toFixed(2)}</Text>
                <Text style={s.validityLabel}>Inconsistency</Text>
              </View>
              <View style={s.validityStat}>
                <Text style={[s.validityNum, { color: data.validity.flag ? C.warning : C.positive }]}>
                  {data.validity.flag ? "Review" : "Clear"}
                </Text>
                <Text style={s.validityLabel}>Overall flag</Text>
              </View>
            </View>
            <Text style={s.panelBody}>
              {data.validity.flag
                ? "One or more validity indicators are elevated (uniformly high self-ratings, or inconsistent answers to similar items). Treat the profile with caution and corroborate it in conversation before relying on it."
                : "Validity indicators are within the normal range - no evidence of uniformly inflated self-ratings or careless responding. The profile can be read at face value, alongside other evidence."}
            </Text>
          </View>
        )}

        <View style={s.panel}>
          <Text style={s.panelTitle}>What this is - and isn&apos;t</Text>
          <Text style={s.panelBody}>
            This instrument sits in the Foundations layer of the VIFM measurement model: {data.kind === "cognitive" ? "reasoning ability" : "personality"} is a
            disposition that <Text style={{ fontFamily: "Helvetica-Bold" }}>predicts</Text> behavioural competency - it does not measure it directly. Use this result as
            one input that informs a human judgement (development planning, selection short-listing, succession discussion), never as an automatic decision. It
            yields a score and a profile - <Text style={{ fontFamily: "Helvetica-Bold" }}>not</Text> a pass/fail credential.
          </Text>
        </View>

        <View style={s.disclaimerBox}>
          <Text style={s.disclaimerTitle}>Methodology &amp; limits</Text>
          <Text style={s.disclaimerBody}>
            {data.kind === "cognitive"
              ? "Logical is estimated from numerical, verbal, inductive and deductive reasoning items, scored as % correct per subtest with a general (g) composite. "
              : "Personality is measured with public-domain Big-Five (IPIP) self-report items on a 1–5 Likert scale, reverse-keyed and averaged per trait, with social-desirability and inconsistency validity checks. "}
            {calibrated
              ? `Scores are norm-referenced against a calibrated reference sample${data.normSource ? ` (${data.normSource})` : ""}; percentiles and stens are derived from that distribution. Local norms should still be reviewed periodically for representativeness and fairness.`
              : "This run is INDICATIVE - there is no local norm group yet, so results are reported as raw-score bands rather than percentiles. As a representative sample accumulates, the same instrument becomes norm-referenced (Tier 2) without re-testing."}
            {" "}Validated high-stakes use additionally requires a criterion-validity study, adverse-impact (fairness) analysis, and a qualified psychometrician&apos;s sign-off.
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generated {data.date} · Virginia Institute of Finance &amp; Management</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
