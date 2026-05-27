import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

/**
 * VIFM Verify - generic credential certificate (React-PDF, A4 landscape).
 *
 * One template for every credential type (course completion, AC Ready-Now,
 * Fluent CEFR). English-only, mirroring the Fluent certificate; an Arabic
 * port would need Puppeteer (React-PDF cannot shape Arabic glyphs). The
 * footer carries the public verification URL so the credential is checkable.
 */

export type CredentialCertificateData = {
  verificationCode: string;
  name: string;
  typeLabel: string; // e.g. "Course Completion"
  titleEn: string;
  subtitleEn?: string | null;
  issuedAt: string; // pre-formatted
  expiresAt?: string | null; // pre-formatted
  scorePct?: number | null;
  verifyUrl: string; // https://caliber.viftraining.com/verify/[code]
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
    paddingTop: 30,
    paddingBottom: 24,
    paddingHorizontal: 32,
    alignItems: "center",
    height: "100%",
  },
  brand: { fontSize: 9, color: C.accent, letterSpacing: 3, fontFamily: "Helvetica-Bold" },
  title: { fontSize: 21, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 10 },
  typeLabel: { fontSize: 9, color: C.light, letterSpacing: 2, marginTop: 6, marginBottom: 18 },
  awarded: { fontSize: 9, color: C.light, letterSpacing: 1, marginTop: 6 },
  name: {
    fontSize: 25,
    fontFamily: "Helvetica-Bold",
    color: C.primary,
    marginTop: 4,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    paddingBottom: 6,
    paddingHorizontal: 16,
  },
  credTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 2, textAlign: "center", paddingHorizontal: 30 },
  subtitle: { fontSize: 10, color: C.light, marginTop: 6, textAlign: "center", paddingHorizontal: 50 },
  score: { fontSize: 12, color: C.accent, fontFamily: "Helvetica-Bold", marginTop: 8 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 24, paddingHorizontal: 18 },
  metaLabel: { fontSize: 8, color: C.light },
  metaVal: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.text, marginTop: 2 },
  sig: { alignItems: "center" },
  sigLine: { width: 170, borderTopWidth: 1, borderTopColor: C.muted, marginBottom: 4 },
  disclaimer: { fontSize: 7.5, color: C.muted, marginTop: 18, textAlign: "center", paddingHorizontal: 24, lineHeight: 1.4 },
  verify: { fontSize: 8, color: C.muted, marginTop: 8, fontFamily: "Courier" },
});

export function CredentialCertificate({ data }: { data: CredentialCertificateData }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        <View style={s.frame}>
          <Text style={s.brand}>VIRGINIA INSTITUTE OF FINANCE &amp; MANAGEMENT</Text>
          <Text style={s.title}>Certificate</Text>
          <Text style={s.typeLabel}>{data.typeLabel.toUpperCase()}</Text>

          <Text style={s.awarded}>THIS IS TO CERTIFY THAT</Text>
          <Text style={s.name}>{data.name}</Text>

          <Text style={s.credTitle}>{data.titleEn}</Text>
          {data.subtitleEn ? <Text style={s.subtitle}>{data.subtitleEn}</Text> : null}
          {data.scorePct != null ? <Text style={s.score}>Score: {data.scorePct}%</Text> : null}

          <View style={s.metaRow}>
            <View>
              <Text style={s.metaLabel}>Issued</Text>
              <Text style={s.metaVal}>{data.issuedAt}</Text>
            </View>
            {data.expiresAt ? (
              <View>
                <Text style={s.metaLabel}>Valid until</Text>
                <Text style={s.metaVal}>{data.expiresAt}</Text>
              </View>
            ) : null}
            <View style={s.sig}>
              <View style={s.sigLine} />
              <Text style={s.metaLabel}>Virginia Institute of Finance and Management</Text>
            </View>
          </View>

          <Text style={s.disclaimer}>
            This credential was issued by the Virginia Institute of Finance and Management. Verify its
            authenticity at the address below.
          </Text>
          <Text style={s.verify}>Verify at: {data.verifyUrl}</Text>
        </View>
      </Page>
    </Document>
  );
}
