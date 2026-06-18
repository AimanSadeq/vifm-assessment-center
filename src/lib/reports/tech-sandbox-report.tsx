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
  devNote: { fontSize: 8, color: C.light, marginTop: 5, lineHeight: 1.35 },
  legendBox: { borderWidth: 1, borderColor: C.border, borderRadius: 4, padding: 8, marginTop: 12 },
  legendHead: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 4 },
  legendRow: { flexDirection: "row", flexWrap: "wrap" },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 14, marginBottom: 2 },
  legendDot: { width: 8, height: 8, borderRadius: 4, marginRight: 5 },
  legendText: { fontSize: 8, color: C.text },
  legendHint: { fontSize: 7, color: C.light, marginTop: 3 },
  narrativeBox: { backgroundColor: "#f5f8fc", borderRadius: 4, padding: 10, marginTop: 12 },
  narrativeHead: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 3 },
  narrativeText: { fontSize: 9.5, color: C.text, lineHeight: 1.4 },
  sectionLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.accent, letterSpacing: 1, marginTop: 16, marginBottom: 2 },
  pillarDef: { fontSize: 8, color: C.light, marginBottom: 4, lineHeight: 1.35 },
  devFocus: { fontSize: 8, color: C.accent, marginBottom: 4, lineHeight: 1.35 },
  blockDef: { fontSize: 7.5, color: C.light, marginTop: 2, lineHeight: 1.3 },
  purpose: { fontSize: 8, color: C.light, marginTop: 6, lineHeight: 1.35 },
  kSection: { marginTop: 6 },
  kRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 3 },
  kName: { fontSize: 9, color: C.text, flex: 1, paddingRight: 8 },
  kScore: { flexDirection: "row", alignItems: "center" },
  footer: { position: "absolute", bottom: 22, left: 36, right: 36, fontSize: 7, color: C.light, textAlign: "center" },
});

export function TechSandboxReport({ data }: { data: SessionReport }) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.brand}>VIFM · TECHNICAL ASSESSMENT®</Text>
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
        <Text style={s.purpose}>
          Development report - prepared to guide this person&apos;s development, for review by their
          manager or learning-and-development lead. It explains what was assessed and where to focus
          development; it is not a pass/fail or hiring decision.
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

        <View style={s.legendBox} wrap={false}>
          <Text style={s.legendHead}>Proficiency bands</Text>
          <View style={s.legendRow}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: C.basic }]} />
              <Text style={s.legendText}>Basic &lt; 60%</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: C.intermediate }]} />
              <Text style={s.legendText}>Intermediate 60-84%</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: C.advanced }]} />
              <Text style={s.legendText}>Advanced &ge; 85%</Text>
            </View>
          </View>
          <Text style={s.legendHint}>
            How to read: each category and subcategory below is scored 0-100% and banded against these
            three thresholds.
          </Text>
        </View>

        {data.narrativeEn ? (
          <View style={s.narrativeBox} wrap={false}>
            <Text style={s.narrativeHead}>Performance summary</Text>
            <Text style={s.narrativeText}>{data.narrativeEn}</Text>
          </View>
        ) : null}

        {data.knowledgeSkills.length > 0 ? (
          <View style={s.kSection} wrap={false}>
            <Text style={s.sectionLabel}>KNOWLEDGE BY SUBCATEGORY</Text>
            <Text style={s.pillarName}>
              Knowledge section{data.knowledgePct != null ? ` · ${data.knowledgePct}% overall` : ""}
            </Text>
            {data.knowledgeSkills.map((k) => (
              <View key={k.skill} style={s.kRow}>
                <Text style={s.kName}>{k.skill}</Text>
                <View style={s.kScore}>
                  <Text style={{ fontSize: 9, color: C.light }}>{k.scorePct}%</Text>
                  <Text style={[s.smallBadge, { backgroundColor: bandColor(k.band) }]}>
                    {bandLabel(k.band)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {data.pillars.length > 0 ? (
          <Text style={s.sectionLabel}>HANDS-ON TASKS BY CATEGORY</Text>
        ) : null}

        {data.pillars.map((p) => (
          <View key={p.nameEn} style={s.pillar} wrap={false}>
            <View style={s.pillarHead}>
              <Text style={s.pillarName}>{p.nameEn}</Text>
              <Text style={s.pillarRoll}>
                {p.advancedCount} advanced · {p.intermediateCount} intermediate · {p.basicCount} basic
              </Text>
            </View>
            {p.descriptionEn ? <Text style={s.pillarDef}>{p.descriptionEn}</Text> : null}
            {p.developmentFocusEn ? (
              <Text style={s.devFocus}>Development focus: {p.developmentFocusEn}</Text>
            ) : null}
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
                {b.descriptionEn ? <Text style={s.blockDef}>{b.descriptionEn}</Text> : null}
                {b.frameworkRef ? <Text style={s.framework}>{b.frameworkRef}</Text> : null}
                {b.checkpoints.map((c, i) => (
                  <View key={i} style={s.cp}>
                    <Text style={[s.cpMark, { color: c.passed ? C.advanced : C.basic }]}>
                      {c.passed ? "PASS" : "MISS"}
                    </Text>
                    <Text style={s.cpLabel}>{c.label}</Text>
                  </View>
                ))}
                {b.developmentNoteEn ? (
                  <Text style={s.devNote}>{b.developmentNoteEn}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ))}

        <Text style={s.footer} fixed>
          VIFM Technical Assessment® · Bands: Basic &lt; 60 · Intermediate 60-84 · Advanced &ge; 85 ·
          Generated {new Date().toLocaleDateString()}
        </Text>
      </Page>
    </Document>
  );
}
