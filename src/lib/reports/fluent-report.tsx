import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { FluentResult, WritingIssue } from "@/lib/ai/fluent-english";

/**
 * Fluent - comprehensive English placement REPORT (PDF, EN, React-PDF). Unlike
 * the one-page certificate, this is the full per-skill breakdown an admin
 * downloads/sends: reading + listening (auto-scored), writing (7 criteria +
 * feedback + specific issues, FLU-4) and speaking (criteria + transcript), plus
 * a "what we measure" definitions block. Indicative placement, not a certified
 * score. Fed by the stored `result` jsonb on eng_fluent_results.
 */

const C = {
  primary: "#010131",
  accent: "#5391D5",
  text: "#121232",
  light: "#5b6577",
  border: "#dbe3ec",
  bgSoft: "#f6f8fc",
  emerald: "#047857",
  rose: "#be123c",
  amber: "#b45309",
};

const CEFR_LABEL: Record<string, string> = {
  A1: "Beginner", A2: "Elementary", B1: "Intermediate",
  B2: "Upper-intermediate", C1: "Advanced", C2: "Proficient / Mastery",
};

const ISSUE_LABEL: Record<WritingIssue["category"], string> = {
  grammar: "Grammar", spelling: "Spelling", punctuation: "Punctuation",
  vocabulary: "Vocabulary", etiquette: "Etiquette", structure: "Structure",
};

const WRITE_CRIT: Array<[keyof FluentResult["writing"], string]> = [
  ["task_achievement", "Task achievement"],
  ["coherence", "Coherence & cohesion"],
  ["lexical_range", "Lexical resource"],
  ["grammar", "Grammar range & accuracy"],
  ["register", "Register (business-like)"],
  ["etiquette", "Etiquette & courtesy"],
  ["mechanics", "Spelling & punctuation"],
];
const SPEAK_CRIT: Array<[keyof FluentResult["speaking"], string]> = [
  ["fluency", "Fluency"],
  ["coherence", "Coherence"],
  ["lexical_range", "Lexical resource"],
  ["grammar", "Grammar range & accuracy"],
];

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9.5, color: C.text },
  banner: { backgroundColor: C.primary, borderRadius: 6, paddingVertical: 16, paddingHorizontal: 18, marginBottom: 14 },
  eyebrow: { fontSize: 7.5, color: C.accent, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  title: { fontSize: 19, color: "#fff", fontFamily: "Helvetica-Bold", marginTop: 4 },
  sub: { fontSize: 9, color: "#fff", opacity: 0.8, marginTop: 3 },
  overallRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  overallCefr: { fontSize: 26, color: "#fff", fontFamily: "Helvetica-Bold" },
  overallLabel: { fontSize: 9, color: "#fff", opacity: 0.85 },

  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 12, marginBottom: 6 },
  skillRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  skillCard: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 5, padding: 8 },
  skillName: { fontSize: 7.5, color: C.light, textTransform: "uppercase", letterSpacing: 0.4 },
  skillCefr: { fontSize: 15, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 2 },
  skillNote: { fontSize: 8, color: C.light, marginTop: 1 },

  block: { borderWidth: 1, borderColor: C.border, borderRadius: 5, padding: 10, marginBottom: 8 },
  critRow: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  critLabel: { width: 150, fontSize: 8.5 },
  barTrack: { flex: 1, height: 6, backgroundColor: "#eceef4", borderRadius: 3, marginHorizontal: 6 },
  critVal: { width: 26, textAlign: "right", fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.primary },
  feedback: { fontSize: 8.5, color: C.text, lineHeight: 1.4, marginTop: 5, backgroundColor: C.bgSoft, padding: 6, borderRadius: 4 },

  issueRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  issueTag: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#fff", paddingVertical: 1.5, paddingHorizontal: 5, borderRadius: 3, marginTop: 1 },
  issueBody: { flex: 1 },
  issueQuote: { fontSize: 8.5, color: C.rose },
  issueSugg: { fontSize: 8.5, color: C.emerald },

  defTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: C.primary, marginTop: 6, marginBottom: 2 },
  defLine: { fontSize: 8, color: C.light, lineHeight: 1.4, marginBottom: 1 },
  foot: { position: "absolute", bottom: 22, left: 40, right: 40, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 5, fontSize: 7.5, color: C.light },
});

function barColor(v: number): string {
  if (v >= 4) return C.emerald;
  if (v >= 3) return C.accent;
  if (v >= 2) return C.amber;
  return C.rose;
}
function issueColor(cat: WritingIssue["category"]): string {
  if (cat === "etiquette") return C.amber;
  if (cat === "vocabulary" || cat === "structure") return C.accent;
  return C.rose;
}

function Criterion({ label, value }: { label: string; value: number }) {
  return (
    <View style={s.critRow}>
      <Text style={s.critLabel}>{label}</Text>
      <View style={s.barTrack}>
        <View style={{ height: 6, borderRadius: 3, width: `${(value / 5) * 100}%`, backgroundColor: barColor(value) }} />
      </View>
      <Text style={s.critVal}>{value}/5</Text>
    </View>
  );
}

export function FluentReport({ data }: { data: { name: string; date: string; result: FluentResult; rangeText: string | null } }) {
  const r = data.result;
  const w = r.writing;
  const sp = r.speaking;
  const issues = w.issues ?? [];
  return (
    <Document title={`English Placement Report - ${data.name}`}>
      <Page size="A4" style={s.page}>
        <View style={s.banner}>
          <Text style={s.eyebrow}>VIFM · English Placement Report</Text>
          <Text style={s.title}>{data.name}</Text>
          <Text style={s.sub}>Indicative CEFR placement · {data.date}</Text>
          <View style={s.overallRow}>
            <Text style={s.overallCefr}>{r.overall_cefr}</Text>
            <Text style={s.overallLabel}>
              Overall · {CEFR_LABEL[r.overall_cefr] ?? ""}
              {data.rangeText ? ` · confidence range ${data.rangeText}` : ""}
            </Text>
          </View>
        </View>

        {/* Per-skill summary */}
        <View style={s.skillRow}>
          <View style={s.skillCard}>
            <Text style={s.skillName}>Reading</Text>
            <Text style={s.skillCefr}>{r.reading_cefr}</Text>
            <Text style={s.skillNote}>{r.reading_correct}/{r.reading_total} correct</Text>
          </View>
          {r.listening_total > 0 && (
            <View style={s.skillCard}>
              <Text style={s.skillName}>Listening</Text>
              <Text style={s.skillCefr}>{r.listening_cefr}</Text>
              <Text style={s.skillNote}>{r.listening_correct}/{r.listening_total} correct</Text>
            </View>
          )}
          <View style={s.skillCard}>
            <Text style={s.skillName}>Writing</Text>
            <Text style={s.skillCefr}>{w.cefr}</Text>
            <Text style={s.skillNote}>AI-scored</Text>
          </View>
          <View style={s.skillCard}>
            <Text style={s.skillName}>Speaking</Text>
            <Text style={s.skillCefr}>{sp.attempted ? sp.cefr : "-"}</Text>
            <Text style={s.skillNote}>{sp.attempted ? "AI-scored" : "Not attempted"}</Text>
          </View>
        </View>

        {/* Writing detail */}
        <Text style={s.sectionTitle}>Writing</Text>
        <View style={s.block} wrap={false}>
          {WRITE_CRIT.map(([k, label]) => (
            <Criterion key={k as string} label={label} value={w[k] as number} />
          ))}
          {w.feedback_en ? <Text style={s.feedback}>{w.feedback_en}</Text> : null}
        </View>
        {issues.length > 0 && (
          <View style={s.block}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 2 }}>
              Specific issues ({issues.length})
            </Text>
            {issues.map((it, i) => (
              <View key={i} style={s.issueRow} wrap={false}>
                <Text style={[s.issueTag, { backgroundColor: issueColor(it.category) }]}>{ISSUE_LABEL[it.category]}</Text>
                <View style={s.issueBody}>
                  {it.quote ? <Text style={s.issueQuote}>&ldquo;{it.quote}&rdquo;</Text> : null}
                  {it.suggestion ? <Text style={s.issueSugg}>{"→"} {it.suggestion}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Speaking detail */}
        {sp.attempted && (
          <>
            <Text style={s.sectionTitle}>Speaking</Text>
            <View style={s.block} wrap={false}>
              {SPEAK_CRIT.map(([k, label]) => (
                <Criterion key={k as string} label={label} value={sp[k] as number} />
              ))}
              {typeof sp.pronunciation === "number" && <Criterion label="Pronunciation" value={sp.pronunciation} />}
              {sp.transcript ? (
                <Text style={{ fontSize: 8, color: C.light, marginTop: 5, lineHeight: 1.4 }}>
                  Transcript: {sp.transcript.slice(0, 600)}
                </Text>
              ) : null}
              {sp.feedback_en ? <Text style={s.feedback}>{sp.feedback_en}</Text> : null}
            </View>
          </>
        )}

        {/* What we measure */}
        <Text style={s.sectionTitle}>What we measure</Text>
        <View style={s.block}>
          <Text style={s.defLine}><Text style={{ fontFamily: "Helvetica-Bold" }}>Reading:</Text> understanding written English - gist, detail, inference, vocabulary in context.</Text>
          <Text style={s.defLine}><Text style={{ fontFamily: "Helvetica-Bold" }}>Listening:</Text> understanding spoken English from a single hearing - gist, detail, inference, flow.</Text>
          <Text style={s.defLine}><Text style={{ fontFamily: "Helvetica-Bold" }}>Writing:</Text> producing written English that completes a workplace task, on the seven criteria above.</Text>
          <Text style={s.defLine}><Text style={{ fontFamily: "Helvetica-Bold" }}>Speaking:</Text> producing spoken English in response to a prompt, on the criteria above.</Text>
          <Text style={s.defTitle}>Scale</Text>
          <Text style={s.defLine}>Each criterion is rated 1-5. Skill bands map to CEFR (A1 to C2). This is an indicative placement to inform a human decision, not a certified high-stakes score.</Text>
        </View>

        <Text style={s.foot} fixed>
          Virginia Institute of Finance and Management - Confidential. Indicative English placement; AI-assisted scoring, human-reviewed.
        </Text>
      </Page>
    </Document>
  );
}
