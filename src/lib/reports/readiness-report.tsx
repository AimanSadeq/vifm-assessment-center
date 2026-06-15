import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Succession Readiness verdict PDF (English / React-PDF, Helvetica - no font
// registration needed). Mirrors the on-screen report at
// /admin/engagements/[id]/readiness/[candidateId]. Fed by computeCandidateReadiness.

const C = {
  primary: "#010131",
  accent: "#5391D5",
  text: "#121232",
  textLight: "#6b7280",
  border: "#e5e7eb",
  bgSoft: "#fafbfc",
  emerald: "#059669",
  sky: "#0284c7",
  amber: "#D97706",
  rose: "#E11D48",
  slate: "#64748b",
};

const TIER_COLOR: Record<string, string> = {
  ready_now: C.emerald,
  ready_soon: C.sky,
  developing: C.amber,
  not_ready: C.rose,
  insufficient_data: C.slate,
};

const FLAG_LABEL: Record<string, string> = {
  blind_spot: "Blind spot",
  hidden_strength: "Hidden strength",
  over_rater: "Over-rates self",
  under_rater: "Under-rates self",
  aligned: "Aligned",
};

const PRIORITY_LABEL: Record<string, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export type ReadinessPdfCompetency = {
  competencyId: string;
  name: string;
  priority: string;
  othersMean: number | null;
  target: number;
  gap: number | null;
  selfMean: number | null;
  selfFlag: string | null;
  knockoutTriggered: boolean;
  covered: boolean;
  lowAgreement: boolean;
};

export type ReadinessPdfData = {
  candidateName: string;
  engagementName: string;
  generatedAt: string;
  tierLabel: string;
  tierBlurb: string;
  status: string;
  weightedOthers: number | null;
  weightedTarget: number | null;
  overallGap: number | null;
  coveragePct: number;
  coveredCount: number;
  totalCount: number;
  knockoutApplied: boolean;
  borderline: boolean;
  borderlineNote: string | null;
  yearLabel: string | null;
  lowAgreementCount: number;
  competencies: ReadinessPdfCompetency[];
};

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 10, color: C.text },
  banner: { backgroundColor: C.primary, borderRadius: 6, paddingVertical: 18, paddingHorizontal: 20, marginBottom: 16 },
  eyebrow: { fontSize: 8, color: C.accent, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  title: { fontSize: 22, color: "#ffffff", fontFamily: "Helvetica-Bold", marginTop: 4 },
  subtitle: { fontSize: 11, color: "#ffffff", opacity: 0.8, marginTop: 2 },

  tierRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 },
  tierChip: { paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, color: "#ffffff", fontSize: 12, fontFamily: "Helvetica-Bold" },
  caveat: { fontSize: 8.5, color: C.amber, marginBottom: 8 },
  blurb: { fontSize: 10, color: C.textLight, marginBottom: 12 },

  statGrid: { flexDirection: "row", gap: 8, marginBottom: 14 },
  stat: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 5, padding: 9 },
  statLabel: { fontSize: 7.5, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 3 },

  knockout: { backgroundColor: "#fef2f2", color: C.rose, borderRadius: 4, padding: 7, fontSize: 9, marginBottom: 12 },

  twoCol: { flexDirection: "row", gap: 10, marginBottom: 14 },
  calloutBox: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 5, padding: 10 },
  calloutTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  calloutHint: { fontSize: 7.5, color: C.textLight, marginBottom: 5 },
  calloutItem: { fontSize: 9, marginBottom: 1.5 },

  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 6 },
  table: { borderWidth: 1, borderColor: C.border, borderRadius: 5 },
  th: { flexDirection: "row", backgroundColor: C.bgSoft, borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 5, paddingHorizontal: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.border, paddingVertical: 4.5, paddingHorizontal: 6 },
  thText: { fontSize: 7.5, color: C.textLight, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  cell: { fontSize: 9 },
  cName: { flex: 3 },
  cPrio: { flex: 1.4 },
  cNum: { flex: 1, textAlign: "right" },
  cFlag: { flex: 1.8 },

  footer: { position: "absolute", bottom: 24, left: 44, right: 44, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7.5, color: C.textLight },
});

const fmt = (n: number | null, d = 2) => (n == null ? "-" : n.toFixed(d));
const signed = (n: number | null) => (n == null ? "-" : (n >= 0 ? "+" : "") + n.toFixed(2));

export function ReadinessReportPdf({ data }: { data: ReadinessPdfData }) {
  const blindSpots = data.competencies.filter((c) => c.selfFlag === "blind_spot");
  const hiddenStrengths = data.competencies.filter((c) => c.selfFlag === "hidden_strength");
  const tierColor = TIER_COLOR[data.status] ?? C.slate;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.banner}>
          <Text style={s.eyebrow}>Succession Readiness</Text>
          <Text style={s.title}>{data.candidateName}</Text>
          <Text style={s.subtitle}>{data.engagementName}</Text>
        </View>

        <View style={s.tierRow}>
          <Text style={[s.tierChip, { backgroundColor: tierColor }]}>{data.tierLabel}</Text>
          {data.yearLabel ? <Text style={{ fontSize: 9, color: C.textLight }}>Horizon: {data.yearLabel}</Text> : null}
          {data.borderline ? <Text style={{ fontSize: 8.5, color: C.amber }}>Near-call</Text> : null}
        </View>
        {data.borderline && data.borderlineNote ? <Text style={s.caveat}>{data.borderlineNote}.</Text> : null}
        <Text style={s.blurb}>{data.tierBlurb}</Text>

        <View style={s.statGrid}>
          <View style={s.stat}><Text style={s.statLabel}>Weighted Others</Text><Text style={s.statValue}>{fmt(data.weightedOthers)}</Text></View>
          <View style={s.stat}><Text style={s.statLabel}>Role target</Text><Text style={s.statValue}>{fmt(data.weightedTarget)}</Text></View>
          <View style={s.stat}><Text style={s.statLabel}>Gap</Text><Text style={[s.statValue, { color: (data.overallGap ?? 0) >= 0 ? C.emerald : C.rose }]}>{signed(data.overallGap)}</Text></View>
          <View style={s.stat}><Text style={s.statLabel}>Coverage</Text><Text style={s.statValue}>{`${(data.coveragePct * 100).toFixed(0)}% (${data.coveredCount}/${data.totalCount})`}</Text></View>
        </View>

        {data.knockoutApplied ? (
          <Text style={s.knockout}>Tier capped by a high-priority knockout on a must-have competency.</Text>
        ) : null}

        {(blindSpots.length > 0 || hiddenStrengths.length > 0) && (
          <View style={s.twoCol}>
            <View style={s.calloutBox}>
              <Text style={[s.calloutTitle, { color: C.rose }]}>Blind spots</Text>
              <Text style={s.calloutHint}>Others rate below target while self rates at or above.</Text>
              {blindSpots.length ? blindSpots.map((c) => <Text key={c.competencyId} style={s.calloutItem}>{c.name}</Text>) : <Text style={[s.calloutItem, { color: C.textLight }]}>None</Text>}
            </View>
            <View style={s.calloutBox}>
              <Text style={[s.calloutTitle, { color: C.emerald }]}>Hidden strengths</Text>
              <Text style={s.calloutHint}>Others rate at or above target while self rates below.</Text>
              {hiddenStrengths.length ? hiddenStrengths.map((c) => <Text key={c.competencyId} style={s.calloutItem}>{c.name}</Text>) : <Text style={[s.calloutItem, { color: C.textLight }]}>None</Text>}
            </View>
          </View>
        )}

        <Text style={s.sectionTitle}>Competency detail</Text>
        {data.lowAgreementCount > 0 ? (
          <Text style={{ fontSize: 8, color: C.amber, marginBottom: 5 }}>
            {data.lowAgreementCount} competency(ies) show low rater agreement - interpret those with care.
          </Text>
        ) : null}
        <View style={s.table}>
          <View style={s.th} fixed>
            <Text style={[s.thText, s.cName]}>Competency</Text>
            <Text style={[s.thText, s.cPrio]}>Priority</Text>
            <Text style={[s.thText, s.cNum]}>Others</Text>
            <Text style={[s.thText, s.cNum]}>Target</Text>
            <Text style={[s.thText, s.cNum]}>Gap</Text>
            <Text style={[s.thText, s.cNum]}>Self</Text>
            <Text style={[s.thText, s.cFlag]}>Flag</Text>
          </View>
          {data.competencies.map((c) => {
            const gapColor = c.gap == null ? C.text : c.gap >= 0 ? C.emerald : c.gap <= -1 ? C.rose : C.amber;
            const flag = c.knockoutTriggered ? "Knockout" : c.selfFlag ? FLAG_LABEL[c.selfFlag] ?? c.selfFlag : "-";
            return (
              <View key={c.competencyId} style={[s.tr, { opacity: c.covered ? 1 : 0.55 }]} wrap={false}>
                <Text style={[s.cell, s.cName]}>{c.name}{c.lowAgreement ? "  (low agreement)" : ""}</Text>
                <Text style={[s.cell, s.cPrio, { color: C.textLight }]}>{PRIORITY_LABEL[c.priority] ?? c.priority}</Text>
                <Text style={[s.cell, s.cNum]}>{fmt(c.othersMean)}</Text>
                <Text style={[s.cell, s.cNum]}>{c.target.toFixed(1)}</Text>
                <Text style={[s.cell, s.cNum, { color: gapColor }]}>{signed(c.gap)}</Text>
                <Text style={[s.cell, s.cNum, { color: C.textLight }]}>{fmt(c.selfMean)}</Text>
                <Text style={[s.cell, s.cFlag, { color: c.knockoutTriggered ? C.rose : C.text }]}>{flag}</Text>
              </View>
            );
          })}
        </View>

        {data.status === "insufficient_data" ? (
          <Text style={{ marginTop: 10, fontSize: 8.5, color: C.textLight }}>
            Insufficient data - too few rated competencies to assert a readiness tier. Add raters or complete the assessments, then recompute.
          </Text>
        ) : null}

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Virginia Institute of Finance and Management - Confidential</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Generated ${data.generatedAt}  -  ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
