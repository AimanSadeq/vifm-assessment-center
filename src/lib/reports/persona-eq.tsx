// ─────────────────────────────────────────────────────────────
// VIFM Persona® - Emotional Intelligence Profile (React-PDF, EN).
// Re-reads a Persona sitting through the VIFM EQ Framework (v1.0): Goleman's
// four quadrants (Self-Awareness / Self-Management / Social Awareness /
// Relationship Management) over the 22 emotionally-loaded competencies, with
// the canonical 2x2 grid, quadrant breakdown, and targeted development focus.
// ─────────────────────────────────────────────────────────────

import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  EQ_QUADRANTS,
  EQ_META,
  EQ_MIDPOINT,
  type EqQuadrant,
  type EqRow,
} from "@/lib/reports/persona-eq-dimensions";
import type { EqPdfData, EqDevItem } from "@/lib/reports/persona-eq-data";

const C = {
  primary: "#010131",
  accent: "#5391D5",
  text: "#121232",
  textLight: "#6b7280",
  border: "#e5e7eb",
  bgSoft: "#f8fafc",
};

const band = (v: number) => (v >= 4 ? "#059669" : v >= 3 ? "#0284c7" : v >= 2 ? "#D97706" : "#b91c1c");

const s = StyleSheet.create({
  // paddingBottom must clear the fixed multi-line footer.
  page: { paddingTop: 44, paddingBottom: 80, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 10, color: C.text },
  banner: { backgroundColor: C.primary, borderRadius: 6, paddingVertical: 18, paddingHorizontal: 20, marginBottom: 16 },
  eyebrow: { fontSize: 8, color: C.accent, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  title: { fontSize: 19, color: "#ffffff", fontFamily: "Helvetica-Bold", marginTop: 5 },
  subtitle: { fontSize: 9.5, color: "#c7d2fe", marginTop: 3 },

  section: { marginBottom: 14 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 8 },
  para: { fontSize: 9.5, color: C.text, lineHeight: 1.5 },

  indexCard: { borderWidth: 1, borderColor: C.accent, borderRadius: 6, padding: 12, backgroundColor: "#f0f6ff", marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 14 },
  indexValue: { fontSize: 26, fontFamily: "Helvetica-Bold", color: C.primary },
  indexLabel: { fontSize: 8, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.6, fontFamily: "Helvetica-Bold" },
  indexBlurb: { fontSize: 9, color: C.textLight, lineHeight: 1.45, flex: 1 },

  // The canonical 2x2: axis labels + four quadrant cells.
  gridAxis: { fontSize: 7.5, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "Helvetica-Bold" },
  gridRow: { flexDirection: "row", gap: 8 },
  cell: { flex: 1, borderWidth: 1.2, borderRadius: 6, padding: 10, marginBottom: 8 },
  cellLabel: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  cellAxis: { fontSize: 6.5, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.6, marginTop: 1 },
  cellScore: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 4 },
  cellSub: { fontSize: 7.5, color: C.textLight, marginTop: 1 },
  cellBarTrack: { height: 5, borderRadius: 2.5, backgroundColor: "#eef1f6", marginTop: 5 },
  cellBarFill: { height: 5, borderRadius: 2.5 },

  quadHead: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, marginBottom: 5 },
  quadDot: { width: 9, height: 9, borderRadius: 4.5 },
  quadTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.primary },
  quadScore: { fontSize: 11, fontFamily: "Helvetica-Bold", marginLeft: "auto" },

  pill: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 0.5, borderColor: C.border, borderRadius: 4, paddingVertical: 3.5, paddingHorizontal: 7, marginBottom: 3, backgroundColor: "#ffffff" },
  pillName: { fontSize: 9, color: C.text },
  pillScore: { fontSize: 9.5, fontFamily: "Helvetica-Bold" },

  devItem: { marginBottom: 8, borderWidth: 0.5, borderColor: C.border, borderRadius: 5, padding: 8, backgroundColor: C.bgSoft },
  devHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  devName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.text },
  devLabel: { fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  tipRow: { flexDirection: "row", marginBottom: 2.5 },
  tipBullet: { fontSize: 8.5, marginRight: 5, fontFamily: "Helvetica-Bold" },
  tipText: { fontSize: 8.5, color: C.text, flex: 1, lineHeight: 1.4 },
  tipEmpty: { fontSize: 8.5, color: C.textLight, fontStyle: "italic" },

  footer: { position: "absolute", bottom: 24, left: 44, right: 44, fontSize: 7.5, color: C.textLight, textAlign: "center", borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6, lineHeight: 1.4 },
});

function QuadrantCell({ quadrant, score, count }: { quadrant: EqQuadrant; score: number; count: number }) {
  const meta = EQ_META[quadrant];
  const pct = Math.max(0, Math.min(100, ((score - 1) / 4) * 100));
  return (
    <View style={[s.cell, { borderColor: meta.hex, backgroundColor: `${meta.hex}0d` }]}>
      <Text style={[s.cellLabel, { color: meta.hex }]}>{meta.label}</Text>
      <Text style={s.cellAxis}>{meta.axis}</Text>
      <Text style={s.cellScore}>{count > 0 ? score.toFixed(2) : "-"}</Text>
      <Text style={s.cellSub}>mean of {count} competencies · out of 5</Text>
      <View style={s.cellBarTrack}>
        <View style={[s.cellBarFill, { width: `${pct}%`, backgroundColor: meta.hex }]} />
      </View>
    </View>
  );
}

function DevBlock({ title, items }: { title: string; items: EqDevItem[] }) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={[s.devLabel, { color: items[0] ? EQ_META[items[0].quadrant].hex : C.textLight }]}>{title}</Text>
      {items.map((d) => (
        <View key={d.name} style={s.devItem} wrap={false}>
          <View style={s.devHead}>
            <Text style={s.devName}>{d.name}</Text>
            <Text style={[s.pillScore, { color: band(d.score) }]}>{d.score.toFixed(2)}</Text>
          </View>
          {d.tips.length > 0 ? (
            d.tips.map((t, i) => (
              <View key={i} style={s.tipRow}>
                <Text style={[s.tipBullet, { color: EQ_META[d.quadrant].hex }]}>•</Text>
                <Text style={s.tipText}>{t}</Text>
              </View>
            ))
          ) : (
            <Text style={s.tipEmpty}>No catalogue tips for this competency yet - set a development objective with a coach.</Text>
          )}
        </View>
      ))}
    </View>
  );
}

const FOOTER =
  "An emotional-intelligence lens on a self-report sitting, built on the VIFM EQ Framework v1.0 (after Goleman's four-quadrant model; cf. ESCI). It re-reads 22 of the 41 VIFM competencies - it is NOT the ESCI, the MSCEIT, or a normed EI instrument. EI self-ratings famously diverge from others' experience: pair with a Reflect 360° before any conclusion. Indicative until a Persona norm sample exists. © VIFM.";

export function EqReportPdf({ data }: { data: EqPdfData }) {
  const p = data.profile;
  return (
    <Document>
      {/* ── Page 1: Executive summary + the Goleman grid ── */}
      <Page size="A4" style={s.page}>
        <View style={s.banner}>
          <Text style={s.eyebrow}>VIFM Persona® · Emotional Intelligence Profile</Text>
          <Text style={s.title}>How you handle yourself - and your relationships</Text>
          <Text style={s.subtitle}>{(data.takerName || "Anonymous")} · {data.generatedAt}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.h2}>1 · Executive Summary</Text>
          <View style={s.indexCard}>
            <View>
              <Text style={s.indexLabel}>EQ index</Text>
              <Text style={s.indexValue}>{p.eqIndex.toFixed(2)}</Text>
              <Text style={s.cellSub}>/ 5 · quadrant-balanced</Text>
            </View>
            <Text style={s.indexBlurb}>
              Strongest quadrant: {EQ_META[p.strongest].label} ({p.scores[p.strongest].toFixed(2)}) - {EQ_META[p.strongest].blurb}{" "}
              Priority quadrant: {EQ_META[p.priority].label} ({p.scores[p.priority].toFixed(2)}) - the development section
              targets it. Based on {data.inScopeAnswered} of the 22 EI-domain competencies answered in this sitting.
            </Text>
          </View>
        </View>

        {/* The canonical Goleman 2x2 */}
        <View style={s.section} wrap={false}>
          <Text style={s.h2}>2 · The Goleman Grid</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4, paddingHorizontal: 2 }}>
            <Text style={s.gridAxis}>Recognition - what you notice</Text>
            <Text style={s.gridAxis}>Regulation - what you do with it</Text>
          </View>
          <View style={s.gridRow}>
            <QuadrantCell quadrant="self_awareness" score={p.scores.self_awareness} count={p.counts.self_awareness} />
            <QuadrantCell quadrant="self_management" score={p.scores.self_management} count={p.counts.self_management} />
          </View>
          <View style={s.gridRow}>
            <QuadrantCell quadrant="social_awareness" score={p.scores.social_awareness} count={p.counts.social_awareness} />
            <QuadrantCell quadrant="relationship_management" score={p.scores.relationship_management} count={p.counts.relationship_management} />
          </View>
          <Text style={[s.cellSub, { marginTop: 2 }]}>
            Top row = Self, bottom row = Social. Each score is the mean self-rating (1-5) of the competencies mapped to that
            quadrant; read against the {EQ_MIDPOINT.toFixed(1)} scale midpoint until a Persona norm sample exists. Self-awareness
            underpins the other three quadrants (Goleman, 1998).
          </Text>
        </View>

        <Text style={s.footer} fixed>{FOOTER}</Text>
      </Page>

      {/* ── Page 2: Quadrant-by-quadrant breakdown ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>3 · Quadrant-by-Quadrant Breakdown</Text>
        <Text style={[s.para, { marginBottom: 6 }]}>
          Every answered EI-domain competency with its self-rating (out of 5), grouped by Goleman quadrant (VIFM EQ
          Framework v1.0 mapping) and ordered by score. The 19 cognitive, commercial, and executional competencies are
          outside the EI domain and are not scored by this report.
        </Text>
        {EQ_QUADRANTS.map((q) => (
          <View key={q}>
            <View style={s.quadHead} wrap={false}>
              <View style={[s.quadDot, { backgroundColor: EQ_META[q].hex }]} />
              <Text style={s.quadTitle}>{EQ_META[q].label}</Text>
              <Text style={[s.quadScore, { color: EQ_META[q].hex }]}>{p.counts[q] > 0 ? p.scores[q].toFixed(2) : "-"}</Text>
            </View>
            {p.rowsByQuadrant[q].map((r: EqRow) => (
              <View key={r.id} style={s.pill} wrap={false}>
                <Text style={s.pillName}>{r.name}</Text>
                <Text style={[s.pillScore, { color: band(r.score) }]}>{r.score.toFixed(2)}</Text>
              </View>
            ))}
            {p.counts[q] === 0 && (
              <Text style={s.tipEmpty}>No competencies from this quadrant were answered in this sitting.</Text>
            )}
          </View>
        ))}
        <Text style={s.footer} fixed>{FOOTER}</Text>
      </Page>

      {/* ── Page 3: Development focus ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>4 · Development Focus</Text>
        <Text style={[s.para, { marginBottom: 8 }]}>
          Emotional intelligence develops with deliberate practice. Start with the priority quadrant
          ({EQ_META[p.priority].label}) - concrete, GCC-contextualised actions for a 30/60/90-day cycle, ideally with a
          manager or coach, and re-test after the cycle.
        </Text>
        <DevBlock
          title={`Build ${EQ_META[p.priority].label} - lowest-rated competencies`}
          items={data.priorityFocus}
        />
        <DevBlock
          title={`Then strengthen ${EQ_META[p.runnerUp].label}`}
          items={data.runnerUpFocus}
        />
        <Text style={s.footer} fixed>{FOOTER}</Text>
      </Page>
    </Document>
  );
}
