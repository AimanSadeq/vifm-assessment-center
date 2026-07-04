// ─────────────────────────────────────────────────────────────
// VIFM Persona® - DARE Decision-Role Profile (React-PDF, EN).
// Re-reads a Persona sitting through the VIFM DARE Framework (v1.0):
// four decision roles (Decide / Advise / Recommend / Execute), a role-score
// chart, role-by-role breakdown, and role-targeted development focus.
// ─────────────────────────────────────────────────────────────

import { Document, Page, Text, View, StyleSheet, Svg, Rect, Line, G } from "@react-pdf/renderer";
import {
  DARE_ROLES,
  DARE_META,
  DARE_MIDPOINT,
  type DareRole,
  type DareRow,
} from "@/lib/reports/persona-dare-dimensions";
import type { DarePdfData, DareDevItem } from "@/lib/reports/persona-dare-data";

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
  // paddingBottom must clear the fixed multi-line footer (learned on the
  // Leadership Report - content renders THROUGH the note otherwise).
  page: { paddingTop: 44, paddingBottom: 80, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 10, color: C.text },
  banner: { backgroundColor: C.primary, borderRadius: 6, paddingVertical: 18, paddingHorizontal: 20, marginBottom: 16 },
  eyebrow: { fontSize: 8, color: C.accent, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  title: { fontSize: 19, color: "#ffffff", fontFamily: "Helvetica-Bold", marginTop: 5 },
  subtitle: { fontSize: 9.5, color: "#c7d2fe", marginTop: 3 },

  section: { marginBottom: 14 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 8 },
  para: { fontSize: 9.5, color: C.text, lineHeight: 1.5 },

  styleCard: { borderWidth: 1, borderColor: C.accent, borderRadius: 6, padding: 12, backgroundColor: "#f0f6ff", marginBottom: 10 },
  styleLabel: { fontSize: 15, fontFamily: "Helvetica-Bold", color: C.primary },
  styleBlurb: { fontSize: 9, color: C.textLight, marginTop: 3, lineHeight: 1.5 },

  statsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  stat: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 9, backgroundColor: C.bgSoft },
  statLabel: { fontSize: 7.5, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "Helvetica-Bold" },
  statValue: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 2, color: C.primary },
  statSub: { fontSize: 7.5, color: C.textLight, marginTop: 1 },

  roleHead: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, marginBottom: 5 },
  roleLetter: { width: 18, height: 18, borderRadius: 4, color: "#ffffff", fontSize: 11, fontFamily: "Helvetica-Bold", textAlign: "center", paddingTop: 3 },
  roleTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.primary },
  roleScore: { fontSize: 11, fontFamily: "Helvetica-Bold", marginLeft: "auto" },

  pill: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 0.5, borderColor: C.border, borderRadius: 4, paddingVertical: 3.5, paddingHorizontal: 7, marginBottom: 3, backgroundColor: "#ffffff" },
  pillName: { fontSize: 9, color: C.text },
  pillScore: { fontSize: 9.5, fontFamily: "Helvetica-Bold" },

  devItem: { marginBottom: 8, borderWidth: 0.5, borderColor: C.border, borderRadius: 5, padding: 8, backgroundColor: C.bgSoft },
  devHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  devName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.text },
  tipRow: { flexDirection: "row", marginBottom: 2.5 },
  tipBullet: { fontSize: 8.5, marginRight: 5, fontFamily: "Helvetica-Bold" },
  tipText: { fontSize: 8.5, color: C.text, flex: 1, lineHeight: 1.4 },
  tipEmpty: { fontSize: 8.5, color: C.textLight, fontStyle: "italic" },

  footer: { position: "absolute", bottom: 24, left: 44, right: 44, fontSize: 7.5, color: C.textLight, textAlign: "center", borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6, lineHeight: 1.4 },
});

/** Four horizontal role bars on the 1-5 scale with a midpoint marker. */
function RoleChart({ scores }: { scores: Record<DareRole, number> }) {
  const W = 500;
  const rowH = 26;
  const H = rowH * 4 + 16;
  const left = 96;
  const right = 30;
  const barW = W - left - right;
  const X = (v: number) => left + ((Math.max(1, Math.min(5, v)) - 1) / 4) * barW;
  const midX = X(DARE_MIDPOINT);

  return (
    <Svg width={W} height={H}>
      {/* scale gridlines 1..5 */}
      {[1, 2, 3, 4, 5].map((v) => (
        <Line key={v} x1={X(v)} y1={4} x2={X(v)} y2={rowH * 4 + 4} stroke="#eef1f6" strokeWidth={1} />
      ))}
      <Line x1={midX} y1={2} x2={midX} y2={rowH * 4 + 6} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 2" />
      {DARE_ROLES.map((role, i) => {
        const y = 6 + i * rowH;
        const meta = DARE_META[role];
        const v = scores[role] ?? 0;
        return (
          <G key={role}>
            <Rect x={0} y={y + 1} width={14} height={14} rx={3} fill={meta.hex} />
            <Text x={7} y={y + 11.5} textAnchor="middle" fill="#ffffff" style={{ fontSize: 9, fontFamily: "Helvetica-Bold" }}>
              {meta.letter}
            </Text>
            <Text x={20} y={y + 11.5} fill={C.text} style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>
              {meta.label}
            </Text>
            <Rect x={left} y={y + 2} width={barW} height={12} rx={6} fill="#f1f5f9" />
            <Rect x={left} y={y + 2} width={Math.max(4, X(v) - left)} height={12} rx={6} fill={meta.hex} />
            <Text x={X(v) + 5} y={y + 11.5} fill={C.primary} style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>
              {v.toFixed(2)}
            </Text>
          </G>
        );
      })}
      {/* scale ticks */}
      {[1, 2, 3, 4, 5].map((v) => (
        <Text key={`t${v}`} x={X(v)} y={rowH * 4 + 14} textAnchor="middle" fill={C.textLight} style={{ fontSize: 6.5 }}>
          {String(v)}
        </Text>
      ))}
    </Svg>
  );
}

function DevBlock({ title, items, hex }: { title: string; items: DareDevItem[]; hex: string }) {
  if (items.length === 0) return null;
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={[s.statLabel, { color: hex, marginBottom: 4 }]}>{title}</Text>
      {items.map((d) => (
        <View key={d.name} style={s.devItem} wrap={false}>
          <View style={s.devHead}>
            <Text style={s.devName}>{d.name}</Text>
            <Text style={[s.pillScore, { color: band(d.score) }]}>{d.score.toFixed(2)}</Text>
          </View>
          {d.tips.length > 0 ? (
            d.tips.map((t, i) => (
              <View key={i} style={s.tipRow}>
                <Text style={[s.tipBullet, { color: hex }]}>•</Text>
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
  "A decision-role lens on a self-report sitting, built on the VIFM DARE Framework v1.0 (after the decision-rights literature: McKinsey DARE; cf. Bain RAPID). It describes behavioural readiness for a role in a decision process - it does not allocate authority. Pair with a Reflect 360° (others' view) before restructuring decision rights. Indicative until a Persona norm sample exists. © VIFM.";

export function DareReportPdf({ data }: { data: DarePdfData }) {
  const p = data.profile;
  return (
    <Document>
      {/* ── Page 1: Executive summary + role chart ── */}
      <Page size="A4" style={s.page}>
        <View style={s.banner}>
          <Text style={s.eyebrow}>VIFM Persona® · DARE Decision-Role Profile</Text>
          <Text style={s.title}>Where do you sit at the decision table?</Text>
          <Text style={s.subtitle}>{(data.takerName || "Anonymous")} · {data.generatedAt}</Text>
        </View>

        <View style={s.section}>
          <Text style={s.h2}>1 · Executive Summary</Text>
          <View style={s.styleCard}>
            <Text style={s.styleLabel}>Profile: {p.profileLabel}</Text>
            <Text style={s.styleBlurb}>{p.profileBlurb}</Text>
          </View>
          <View style={s.statsRow}>
            {DARE_ROLES.map((role) => (
              <View key={role} style={[s.stat, role === p.primary ? { borderColor: DARE_META[role].hex, borderWidth: 1.5 } : {}]}>
                <Text style={[s.statLabel, { color: DARE_META[role].hex }]}>
                  {DARE_META[role].letter} · {DARE_META[role].label}
                </Text>
                <Text style={s.statValue}>{p.counts[role] > 0 ? (p.scores[role] ?? 0).toFixed(2) : "n/a"}</Text>
                <Text style={s.statSub}>
                  {p.counts[role] > 0
                    ? `mean of ${p.counts[role]} · out of 5${role === p.primary ? " · primary" : ""}`
                    : "not assessed in this scope"}
                </Text>
              </View>
            ))}
          </View>
          <Text style={s.para}>
            {(data.takerName || "This individual")}&rsquo;s self-assessment reads strongest in the{" "}
            {DARE_META[p.primary].label} role ({p.scores[p.primary].toFixed(2)} / 5), with {DARE_META[p.secondary].label} next
            ({p.scores[p.secondary].toFixed(2)}). Overall self-rating across all answered competencies: {data.overall.toFixed(2)} / 5.
            The chart below shows all four roles; the breakdown and development focus follow.
          </Text>
        </View>

        <View style={s.section} wrap={false}>
          <Text style={s.h2}>2 · DARE Profile</Text>
          <RoleChart scores={p.scores} />
          <Text style={[s.statSub, { marginTop: 4 }]}>
            Each bar is the mean self-rating (1-5) of the competencies mapped to that decision role. The dashed marker is the{" "}
            {DARE_MIDPOINT.toFixed(1)} scale midpoint (moves to the norm median once a Persona norm sample exists). No role is
            senior to another - organisations need strength in all four.
          </Text>
        </View>

        <Text style={s.footer} fixed>{FOOTER}</Text>
      </Page>

      {/* ── Page 2: Role-by-role breakdown ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>3 · Role-by-Role Breakdown</Text>
        <Text style={[s.para, { marginBottom: 6 }]}>
          Every answered competency with its self-rating (out of 5), grouped by the decision role it most strengthens
          (VIFM DARE Framework v1.0 mapping) and ordered by score.
        </Text>
        {DARE_ROLES.map((role) => (
          <View key={role}>
            <View style={s.roleHead} wrap={false}>
              <Text style={[s.roleLetter, { backgroundColor: DARE_META[role].hex }]}>{DARE_META[role].letter}</Text>
              <Text style={s.roleTitle}>{DARE_META[role].label}</Text>
              <Text style={[s.roleScore, { color: DARE_META[role].hex }]}>{p.counts[role] > 0 ? (p.scores[role] ?? 0).toFixed(2) : "n/a"}</Text>
            </View>
            {p.counts[role] === 0 ? (
              <Text style={[s.statSub, { marginBottom: 4 }]}>Not assessed in this scope.</Text>
            ) : null}
            {p.rowsByRole[role].map((r: DareRow) => (
              <View key={r.id} style={s.pill} wrap={false}>
                <Text style={s.pillName}>{r.name}</Text>
                <Text style={[s.pillScore, { color: band(r.score) }]}>{r.score.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        ))}
        <Text style={s.footer} fixed>{FOOTER}</Text>
      </Page>

      {/* ── Page 3: Development focus ── */}
      <Page size="A4" style={s.page}>
        <Text style={s.h2}>4 · Development Focus</Text>
        <Text style={[s.para, { marginBottom: 8 }]}>
          Two targeted moves: sharpen the primary role ({DARE_META[p.primary].label}) where it is weakest, and build the
          foundations of the least-developed role ({DARE_META[data.weakestRole].label}). Concrete, GCC-contextualised
          actions for a 30/60/90-day cycle, ideally with a manager or coach.
        </Text>
        <DevBlock
          title={`Sharpen your ${DARE_META[p.primary].label} role - lowest-rated competencies`}
          items={data.primaryFocus}
          hex={DARE_META[p.primary].hex}
        />
        <DevBlock
          title={`Build your ${DARE_META[data.weakestRole].label} role - lowest-rated competencies`}
          items={data.weakestFocus}
          hex={DARE_META[data.weakestRole].hex}
        />
        <Text style={s.footer} fixed>{FOOTER}</Text>
      </Page>
    </Document>
  );
}
