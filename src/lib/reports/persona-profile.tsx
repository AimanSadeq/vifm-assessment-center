import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { personaBand } from "@/lib/scoring/persona-bands";

// Persona - Behavioural Competency Self-Assessment profile PDF (English /
// React-PDF). Works for any behavioral session (anonymous /ac/persona or
// candidate-bound). Self-report only - not a readiness verdict.

const C = {
  primary: "#010131",
  accent: "#5391D5",
  persona: "#c026d3",
  text: "#121232",
  textLight: "#6b7280",
  border: "#e5e7eb",
  bgSoft: "#fafbfc",
  emerald: "#059669",
  sky: "#0284c7",
  amber: "#D97706",
};

const band = (v: number) => (v >= 4 ? C.emerald : v >= 3 ? C.sky : C.amber);

export type PersonaPdfRow = { name: string; score: number; definition?: string; narrative?: string; tip?: string };
export type PersonaPdfCluster = { name: string; avg: number; rows: PersonaPdfRow[] };
export type PersonaPdfFit = {
  roleName: string;
  fitPct: number;
  bandLabel: string;
  bandHex: string;
  gaps: { name: string; self: number; target: number; gap: number }[];
  strengths?: { name: string; self: number; target: number }[];
};
export type PersonaPdfCourse = {
  title: string;
  code?: string | null;
  vertical: string;
  level: string;
  durationLabel: string;
  fitOutOfTen: number;
  highFit: boolean;
  drivers: { label: string; gap: number; relevance: number }[];
};
export type PersonaPdfData = {
  takerName: string | null;
  generatedAt: string;
  overall: number;
  clusters: PersonaPdfCluster[];
  purpose?: "development" | "hiring";
  fit?: PersonaPdfFit | null;
  /** VIFM Academy training plan (development reports). */
  courses?: PersonaPdfCourse[];
};

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 50, paddingHorizontal: 44, fontFamily: "Helvetica", fontSize: 10, color: C.text },
  banner: { backgroundColor: C.primary, borderRadius: 6, paddingVertical: 18, paddingHorizontal: 20, marginBottom: 16 },
  eyebrow: { fontSize: 8, color: C.accent, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  title: { fontSize: 21, color: "#ffffff", fontFamily: "Helvetica-Bold", marginTop: 4 },
  subtitle: { fontSize: 11, color: "#ffffff", opacity: 0.8, marginTop: 2 },

  overallRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  overallLabel: { fontSize: 8, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.6 },
  overallValue: { fontSize: 24, fontFamily: "Helvetica-Bold" },

  clusterTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4, marginTop: 10 },
  clusterName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.primary },
  clusterAvg: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  row: { marginBottom: 7 },
  rowHead: { flexDirection: "row", justifyContent: "space-between" },
  rowName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.text },
  rowScore: { fontSize: 9.5, color: C.textLight },
  rowDef: { fontSize: 8, color: C.textLight, marginTop: 1, lineHeight: 1.4 },
  rowNarr: { fontSize: 8, color: C.text, marginTop: 2, lineHeight: 1.4 },
  rowTip: { fontSize: 8, color: C.primary, marginTop: 2, lineHeight: 1.4 },
  barTrack: { height: 5, backgroundColor: "#eef0f3", borderRadius: 3, marginTop: 3 },
  barFill: { height: 5, borderRadius: 3 },

  // Hiring fit panel
  fitPanel: { borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 12, marginBottom: 14, backgroundColor: C.bgSoft },
  fitLabel: { fontSize: 8, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.6 },
  fitValue: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 2 },
  fitGapTitle: { fontSize: 8.5, color: C.textLight, marginTop: 8, marginBottom: 3 },
  fitGapRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  fitGapName: { fontSize: 9 },
  fitGapNum: { fontSize: 9, color: "#b91c1c" },
  fitCaveat: { fontSize: 8, color: C.amber, marginTop: 8, lineHeight: 1.4 },
  fitGapNumDev: { fontSize: 9, color: "#B45309" },
  fitNote: { fontSize: 8, color: C.primary, marginTop: 8, lineHeight: 1.4 },
  sectionLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 4, marginBottom: 6 },

  // VIFM Academy training plan (development)
  academyPanel: { borderWidth: 1, borderColor: C.accent, borderRadius: 6, padding: 12, marginBottom: 14, backgroundColor: "#f5f9fe" },
  academyTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.primary },
  academySub: { fontSize: 8, color: C.textLight, marginTop: 1, marginBottom: 6, lineHeight: 1.4 },
  courseCard: { borderWidth: 1, borderColor: C.border, borderRadius: 5, padding: 8, marginBottom: 6, backgroundColor: "#ffffff" },
  courseHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  courseTitle: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.text },
  courseMeta: { fontSize: 8, color: C.textLight, marginTop: 1 },
  courseFit: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary },
  courseDriver: { fontSize: 7.5, color: C.sky, marginTop: 2, lineHeight: 1.4 },
  highFitTag: { fontSize: 7, color: "#92400e" },

  caption: { marginTop: 16, borderWidth: 1, borderColor: C.border, borderRadius: 5, backgroundColor: C.bgSoft, padding: 9, fontSize: 8.5, color: C.textLight },
  footer: { position: "absolute", bottom: 22, left: 44, right: 44, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7.5, color: C.textLight },
});

export function PersonaProfilePdf({ data }: { data: PersonaPdfData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.banner}>
          <Text style={s.eyebrow}>Persona® - Behavioural Self-Assessment</Text>
          <Text style={s.title}>{data.takerName || "Self-profile"}</Text>
          <Text style={s.subtitle}>
            {data.purpose === "hiring"
              ? "Role-fit read across the 38 competencies (same framework as the 360)"
              : "Development read across the 38 competencies (same framework as the 360)"}
          </Text>
        </View>

        {/* Role panel - hiring fit OR the development plan (both compare the
            self-profile against the target role; the framing differs). */}
        {data.fit && (
          <View style={s.fitPanel} wrap={false}>
            {data.purpose === "development" ? (
              <>
                <Text style={s.fitLabel}>Development plan · {data.fit.roleName}</Text>
                <Text style={[s.fitValue, { color: C.primary }]}>{data.fit.fitPct}% aligned to the role target</Text>
              </>
            ) : (
              <>
                <Text style={s.fitLabel}>Role fit · {data.fit.roleName}</Text>
                <Text style={[s.fitValue, { color: data.fit.bandHex }]}>{data.fit.fitPct}%  ·  {data.fit.bandLabel}</Text>
              </>
            )}
            {data.fit.strengths && data.fit.strengths.length > 0 ? (
              <>
                <Text style={[s.fitGapTitle, { color: C.emerald }]}>
                  {data.purpose === "development" ? "Strengths to leverage (self / target)" : "Biggest strengths (self / target)"}
                </Text>
                {data.fit.strengths.map((g) => (
                  <View key={`str-${g.name}`} style={s.fitGapRow}>
                    <Text style={s.fitGapName}>{g.name}</Text>
                    <Text style={[s.fitGapNum, { color: C.emerald }]}>{g.self.toFixed(1)} / {g.target.toFixed(1)}</Text>
                  </View>
                ))}
              </>
            ) : null}
            {data.fit.gaps.length > 0 ? (
              <>
                <Text style={s.fitGapTitle}>
                  {data.purpose === "development" ? "Development priorities (self / target)" : "Biggest gaps vs the role target (self / target)"}
                </Text>
                {data.fit.gaps.map((g) => (
                  <View key={g.name} style={s.fitGapRow}>
                    <Text style={s.fitGapName}>{g.name}</Text>
                    <Text style={data.purpose === "development" ? s.fitGapNumDev : s.fitGapNum}>
                      {g.self.toFixed(1)} / {g.target.toFixed(1)}  (-{g.gap.toFixed(1)})
                    </Text>
                  </View>
                ))}
              </>
            ) : (
              <Text style={s.fitGapTitle}>Meets or exceeds every target competency.</Text>
            )}
            {data.purpose === "development" ? (
              <Text style={s.fitNote}>
                A self-report development plan - pair it with a Reflect 360 (others&apos; view) and the recommended VIFM programmes below to turn priorities into progress.
              </Text>
            ) : (
              <Text style={s.fitCaveat}>
                A self-report screening signal - corroborate with a Reflect 360, interview and evidence before any hiring decision.
              </Text>
            )}
          </View>
        )}

        {/* VIFM Academy training plan (development) */}
        {data.purpose === "development" && data.courses && data.courses.length > 0 && (
          <View style={s.academyPanel}>
            <Text style={s.academyTitle}>Recommended VIFM Academy programmes</Text>
            <Text style={s.academySub}>
              Mapped to your development priorities - ranked by gap size and how strongly each programme targets it.
            </Text>
            {data.courses.map((c, i) => (
              <View key={`course-${i}`} style={s.courseCard} wrap={false}>
                <View style={s.courseHeadRow}>
                  <View style={{ flex: 1, paddingRight: 6 }}>
                    <Text style={s.courseTitle}>
                      {c.title}{c.highFit ? <Text style={s.highFitTag}>   * High fit</Text> : null}
                    </Text>
                    <Text style={s.courseMeta}>
                      {c.vertical} · {c.level} · {c.durationLabel}{c.code ? ` · ${c.code}` : ""}
                    </Text>
                  </View>
                  {c.fitOutOfTen > 0 ? <Text style={s.courseFit}>{c.fitOutOfTen}/10</Text> : null}
                </View>
                {c.drivers.length > 0 ? (
                  <Text style={s.courseDriver}>
                    {c.drivers.map((d) => `${d.label} (gap ${d.gap.toFixed(1)} ×${d.relevance})`).join("   ·   ")}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        <View style={s.overallRow}>
          <View>
            <Text style={s.overallLabel}>Overall self-rating</Text>
            <Text style={[s.overallValue, { color: band(data.overall) }]}>{data.overall.toFixed(2)} / 5  ·  {personaBand(data.overall).label}</Text>
          </View>
        </View>

        {data.clusters.map((cl) => (
          <View key={cl.name}>
            <View style={s.clusterTitleRow} wrap={false}>
              <Text style={s.clusterName}>{cl.name}</Text>
              <Text style={[s.clusterAvg, { color: band(cl.avg) }]}>{cl.avg.toFixed(1)} · {personaBand(cl.avg).label}</Text>
            </View>
            {cl.rows.map((r) => (
              <View key={r.name} style={s.row} wrap={false}>
                <View style={s.rowHead}>
                  <Text style={s.rowName}>{r.name}</Text>
                  <Text style={s.rowScore}>{r.score.toFixed(1)} · {personaBand(r.score).label}</Text>
                </View>
                {r.definition ? <Text style={s.rowDef}>{r.definition}</Text> : null}
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${(r.score / 5) * 100}%`, backgroundColor: C.accent }]} />
                </View>
                {r.narrative ? <Text style={s.rowNarr}>{r.narrative}</Text> : null}
                {r.tip ? <Text style={s.rowTip}>Suggestion: {r.tip}</Text> : null}
              </View>
            ))}
          </View>
        ))}

        <Text style={s.caption}>
          {data.purpose === "hiring"
            ? "This is an indicative self-report fit against the target role - a screening signal, not a hiring decision. Corroborate with a Reflect 360 (others), structured interview and work evidence."
            : "This is an indicative self-report - how you see yourself across the competencies. To turn it into a readiness verdict, pair Persona (self) with a Reflect 360 (others) against a target role."}
        </Text>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Virginia Institute of Finance and Management - Confidential</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Generated ${data.generatedAt}  -  ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
