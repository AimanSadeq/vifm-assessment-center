import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

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

export type PersonaPdfCluster = { name: string; avg: number; rows: { name: string; score: number }[] };
export type PersonaPdfData = {
  takerName: string | null;
  generatedAt: string;
  overall: number;
  clusters: PersonaPdfCluster[];
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

  row: { marginBottom: 5 },
  rowHead: { flexDirection: "row", justifyContent: "space-between" },
  rowName: { fontSize: 9.5 },
  rowScore: { fontSize: 9.5, color: C.textLight },
  barTrack: { height: 5, backgroundColor: "#eef0f3", borderRadius: 3, marginTop: 2 },
  barFill: { height: 5, borderRadius: 3 },

  caption: { marginTop: 16, borderWidth: 1, borderColor: C.border, borderRadius: 5, backgroundColor: C.bgSoft, padding: 9, fontSize: 8.5, color: C.textLight },
  footer: { position: "absolute", bottom: 22, left: 44, right: 44, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7.5, color: C.textLight },
});

export function PersonaProfilePdf({ data }: { data: PersonaPdfData }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.banner}>
          <Text style={s.eyebrow}>Persona - Behavioural Self-Assessment</Text>
          <Text style={s.title}>{data.takerName || "Self-profile"}</Text>
          <Text style={s.subtitle}>Self-ratings across the 38 competencies (same framework as the 360)</Text>
        </View>

        <View style={s.overallRow}>
          <View>
            <Text style={s.overallLabel}>Overall self-rating</Text>
            <Text style={[s.overallValue, { color: band(data.overall) }]}>{data.overall.toFixed(2)} / 5</Text>
          </View>
        </View>

        {data.clusters.map((cl) => (
          <View key={cl.name} wrap={false}>
            <View style={s.clusterTitleRow}>
              <Text style={s.clusterName}>{cl.name}</Text>
              <Text style={[s.clusterAvg, { color: band(cl.avg) }]}>{cl.avg.toFixed(1)}</Text>
            </View>
            {cl.rows.map((r) => (
              <View key={r.name} style={s.row}>
                <View style={s.rowHead}>
                  <Text style={s.rowName}>{r.name}</Text>
                  <Text style={s.rowScore}>{r.score.toFixed(1)}</Text>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${(r.score / 5) * 100}%`, backgroundColor: C.accent }]} />
                </View>
              </View>
            ))}
          </View>
        ))}

        <Text style={s.caption}>
          This is an indicative self-report - how you see yourself across the competencies. To turn it into a
          readiness verdict, pair Persona (self) with a Reflect 360 (others) against a target role.
        </Text>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Virginia Institute of Finance and Management - Confidential</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Generated ${data.generatedAt}  -  ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
