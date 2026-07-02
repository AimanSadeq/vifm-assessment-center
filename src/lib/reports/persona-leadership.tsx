import { Document, Page, Text, View, StyleSheet, Svg, Rect, Line, Circle, G } from "@react-pdf/renderer";
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
  // paddingBottom must clear the fixed footer's zone (bottom 24 + ~3 wrapped
  // lines + border ≈ 66pt), or page content renders THROUGH the footer text.
  page: { paddingTop: 44, paddingBottom: 80, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 10, color: C.text },
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

  matrixWrap: { alignItems: "center", marginBottom: 8 },

  row: { marginBottom: 6, paddingBottom: 5, borderBottomWidth: 0.5, borderBottomColor: C.border },
  rowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowNameWrap: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  rowName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.text },
  tag: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: "#ffffff", paddingHorizontal: 4, paddingVertical: 1.5, borderRadius: 3, textTransform: "uppercase", letterSpacing: 0.4 },
  rowScore: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  rowDef: { fontSize: 8, color: C.textLight, marginTop: 2, lineHeight: 1.4 },

  pill: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 0.5, borderColor: C.border, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 7, marginBottom: 4, backgroundColor: "#ffffff" },
  pillName: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.text },

  devItem: { marginBottom: 8, borderWidth: 0.5, borderColor: C.border, borderRadius: 5, padding: 8, backgroundColor: C.bgSoft },
  devHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  tipRow: { flexDirection: "row", marginBottom: 2.5 },
  tipBullet: { fontSize: 8.5, color: C.lead, marginRight: 5, fontFamily: "Helvetica-Bold" },
  tipText: { fontSize: 8.5, color: C.text, flex: 1, lineHeight: 1.4 },
  tipEmpty: { fontSize: 8.5, color: C.textLight, fontStyle: "italic" },

  footer: { position: "absolute", bottom: 24, left: 44, right: 44, fontSize: 7.5, color: C.textLight, textAlign: "center", borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6, lineHeight: 1.4 },
});

/**
 * The 2x2 Leadership/Management matrix, drawn entirely in SVG: quadrant tints,
 * integer gridlines, a bold midpoint cross, tick numbers (1-5) on both axes, and
 * rotated X (Management) / Y (Leadership) axis labels. X = management,
 * Y = leadership, each 1-5.
 */
function Matrix({ management, leadership }: { management: number; leadership: number }) {
  const W = 250;
  const H = 214;
  const cl = 28; // chart left (room for Y axis label + ticks)
  const ct = 10; // chart top
  const cw = 200; // chart width
  const ch = 168; // chart height
  const cr = cl + cw; // chart right
  const cb = ct + ch; // chart bottom
  const clamp = (v: number) => Math.max(1, Math.min(5, v));
  const X = (v: number) => cl + ((v - 1) / 4) * cw;
  const Y = (v: number) => cb - ((v - 1) / 4) * ch; // invert Y (5 at top)
  const px = X(clamp(management));
  const py = Y(clamp(leadership));
  const midX = X(LEADERSHIP_MIDPOINT);
  const midY = Y(LEADERSHIP_MIDPOINT);
  const ticks = [1, 2, 3, 4, 5];
  const yMid = ct + ch / 2;

  return (
    <Svg width={W} height={H}>
      {/* quadrant tints */}
      <Rect x={cl} y={ct} width={midX - cl} height={midY - ct} fill="#fdf4ff" />
      <Rect x={midX} y={ct} width={cr - midX} height={midY - ct} fill="#ecfdf5" />
      <Rect x={cl} y={midY} width={midX - cl} height={cb - midY} fill="#f8fafc" />
      <Rect x={midX} y={midY} width={cr - midX} height={cb - midY} fill="#eff6ff" />
      {/* integer gridlines */}
      {[2, 3, 4].map((v) => (
        <Line key={`gv${v}`} x1={X(v)} y1={ct} x2={X(v)} y2={cb} stroke="#e5e7eb" strokeWidth={0.5} />
      ))}
      {[2, 3, 4].map((v) => (
        <Line key={`gh${v}`} x1={cl} y1={Y(v)} x2={cr} y2={Y(v)} stroke="#e5e7eb" strokeWidth={0.5} />
      ))}
      {/* bold midpoint cross (the high/low split) */}
      <Line x1={midX} y1={ct} x2={midX} y2={cb} stroke="#9ca3af" strokeWidth={1} />
      <Line x1={cl} y1={midY} x2={cr} y2={midY} stroke="#9ca3af" strokeWidth={1} />
      {/* frame */}
      <Rect x={cl} y={ct} width={cw} height={ch} fill="none" stroke="#cbd5e1" strokeWidth={1} />
      {/* quadrant labels */}
      <Text x={cl + 5} y={ct + 12} fill={C.lead} textAnchor="start" style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>Visionary</Text>
      <Text x={cr - 5} y={ct + 12} fill={C.emerald} textAnchor="end" style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>Integrated</Text>
      <Text x={cl + 5} y={cb - 6} fill={C.textLight} textAnchor="start" style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>Emerging</Text>
      <Text x={cr - 5} y={cb - 6} fill={C.mgmt} textAnchor="end" style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>Operational</Text>
      {/* tick numbers */}
      {ticks.map((v) => (
        <Text key={`xt${v}`} x={X(v)} y={cb + 10} fill={C.textLight} textAnchor="middle" style={{ fontSize: 6.5 }}>{String(v)}</Text>
      ))}
      {ticks.map((v) => (
        <Text key={`yt${v}`} x={cl - 6} y={Y(v) + 2.4} fill={C.textLight} textAnchor="end" style={{ fontSize: 6.5 }}>{String(v)}</Text>
      ))}
      {/* axis labels (Y rotated) */}
      <Text x={cl + cw / 2} y={H - 3} fill={C.mgmt} textAnchor="middle" style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>
        Management (transactional)
      </Text>
      <G transform={`translate(11, ${yMid}) rotate(-90)`}>
        <Text x={0} y={3} fill={C.lead} textAnchor="middle" style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>
          Leadership (transformational)
        </Text>
      </G>
      {/* the candidate's plotted position */}
      <Circle cx={px} cy={py} r={11} fill="none" stroke={C.lead} strokeWidth={1} />
      <Circle cx={px} cy={py} r={5.5} fill={C.primary} stroke="#ffffff" strokeWidth={1.5} />
    </Svg>
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

        {/* 2. Leadership/Management Matrix */}
        <View style={s.section} wrap={false}>
          <Text style={s.h2}>2 · Leadership / Management Matrix</Text>
          <View style={s.matrixWrap}>
            <Matrix management={p.management} leadership={p.leadership} />
          </View>
          <Text style={s.para}>
            Each axis is a 1-5 self-rating: the X-axis is management (transactional) orientation, the Y-axis is leadership
            (transformational) orientation. The plotted point is this individual&rsquo;s self-assessed position; the bold cross is the{" "}
            {LEADERSHIP_MIDPOINT.toFixed(1)} high/low split (it moves to the norm median once a Persona norm sample exists). Preferred
            style: <Text style={{ fontFamily: "Helvetica-Bold", color: C.primary }}>{p.styleLabel}</Text>.
          </Text>
        </View>

        {/* 3. Leadership Potential Summary - always starts on its own page so
            the heading never orphans at the bottom of the executive page. */}
        <View style={s.section} break>
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
          A development-focused self-report profile built on the established transactional/transformational leadership model (Bass &amp;
          Avolio, Full Range Leadership). Use it to guide development conversations; pair with a Reflect 360° (others&rsquo; view) and a
          structured interview before any leadership-readiness or selection decision. Indicative until a Persona norm sample exists. © VIFM.
        </Text>
      </Page>

      {/* ── Page 2: Development tips & activities for the development areas ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>4 · Development Tips &amp; Activities</Text>
        <Text style={[s.para, { marginBottom: 10 }]}>
          Targeted tips and on-the-job activities for the five lowest-rated competencies (the development areas above) - concrete,
          GCC-contextualised actions to start over a 30/60/90-day cycle, ideally with a manager or coach.
        </Text>
        {data.developmentPlan.map((d) => (
          <View key={d.name} style={s.devItem} wrap={false}>
            <View style={s.devHead}>
              <View style={s.rowNameWrap}>
                <Text style={s.pillName}>{d.name}</Text>
                <Text style={[s.tag, { backgroundColor: dimHex(d.dimension) }]}>{dimShort(d.dimension)}</Text>
              </View>
              <Text style={[s.rowScore, { color: band(d.score) }]}>{d.score.toFixed(2)}</Text>
            </View>
            {d.tips.length > 0 ? (
              d.tips.map((t, i) => (
                <View key={i} style={s.tipRow}>
                  <Text style={s.tipBullet}>•</Text>
                  <Text style={s.tipText}>{t}</Text>
                </View>
              ))
            ) : (
              <Text style={s.tipEmpty}>No catalogue tips for this competency yet - set a development objective with a coach.</Text>
            )}
          </View>
        ))}
        <Text style={s.footer} fixed>
          A development-focused self-report profile built on the established transactional/transformational leadership model (Bass &amp;
          Avolio). Pair with a Reflect 360° (others&rsquo; view) before any leadership-readiness or selection decision. © VIFM.
        </Text>
      </Page>

      {/* ── Page 3: Competency-by-competency details ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>5 · Leadership Potential Details</Text>
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
          A development-focused self-report profile built on the established transactional/transformational leadership model (Bass &amp;
          Avolio). Pair with a Reflect 360° (others&rsquo; view) before any leadership-readiness or selection decision. © VIFM.
        </Text>
      </Page>
    </Document>
  );
}
