import { Document, Page, Text, View, StyleSheet, Svg, Rect, Line, Circle } from "@react-pdf/renderer";
import type { LeadershipPdfData } from "@/lib/reports/persona-leadership-data";
import type { LeadershipRow } from "@/lib/reports/persona-leadership-dimensions";
import { LEADERSHIP_MIDPOINT } from "@/lib/reports/persona-leadership-dimensions";

// Persona Leadership Report (English / React-PDF). Translates the 41-competency
// self-assessment into a management (transactional) vs leadership
// (transformational) orientation, a 2x2 matrix, and a competency-by-competency
// breakdown. Self-report only - an orientation lens, not a validated typology.

const C = {
  primary: "#010131",
  mgmt: "#5391D5", // management / transactional (blue)
  lead: "#c026d3", // leadership / transformational (magenta)
  text: "#121232",
  textLight: "#6b7280",
  border: "#e5e7eb",
  bgSoft: "#fafbfc",
  emerald: "#059669",
  sky: "#0284c7",
  amber: "#D97706",
};

const band = (v: number) => (v >= 4 ? C.emerald : v >= 3 ? C.sky : C.amber);
const dimHex = (d: "management" | "leadership") => (d === "management" ? C.mgmt : C.lead);
const dimShort = (d: "management" | "leadership") => (d === "management" ? "Management" : "Leadership");

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 48, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 10, color: C.text },
  banner: { backgroundColor: C.primary, borderRadius: 6, paddingVertical: 18, paddingHorizontal: 20, marginBottom: 16 },
  eyebrow: { fontSize: 8, color: C.lead, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  title: { fontSize: 21, color: "#ffffff", fontFamily: "Helvetica-Bold", marginTop: 4 },
  subtitle: { fontSize: 11, color: "#ffffff", opacity: 0.8, marginTop: 2 },

  section: { marginBottom: 14 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 6 },
  para: { fontSize: 9.5, lineHeight: 1.5, color: C.text },

  styleCard: { borderWidth: 1, borderColor: C.lead, borderRadius: 6, padding: 12, backgroundColor: "#fdf4ff", marginBottom: 12 },
  styleLabel: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.primary },
  styleBlurb: { fontSize: 9.5, lineHeight: 1.5, color: C.text, marginTop: 4 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  stat: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 10, backgroundColor: C.bgSoft },
  statLabel: { fontSize: 8, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.6 },
  statValue: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 2 },
  statSub: { fontSize: 8, color: C.textLight, marginTop: 1 },

  matrixWrap: { flexDirection: "row", gap: 16, alignItems: "center", marginBottom: 6 },
  matrixBox: { position: "relative", width: 220, height: 220 },
  qLabel: { position: "absolute", fontSize: 7.5, fontFamily: "Helvetica-Bold", color: C.textLight, width: 96 },
  axisX: { textAlign: "center", fontSize: 8, color: C.mgmt, fontFamily: "Helvetica-Bold", marginTop: 2, width: 220 },

  row: { marginBottom: 6, paddingBottom: 5, borderBottomWidth: 0.5, borderBottomColor: C.border },
  rowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowNameWrap: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  rowName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.text },
  tag: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: "#ffffff", paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 3, textTransform: "uppercase", letterSpacing: 0.4 },
  rowScore: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  rowDef: { fontSize: 8, color: C.textLight, marginTop: 2, lineHeight: 1.4 },

  pill: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 0.5, borderColor: C.border, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 7, marginBottom: 4, backgroundColor: "#ffffff" },
  pillName: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.text },

  footer: { position: "absolute", bottom: 24, left: 44, right: 44, fontSize: 7.5, color: C.textLight, textAlign: "center", borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6, lineHeight: 1.4 },
});

/** The 2x2 Leadership/Management matrix. X = management, Y = leadership (1-5). */
function Matrix({ management, leadership }: { management: number; leadership: number }) {
  const SIZE = 220;
  const pad = 8;
  const inner = SIZE - pad * 2;
  const clamp = (v: number) => Math.max(1, Math.min(5, v));
  const px = pad + ((clamp(management) - 1) / 4) * inner;
  const py = pad + inner - ((clamp(leadership) - 1) / 4) * inner; // invert Y
  const midX = pad + ((LEADERSHIP_MIDPOINT - 1) / 4) * inner;
  const midY = pad + inner - ((LEADERSHIP_MIDPOINT - 1) / 4) * inner;

  return (
    <View style={s.matrixBox}>
      <Svg width={SIZE} height={SIZE}>
        <Rect x={pad} y={pad} width={inner} height={inner} fill="#ffffff" stroke={C.border} strokeWidth={1} />
        {/* quadrant divider lines at the midpoint */}
        <Line x1={midX} y1={pad} x2={midX} y2={pad + inner} stroke={C.border} strokeWidth={0.8} strokeDasharray="2 2" />
        <Line x1={pad} y1={midY} x2={pad + inner} y2={midY} stroke={C.border} strokeWidth={0.8} strokeDasharray="2 2" />
        {/* the candidate's plotted position */}
        <Circle cx={px} cy={py} r={6} fill={C.primary} stroke="#ffffff" strokeWidth={1.5} />
        <Circle cx={px} cy={py} r={11} fill="none" stroke={C.lead} strokeWidth={1} />
      </Svg>
      {/* quadrant labels (top-left = high leadership/low mgmt, etc.) */}
      <Text style={[s.qLabel, { top: 12, left: 12 }]}>Visionary{"\n"}(high leadership)</Text>
      <Text style={[s.qLabel, { top: 12, right: 12, textAlign: "right" }]}>Integrated{"\n"}(high both)</Text>
      <Text style={[s.qLabel, { bottom: 26, left: 12 }]}>Emerging{"\n"}(low both)</Text>
      <Text style={[s.qLabel, { bottom: 26, right: 12, textAlign: "right" }]}>Operational{"\n"}(high management)</Text>
      <Text style={s.axisX}>Management (transactional) ▶</Text>
    </View>
  );
}

function DetailRow({ r }: { r: LeadershipRow }) {
  return (
    <View style={s.row} wrap={false}>
      <View style={s.rowHead}>
        <View style={s.rowNameWrap}>
          <Text style={s.rowName}>{r.name}</Text>
          <Text style={[s.tag, { backgroundColor: dimHex(r.dimension) }]}>{dimShort(r.dimension)}</Text>
        </View>
        <Text style={[s.rowScore, { color: band(r.score) }]}>{r.score.toFixed(2)}</Text>
      </View>
      {r.definition ? <Text style={s.rowDef}>{r.definition}</Text> : null}
    </View>
  );
}

export function LeadershipReportPdf({ data }: { data: LeadershipPdfData }) {
  const p = data.profile;
  const orientationWord =
    p.orientation >= 0.4 ? "leans transformational (leadership)" : p.orientation <= -0.4 ? "leans transactional (management)" : "is balanced across both";
  const dominant = p.leadership >= p.management ? "leadership (transformational)" : "management (transactional)";

  return (
    <Document>
      {/* ── Page 1: Executive Summary + Matrix + Summary ── */}
      <Page size="A4" style={s.page}>
        <View style={s.banner}>
          <Text style={s.eyebrow}>VIFM Persona® · Leadership Report</Text>
          <Text style={s.title}>Leadership Orientation Profile</Text>
          <Text style={s.subtitle}>
            {(data.takerName || "Anonymous")} · {data.generatedAt}
          </Text>
        </View>

        {/* 1. Executive Summary */}
        <View style={s.section}>
          <Text style={s.h2}>1 · Executive Summary</Text>
          <View style={s.styleCard}>
            <Text style={s.styleLabel}>{p.styleLabel}</Text>
            <Text style={s.styleBlurb}>{p.styleBlurb}</Text>
          </View>
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Text style={[s.statLabel, { color: C.lead }]}>Leadership (transformational)</Text>
              <Text style={[s.statValue, { color: band(p.leadership) }]}>{p.leadership.toFixed(2)}</Text>
              <Text style={s.statSub}>mean of {p.leadershipCount} competencies · out of 5</Text>
            </View>
            <View style={s.stat}>
              <Text style={[s.statLabel, { color: C.mgmt }]}>Management (transactional)</Text>
              <Text style={[s.statValue, { color: band(p.management) }]}>{p.management.toFixed(2)}</Text>
              <Text style={s.statSub}>mean of {p.managementCount} competencies · out of 5</Text>
            </View>
            <View style={s.stat}>
              <Text style={s.statLabel}>Overall</Text>
              <Text style={[s.statValue, { color: band(data.overall) }]}>{data.overall.toFixed(2)}</Text>
              <Text style={s.statSub}>all 41 · out of 5</Text>
            </View>
          </View>
          <Text style={s.para}>
            {(data.takerName || "This individual")}&rsquo;s self-assessment {orientationWord}: a leadership score of{" "}
            {p.leadership.toFixed(2)} against a management score of {p.management.toFixed(2)} (out of 5). The dominant orientation is{" "}
            {dominant}. The matrix below plots this position; the breakdown that follows shows every competency, its definition, and the
            dimension it belongs to.
          </Text>
        </View>

        {/* 4. Leadership/Management Matrix */}
        <View style={s.section} wrap={false}>
          <Text style={s.h2}>2 · Leadership / Management Matrix</Text>
          <View style={s.matrixWrap}>
            <Matrix management={p.management} leadership={p.leadership} />
            <View style={{ flex: 1 }}>
              <Text style={[s.para, { marginBottom: 6 }]}>
                The X-axis is management (transactional) orientation; the Y-axis is leadership (transformational) orientation. The marked
                point is this individual&rsquo;s self-assessed position.
              </Text>
              <Text style={[s.para, { fontFamily: "Helvetica-Bold", color: C.primary }]}>Preferred style: {p.styleLabel}</Text>
              <Text style={[s.statSub, { marginTop: 6 }]}>
                High/low is split at the {LEADERSHIP_MIDPOINT.toFixed(1)} scale midpoint (moves to the norm median once a Persona norm
                sample exists).
              </Text>
            </View>
          </View>
        </View>

        {/* 3. Leadership Potential Summary */}
        <View style={s.section}>
          <Text style={s.h2}>3 · Leadership Potential Summary</Text>
          <Text style={[s.statLabel, { marginBottom: 4 }]}>Dominant tendencies (highest self-ratings)</Text>
          {p.topStrengths.map((r) => (
            <View key={r.id} style={s.pill}>
              <View style={s.rowNameWrap}>
                <Text style={s.pillName}>{r.name}</Text>
                <Text style={[s.tag, { backgroundColor: dimHex(r.dimension) }]}>{dimShort(r.dimension)}</Text>
              </View>
              <Text style={[s.rowScore, { color: band(r.score) }]}>{r.score.toFixed(2)}</Text>
            </View>
          ))}
          <Text style={[s.statLabel, { marginBottom: 4, marginTop: 6 }]}>Development areas (lowest self-ratings)</Text>
          {p.topDevelopment.map((r) => (
            <View key={r.id} style={s.pill}>
              <View style={s.rowNameWrap}>
                <Text style={s.pillName}>{r.name}</Text>
                <Text style={[s.tag, { backgroundColor: dimHex(r.dimension) }]}>{dimShort(r.dimension)}</Text>
              </View>
              <Text style={[s.rowScore, { color: band(r.score) }]}>{r.score.toFixed(2)}</Text>
            </View>
          ))}
        </View>

        <Text style={s.footer} fixed>
          Self-report orientation lens, mapped to the transactional/transformational (Bass &amp; Avolio) model - not a validated leadership
          typology or a selection tool. Triangulate with a Reflect 360° (others&rsquo; view) before any leadership-readiness conclusion.
          Indicative until a Persona norm sample exists. © VIFM.
        </Text>
      </Page>

      {/* ── Page 2: Competency-by-competency details ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>4 · Leadership Potential Details</Text>
        <Text style={[s.para, { marginBottom: 10 }]}>
          Every competency with its self-rating (out of 5), short definition, and dimension tag, grouped by dimension and ordered by
          score.
        </Text>

        <Text style={[s.h2, { color: C.lead, fontSize: 11 }]}>Leadership (transformational) · {p.leadershipCount}</Text>
        {p.leadershipRows.map((r) => (
          <DetailRow key={r.id} r={r} />
        ))}

        <Text style={[s.h2, { color: C.mgmt, fontSize: 11, marginTop: 12 }]}>Management (transactional) · {p.managementCount}</Text>
        {p.managementRows.map((r) => (
          <DetailRow key={r.id} r={r} />
        ))}

        <Text style={s.footer} fixed>
          Self-report orientation lens, mapped to the transactional/transformational (Bass &amp; Avolio) model - not a validated leadership
          typology or a selection tool. Triangulate with a Reflect 360° before any leadership-readiness conclusion. © VIFM.
        </Text>
      </Page>
    </Document>
  );
}
