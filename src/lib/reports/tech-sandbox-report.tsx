import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { SessionReport } from "@/lib/technical-sandbox/service";

/**
 * Technical sandbox result report (React-PDF). English-only — React-PDF can't
 * shape Arabic glyphs (same constraint as the Fluent certificate); a Puppeteer
 * port would be needed for an Arabic PDF. Data is largely numeric/neutral.
 */

const C = {
  primary: "#010131",
  accent: "#5391D5",
  text: "#121232",
  light: "#5b6577",
  border: "#dbe3ec",
  advanced: "#047857",
  intermediate: "#5391D5",
  basic: "#C2410C",
};

function bandColor(band: string): string {
  if (band === "advanced") return C.advanced;
  if (band === "intermediate") return C.intermediate;
  return C.basic;
}
function bandLabel(band: string): string {
  return band.charAt(0).toUpperCase() + band.slice(1);
}

const s = StyleSheet.create({
  page: { padding: 36, fontFamily: "Helvetica", fontSize: 10, color: C.text },
  brand: { fontSize: 8, color: C.accent, letterSpacing: 2, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 6 },
  meta: { fontSize: 9, color: C.light, marginTop: 4 },
  hr: { borderBottomWidth: 1, borderBottomColor: C.border, marginVertical: 12 },
  overallRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  overallScore: { fontSize: 32, fontFamily: "Helvetica-Bold", color: C.primary },
  badge: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  pillar: { marginTop: 14 },
  pillarHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  pillarName: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.primary },
  pillarRoll: { fontSize: 8, color: C.light },
  block: { borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 8, marginTop: 6 },
  blockHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  blockName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.text, flex: 1, paddingRight: 8 },
  blockScore: { flexDirection: "row", alignItems: "center" },
  smallBadge: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 8,
    marginLeft: 6,
  },
  framework: { fontSize: 7, color: C.light, marginTop: 2 },
  cp: { flexDirection: "row", alignItems: "flex-start", marginTop: 3 },
  cpMark: { fontSize: 8, fontFamily: "Helvetica-Bold", width: 26 },
  cpLabel: { fontSize: 8, color: C.text, flex: 1 },
  footer: { position: "absolute", bottom: 22, left: 36, right: 36, fontSize: 7, color: C.light, textAlign: "center" },
});

export function TechSandboxReport({ data }: { data: SessionReport }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>VIFM · TECHNICAL ASSESSMENT</Text>
        <Text style={s.title}>
          {data.nodeId ? `${data.nodeId} · ` : ""}
          {data.functionName}
        </Text>
        <Text style={s.meta}>
          {data.candidateName ? `Candidate: ${data.candidateName}` : "Candidate: —"}
          {data.candidateEmail ? `  ·  ${data.candidateEmail}` : ""}
          {data.organizationName ? `  ·  ${data.organizationName}` : ""}
        </Text>
        <Text style={s.meta}>
          {data.submittedAt ? `Completed: ${new Date(data.submittedAt).toLocaleString()}` : ""}
        </Text>

        <View style={s.hr} />

        <View style={s.overallRow}>
          <View>
            <Text style={{ fontSize: 9, color: C.light }}>Overall</Text>
            <Text style={s.overallScore}>{data.overallPct}%</Text>
          </View>
          <Text style={[s.badge, { backgroundColor: bandColor(data.overallBand) }]}>
            {bandLabel(data.overallBand)}
          </Text>
        </View>

        {data.pillars.map((p) => (
          <View key={p.nameEn} style={s.pillar} wrap={false}>
            <View style={s.pillarHead}>
              <Text style={s.pillarName}>{p.nameEn}</Text>
              <Text style={s.pillarRoll}>
                {p.advancedCount} advanced · {p.intermediateCount} intermediate · {p.basicCount} basic
              </Text>
            </View>
            {p.blocks.map((b) => (
              <View key={b.nameEn} style={s.block} wrap={false}>
                <View style={s.blockHead}>
                  <Text style={s.blockName}>{b.nameEn}</Text>
                  <View style={s.blockScore}>
                    <Text style={{ fontSize: 10, color: C.light }}>{b.scorePct}%</Text>
                    <Text style={[s.smallBadge, { backgroundColor: bandColor(b.band) }]}>
                      {bandLabel(b.band)}
                    </Text>
                  </View>
                </View>
                {b.frameworkRef ? <Text style={s.framework}>{b.frameworkRef}</Text> : null}
                {b.checkpoints.map((c, i) => (
                  <View key={i} style={s.cp}>
                    <Text style={[s.cpMark, { color: c.passed ? C.advanced : C.basic }]}>
                      {c.passed ? "PASS" : "MISS"}
                    </Text>
                    <Text style={s.cpLabel}>{c.label}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ))}

        <Text style={s.footer} fixed>
          VIFM Technical Assessment · Bands: Basic &lt; 60 · Intermediate 60–84 · Advanced ≥ 85 ·
          Generated {new Date().toLocaleDateString()}
        </Text>
      </Page>
    </Document>
  );
}
