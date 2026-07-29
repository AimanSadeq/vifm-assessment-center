// ─────────────────────────────────────────────────────────────
// VIFM High-Potential Profile - React-PDF document.
//
// Structure (tweaked from the Leadership Report):
//   1. Cover / summary - the two pillar gauges + nine-grid placement.
//   2. The nine-grid - 3x3 with the individual's cell highlighted, archetype
//      narrative and development focus.
//   3. Aspiration detail - the eight drive/growth markers.
//   4. Ability detail - behavioural composite + Logica subtests, with the
//      stated blend weights and the subtest-selection rationale.
//   5. Development plan - competency tips + cognitive activities.
//   6. Methodology - what is (and is not) measured; engagement is directed to
//      the manager conversation; indicative posture until norms exist.
// All content is original VIFM material.
// ─────────────────────────────────────────────────────────────

import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { HipoPdfData } from "@/lib/reports/persona-hipo-data";
import { HIPO_GRID, HIPO_LOGICA_RECOMMENDATION } from "@/lib/reports/persona-hipo-model";

const C = {
  primary: "#010131",
  accent: "#5391D5",
  text: "#121232",
  textLight: "#6b7280",
  border: "#e5e7eb",
  bgSoft: "#f8fafc",
  emerald: "#059669",
  amber: "#b45309",
  rose: "#be123c",
  highlight: "#eef4fc",
};

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 10, color: C.text },
  banner: { backgroundColor: C.primary, borderRadius: 6, paddingVertical: 20, paddingHorizontal: 22, marginBottom: 16 },
  eyebrow: { fontSize: 8, color: C.accent, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  title: { fontSize: 20, color: "#ffffff", fontFamily: "Helvetica-Bold", marginTop: 6 },
  subtitle: { fontSize: 10, color: "#c7d2fe", marginTop: 4 },
  h2: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 8, marginTop: 4 },
  h3: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 4 },
  p: { fontSize: 9.5, lineHeight: 1.5, color: C.text, marginBottom: 6 },
  pSoft: { fontSize: 8.5, lineHeight: 1.5, color: C.textLight, marginBottom: 6 },
  panel: { borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 12, marginBottom: 10, backgroundColor: C.bgSoft },
  panelTitle: { fontSize: 8.5, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "Helvetica-Bold" },
  bigValue: { fontSize: 20, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 3 },
  barTrack: { height: 7, backgroundColor: "#e5e7eb", borderRadius: 3.5, marginTop: 4 },
  barFill: { height: 7, backgroundColor: C.accent, borderRadius: 3.5 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: C.border },
  rowName: { fontSize: 9.5, color: C.text, flex: 1, paddingRight: 8 },
  rowVal: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.primary, width: 44, textAlign: "right" },
  gridCell: { flex: 1, borderWidth: 0.8, borderColor: C.border, margin: 1.5, borderRadius: 4, padding: 7, height: 78 },
  gridCellActive: { backgroundColor: C.highlight, borderColor: C.accent, borderWidth: 1.6 },
  gridArch: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.primary, lineHeight: 1.3 },
  gridArchActive: { color: C.accent },
  axisLabel: { fontSize: 8, color: C.textLight, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.6 },
  tipBox: { borderLeftWidth: 2.5, borderLeftColor: C.accent, backgroundColor: C.bgSoft, padding: 9, marginBottom: 8, borderRadius: 3 },
  footer: { position: "absolute", bottom: 24, left: 44, right: 44, fontSize: 7.5, color: C.textLight, textAlign: "center", borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6, lineHeight: 1.4 },
});

const Footer = ({ name }: { name: string | null }) => (
  <Text style={s.footer} fixed>
    VIFM High-Potential Profile · {name ?? "Candidate"} · Indicative, development-grade profile - not a selection verdict. © Virginia Institute of Finance and Management.
  </Text>
);

function Gauge({ label, value, bandLabel, sub }: { label: string; value: number; bandLabel: string; sub?: string }) {
  return (
    <View style={[s.panel, { flex: 1 }]}>
      <Text style={s.panelTitle}>{label}</Text>
      <Text style={s.bigValue}>{value.toFixed(2)} / 5</Text>
      <View style={s.barTrack}><View style={[s.barFill, { width: `${Math.min(100, (value / 5) * 100)}%` }]} /></View>
      <Text style={[s.pSoft, { marginTop: 4, marginBottom: 0 }]}>{bandLabel}{sub ? ` · ${sub}` : ""}</Text>
    </View>
  );
}

// Blue tonal scale by combined strength (row + col, 0..4): light bottom-left,
// deepening toward the strongest top-right cell - the visual "potential zones".
const ZONE_FILL = ["#f2f6fb", "#dde9f6", "#bcd5ed", "#8db6e1", "#5391D5"];
const zoneStrength = (row: number, col: number) => row + col;

function NineGrid({ d }: { d: HipoPdfData }) {
  const ROW_BANDS = ["Strong", "Solid", "Developing"]; // rendered top-down (rows 2,1,0)
  // Rows rendered top-down: aspiration strong (2) at the top.
  return (
    <View>
      <View style={{ flexDirection: "row" }}>
        {/* Y axis: Aspiration, High at top, Low at bottom */}
        <View style={{ width: 62, marginRight: 4 }}>
          <Text style={[s.axisLabel, { textAlign: "right", color: C.primary }]}>High</Text>
          {[2, 1, 0].map((rowIdx) => (
            <View key={rowIdx} style={{ height: 81, justifyContent: "center" }}>
              <Text style={[s.axisLabel, { textAlign: "right" }]}>{ROW_BANDS[2 - rowIdx]}</Text>
            </View>
          ))}
          <Text style={[s.axisLabel, { textAlign: "right", color: C.primary }]}>Low</Text>
          <Text style={[s.axisLabel, { textAlign: "right", marginTop: 4, color: C.primary }]}>ASPIRATION</Text>
        </View>

        {/* The 3x3 zones - drawn axis lines (left = Aspiration, bottom = Ability)
            make the chart read as a real X/Y plot, not a table. */}
        <View style={{ flex: 1, borderLeftWidth: 1.4, borderBottomWidth: 1.4, borderColor: C.primary, paddingBottom: 2 }}>
          <View style={{ height: 11 }} />
          {[2, 1, 0].map((rowIdx) => (
            <View key={rowIdx} style={{ flexDirection: "row" }}>
              {[0, 1, 2].map((colIdx) => {
                const cell = HIPO_GRID.find((c) => c.row === rowIdx && c.col === colIdx)!;
                const active = d.cell.row === rowIdx && d.cell.col === colIdx;
                const strength = zoneStrength(rowIdx, colIdx);
                const dark = strength >= 3;
                const titleColor = active ? (dark ? "#ffffff" : C.accent) : dark ? "#ffffff" : C.primary;
                const shortColor = dark ? "#e3edf9" : C.textLight;
                return (
                  <View
                    key={colIdx}
                    style={[
                      s.gridCell,
                      { backgroundColor: ZONE_FILL[strength], borderColor: dark ? ZONE_FILL[strength] : C.border },
                      ...(active ? [{ borderColor: C.primary, borderWidth: 1.8 }] : []),
                    ]}
                  >
                    <Text style={[s.gridArch, { color: titleColor }]}>{cell.archetype}</Text>
                    <Text style={{ fontSize: 6.5, color: shortColor, marginTop: 2, lineHeight: 1.3 }}>{cell.short}</Text>
                    {active && (
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                        <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: dark ? "#ffffff" : C.primary, marginRight: 3 }} />
                        <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: dark ? "#ffffff" : C.primary }}>
                          {d.takerName ?? "This candidate"}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </View>

      {/* X axis labels sit OUTSIDE the axis line so the line reads as the axis */}
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 66 }} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", marginTop: 3 }}>
            {["Developing", "Solid", "Strong"].map((l) => (
              <Text key={l} style={[s.axisLabel, { flex: 1, textAlign: "center" }]}>{l}</Text>
            ))}
          </View>
          <View style={{ flexDirection: "row", marginTop: 2, alignItems: "center" }}>
            <Text style={[s.axisLabel, { color: C.primary }]}>Low</Text>
            <Text style={[s.axisLabel, { flex: 1, textAlign: "center", color: C.primary }]}>ABILITY</Text>
            <Text style={[s.axisLabel, { color: C.primary }]}>High</Text>
          </View>
        </View>
      </View>

      {/* Legend */}
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
        {[0, 2, 4].map((i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", marginRight: 8 }}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: ZONE_FILL[i], borderWidth: 0.5, borderColor: C.border, marginRight: 3 }} />
            <Text style={{ fontSize: 7, color: C.textLight }}>{i === 0 ? "Developing zone" : i === 2 ? "Core-talent zone" : "High-potential zone"}</Text>
          </View>
        ))}
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.primary, marginRight: 3 }} />
          <Text style={{ fontSize: 7, color: C.textLight }}>Individual placement</Text>
        </View>
      </View>
    </View>
  );
}

export function HipoReportPdf({ d }: { d: HipoPdfData }) {
  return (
    <Document title="VIFM High-Potential Profile" author="VIFM Caliber">
      {/* ── Page 1: summary ── */}
      <Page size="A4" style={s.page}>
        <View style={s.banner}>
          <Text style={s.eyebrow}>VIFM Caliber® · Bespoke Assessment</Text>
          <Text style={s.title}>High-Potential Profile</Text>
          <Text style={s.subtitle}>
            {d.takerName ?? "Candidate"}{d.orgName ? ` · ${d.orgName}` : ""} · {d.generatedAt}
          </Text>
        </View>

        <Text style={s.h2}>The VIFM High-Potential model</Text>
        <Text style={s.p}>
          High potential is read here through two measurable pillars. ASPIRATION - the drive, initiative and growth
          appetite to rise into bigger roles - is measured from eight behavioural markers in the VIFM Persona®
          sitting. ABILITY - the capability to succeed once there - blends the remaining behavioural competencies
          with cognitive reasoning evidence from VIFM Logica®.{" "}
          {d.engagement
            ? "The third element, ENGAGEMENT (the commitment to stay and grow with the organisation), is read from a short survey completed by the line manager - a management judgement that informs the development conversation, shown as its own reading and never blended into the grid."
            : "A third element every credible high-potential decision needs, ENGAGEMENT (the commitment to stay and grow with the organisation), cannot be read from an assessment sitting: this report deliberately leaves it to the manager and HR conversation and says where."}
        </Text>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
          <Gauge label="Aspiration · will they rise?" value={d.aspiration} bandLabel={d.bandLabel(d.aspirationBand)} sub={`${d.aspirationMarkers.length} markers`} />
          <Gauge
            label="Ability · can they succeed?"
            value={d.ability}
            bandLabel={d.bandLabel(d.abilityBand)}
            sub={d.cognitive != null ? `behavioural ${d.behavioural.toFixed(2)} · cognitive ${d.cognitive.toFixed(2)}` : "behavioural evidence only"}
          />
          {d.engagement && (
            <Gauge
              label="Engagement · will they stay?"
              value={d.engagement.score}
              bandLabel={d.engagement.bandLabel}
              sub="manager-rated"
            />
          )}
        </View>

        <View style={[s.panel, { backgroundColor: C.highlight, borderColor: C.accent }]}>
          <Text style={s.panelTitle}>Nine-grid placement</Text>
          <Text style={[s.bigValue, { fontSize: 14 }]}>{d.cell.archetype}</Text>
          <Text style={[s.p, { marginTop: 4, marginBottom: 0 }]}>{d.cell.narrative}</Text>
        </View>
        {d.engagement?.overlay && (
          <View style={[s.panel, { backgroundColor: "#fffbeb", borderColor: "#f59e0b" }]}>
            <Text style={[s.panelTitle, { color: "#92400e" }]}>Engagement overlay</Text>
            <Text style={[s.p, { marginTop: 3, marginBottom: 0, color: "#78350f" }]}>{d.engagement.overlay}</Text>
          </View>
        )}
        <Footer name={d.takerName} />
      </Page>

      {/* ── Page 2: the nine-grid ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Nine-grid: Aspiration x Ability</Text>
        <Text style={s.pSoft}>
          Each axis is banded Developing (below {d.cuts.solidAt.toFixed(1)}), Solid ({d.cuts.solidAt.toFixed(1)}-{d.cuts.strongAt.toFixed(1)})
          and Strong ({d.cuts.strongAt.toFixed(1)}+) on the shared 1-5 scale. Cuts are scale-midpoint based and indicative
          until a VIFM norm sample is established.
        </Text>
        <NineGrid d={d} />
        <View style={[s.panel, { marginTop: 12 }]}>
          <Text style={s.h3}>What this placement means</Text>
          <Text style={s.p}>{d.cell.narrative}</Text>
          <Text style={s.h3}>Development focus</Text>
          <Text style={[s.p, { marginBottom: 0 }]}>{d.cell.developmentFocus}</Text>
        </View>
        <Footer name={d.takerName} />
      </Page>

      {/* ── Page 3: aspiration detail ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Aspiration - the eight markers</Text>
        <Text style={s.pSoft}>
          Self-rated behavioural markers of drive, initiative and growth appetite from the Persona sitting.
          Self-report shows how the individual sees their own drive - triangulate with observed behaviour and,
          where available, a Reflect 360.
        </Text>
        {d.aspirationMarkers.map((m) => (
          <View key={m.name} style={s.row}>
            <Text style={s.rowName}>{m.name}</Text>
            <View style={{ width: 150 }}>
              <View style={s.barTrack}><View style={[s.barFill, { width: `${(m.score / 5) * 100}%` }]} /></View>
            </View>
            <Text style={s.rowVal}>{m.score.toFixed(2)}</Text>
          </View>
        ))}
        <View style={[s.panel, { marginTop: 12 }]}>
          <Text style={s.panelTitle}>Overall aspiration</Text>
          <Text style={s.bigValue}>{d.aspiration.toFixed(2)} / 5 · {d.bandLabel(d.aspirationBand)}</Text>
        </View>
        <Footer name={d.takerName} />
      </Page>

      {/* ── Page 4: ability detail ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Ability - behavioural + cognitive</Text>
        <Text style={s.pSoft}>
          Ability blends behavioural capability ({Math.round(d.weights.behavioural * 100)}%) with cognitive reasoning
          ({Math.round(d.weights.cognitive * 100)}%). Both components are shown separately below - the blend is never a black box.
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={[s.panel, { flex: 1 }]}>
            <Text style={s.panelTitle}>Behavioural ability · Persona</Text>
            <Text style={s.bigValue}>{d.behavioural.toFixed(2)} / 5</Text>
            <Text style={s.pSoft}>Mean of {d.behaviouralCount} leadership-relevant competencies (all measured competencies outside the aspiration set).</Text>
          </View>
          <View style={[s.panel, { flex: 1 }]}>
            <Text style={s.panelTitle}>Cognitive agility · Logica</Text>
            <Text style={s.bigValue}>{d.cognitive != null ? `${d.cognitive.toFixed(2)} / 5` : "Not sat"}</Text>
            {d.cognitiveSubtests.map((sc) => (
              <View key={sc.key} style={s.row}>
                <Text style={s.rowName}>{sc.name}</Text>
                <Text style={s.rowVal}>{sc.pct}%</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={s.h3}>Why these reasoning tests</Text>
        {HIPO_LOGICA_RECOMMENDATION.required.map((r) => (
          <View key={r.key} style={s.tipBox}>
            <Text style={[s.h3, { marginBottom: 2, textTransform: "capitalize" }]}>{r.key} reasoning · required</Text>
            <Text style={[s.pSoft, { marginBottom: 0 }]}>{r.why}</Text>
          </View>
        ))}
        {HIPO_LOGICA_RECOMMENDATION.recommendedForSenior.map((r) => (
          <View key={r.key} style={s.tipBox}>
            <Text style={[s.h3, { marginBottom: 2, textTransform: "capitalize" }]}>{r.key} reasoning · recommended for senior pipelines</Text>
            <Text style={[s.pSoft, { marginBottom: 0 }]}>{r.why}</Text>
          </View>
        ))}
        <Footer name={d.takerName} />
      </Page>

      {/* ── Engagement page (only when a manager survey is completed) ── */}
      {d.engagement && (
        <Page size="A4" style={s.page}>
          <Text style={s.h2}>Engagement - will they stay?</Text>
          <Text style={s.pSoft}>
            Rated by {d.engagement.managerName ? `${d.engagement.managerName} (line manager)` : "the candidate's line manager"} on{" "}
            {new Date(d.engagement.completedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
            Six observable statements on the same 1-5 scale as the other pillars. This is a single-rater management
            judgement - prone to recency and halo effects - so treat it as a conversation opener, never a verdict.
          </Text>

          <View style={[s.panel, { backgroundColor: C.highlight, borderColor: C.accent }]}>
            <Text style={s.panelTitle}>Overall engagement</Text>
            <Text style={s.bigValue}>{d.engagement.score.toFixed(2)} / 5 · {d.engagement.bandLabel}</Text>
          </View>

          {d.engagement.items.map((it) => (
            <View key={it.label} style={s.row}>
              <Text style={s.rowName}>
                {it.label}
                {it.reverse ? " (reverse-scored)" : ""}
              </Text>
              <View style={{ width: 150 }}>
                <View style={s.barTrack}><View style={[s.barFill, { width: `${(it.scored / 5) * 100}%` }]} /></View>
              </View>
              <Text style={s.rowVal}>{it.scored.toFixed(1)}</Text>
            </View>
          ))}

          {d.engagement.overlay && (
            <View style={[s.panel, { backgroundColor: "#fffbeb", borderColor: "#f59e0b", marginTop: 12 }]}>
              <Text style={[s.panelTitle, { color: "#92400e" }]}>What this means for the placement</Text>
              <Text style={[s.p, { marginTop: 3, marginBottom: 0, color: "#78350f" }]}>{d.engagement.overlay}</Text>
            </View>
          )}

          <Text style={[s.pSoft, { marginTop: 10 }]}>
            Engagement never moves the nine-grid placement - the grid stays a pure Aspiration x Ability read. This
            page shapes what to DO with the placement: development investment lands best where engagement is secured.
          </Text>
          <Footer name={d.takerName} />
        </Page>
      )}

      {/* ── Page 5: development plan ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>Development tips & activities</Text>
        <Text style={s.pSoft}>
          Built from the three lowest-rated behavioural markers in this sitting, plus reasoning practice where a
          subtest sits below the Solid band. Work one or two items at a time - depth beats breadth.
        </Text>
        {d.behaviouralDev.map((item) => (
          <View key={item.name} style={s.tipBox}>
            <Text style={s.h3}>{item.name} · self-rated {item.score.toFixed(2)}</Text>
            {item.tips.length > 0 ? (
              item.tips.map((t, i) => (
                <Text key={i} style={[s.pSoft, { marginBottom: 2 }]}>• {t}</Text>
              ))
            ) : (
              <Text style={[s.pSoft, { marginBottom: 0 }]}>Agree one stretch activity for this competency with your manager this quarter.</Text>
            )}
          </View>
        ))}
        {d.cognitiveDev.map((item) => (
          <View key={item.name} style={s.tipBox}>
            <Text style={s.h3}>{item.name} · reasoning practice</Text>
            {item.activities.map((t, i) => (
              <Text key={i} style={[s.pSoft, { marginBottom: 2 }]}>• {t}</Text>
            ))}
          </View>
        ))}

        <Text style={s.h2}>Methodology & honest limits</Text>
        <Text style={s.pSoft}>
          Sources: VIFM Persona® behavioural self-assessment (41-competency framework; forced-choice and Likert items,
          reverse-keyed) and VIFM Logica® reasoning (server-scored, keyed test held server-side). Aspiration is the mean
          of eight drive/growth markers; behavioural ability is the mean of the remaining measured competencies; cognitive
          agility maps reasoning accuracy onto the shared 1-5 scale.{" "}
          {d.cognitive != null
            ? `Ability = ${Math.round(d.weights.behavioural * 100)}% behavioural + ${Math.round(d.weights.cognitive * 100)}% cognitive.`
            : "No Logica result was attached to this sitting, so Ability here rests on behavioural evidence alone - adding the recommended reasoning tests strengthens the pillar."}{" "}
          Band cuts are indicative (scale-midpoint based)
          until a VIFM norm sample is established.{" "}
          {d.engagement
            ? "Engagement is a six-item survey rated by the line manager on the same 1-5 scale - a single-rater management judgement that annotates the placement and never moves it."
            : "Engagement - the commitment to remain and grow with the organisation - is not measurable from this sitting and must come from the manager/HR conversation."}{" "}
          Treat this profile as one input to a high-potential nomination, never the decision itself.
        </Text>
        <Footer name={d.takerName} />
      </Page>
    </Document>
  );
}
