import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

/**
 * Fluent - CEFR placement certificate (React-PDF).
 *
 * A true single-page PDF (A4 landscape) the taker can download directly,
 * alongside the printable HTML version. English-only (the HTML cert is
 * English too); React-PDF can't shape Arabic glyphs - a Puppeteer port
 * would be needed for an Arabic certificate, as with the ARA reports.
 */

export type FluentCertificateData = {
  id: string;
  name: string;
  date: string; // already formatted
  overall_cefr: string;
  level_label: string;
  range?: string | null; // indicative confidence band, e.g. "B1–B2"
  skills: Array<{ label: string; cefr: string }>;
};

const C = {
  primary: "#010131",
  accent: "#5391D5",
  text: "#121232",
  light: "#5b6577",
  border: "#dbe3ec",
  muted: "#9aa5b5",
};

const s = StyleSheet.create({
  page: { padding: 34, fontFamily: "Helvetica", fontSize: 11, color: C.text },
  frame: {
    borderWidth: 2,
    borderColor: C.accent,
    borderRadius: 8,
    paddingTop: 26,
    paddingBottom: 22,
    paddingHorizontal: 30,
    alignItems: "center",
    height: "100%",
  },
  brand: { fontSize: 9, color: C.accent, letterSpacing: 3, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 21, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 10, textAlign: "center" },
  subtitle: { fontSize: 9, color: C.light, marginTop: 5, marginBottom: 16 },
  awarded: { fontSize: 9, color: C.light, letterSpacing: 1, marginTop: 4 },
  name: {
    fontSize: 25,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    marginTop: 4,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 6,
    paddingHorizontal: 16,
  },
  circle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  circleLv: { fontSize: 38, color: "#fff", fontFamily: "Helvetica-Bold" },
  circleLb: { fontSize: 8, color: "#fff", letterSpacing: 1, marginTop: 2 },
  levelDesc: { fontSize: 11, color: C.light, marginTop: 8, marginBottom: 4 },
  rangeNote: { fontSize: 9, color: C.muted, marginBottom: 14 },
  skillsRow: { flexDirection: "row", marginBottom: 16 },
  skill: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center",
    minWidth: 92,
    marginHorizontal: 5,
  },
  skillLabel: { fontSize: 8, color: C.light, letterSpacing: 1 },
  skillCefr: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 3 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 12, paddingHorizontal: 16 },
  metaLabel: { fontSize: 8, color: C.light },
  metaVal: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.text, marginTop: 2 },
  sig: { alignItems: "center" },
  sigLine: { width: 150, borderTopWidth: 1, borderTopColor: C.muted, marginBottom: 4 },
  disclaimer: { fontSize: 7.5, color: C.muted, marginTop: 18, textAlign: "center", paddingHorizontal: 24, lineHeight: 1.4 },
  verify: { fontSize: 7, color: C.muted, marginTop: 6, fontFamily: "Courier" },
});

export function FluentCertificate({ data }: { data: FluentCertificateData }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.frame}>
          <Text style={s.brand}>VIRGINIA INSTITUTE OF FINANCE &amp; MANAGEMENT</Text>
          <Text style={s.title}>Fluent® - Certificate of English Placement</Text>
          <Text style={s.subtitle}>
            CEFR-aligned indicative placement · Reading · Listening · Writing · Speaking
          </Text>

          <Text style={s.awarded}>THIS IS TO CERTIFY THAT</Text>
          <Text style={s.name}>{data.name}</Text>

          <View style={s.circle}>
            <Text style={s.circleLv}>{data.overall_cefr}</Text>
            <Text style={s.circleLb}>CEFR</Text>
          </View>
          <Text style={s.levelDesc}>
            Indicative level {data.overall_cefr}
            {data.level_label ? ` - ${data.level_label}` : ""}
          </Text>
          {data.range ? <Text style={s.rangeNote}>Indicative range: {data.range}</Text> : null}

          <View style={s.skillsRow}>
            {data.skills.map((sk) => (
              <View style={s.skill} key={sk.label}>
                <Text style={s.skillLabel}>{sk.label.toUpperCase()}</Text>
                <Text style={s.skillCefr}>{sk.cefr}</Text>
              </View>
            ))}
          </View>

          <View style={s.metaRow}>
            <View>
              <Text style={s.metaLabel}>Date of assessment</Text>
              <Text style={s.metaVal}>{data.date}</Text>
            </View>
            <View style={s.sig}>
              <View style={s.sigLine} />
              <Text style={s.metaLabel}>VIFM Assessment Center</Text>
            </View>
          </View>

          <Text style={s.disclaimer}>
            This certificate reflects an AI-assisted, CEFR-aligned indicative placement produced by VIFM
            Fluent. It is intended for placement and development purposes and is not a certified
            high-stakes language qualification.
          </Text>
          <Text style={s.verify}>Verification ID: {data.id}</Text>
        </View>
      </Page>
    </Document>
  );
}
