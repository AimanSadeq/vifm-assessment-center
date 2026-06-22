import { Document, Page, Text, View, StyleSheet, Link } from "@react-pdf/renderer";
import type { FluentResult, WritingIssue } from "@/lib/ai/fluent-english";
import type { IntegritySignal } from "@/lib/scoring/integrity";
import type { EnglishRecommendations, EnglishCourseRec } from "@/lib/recommender/english";

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

// What each productive-skill criterion measures (CAL-FLU report-parity): the
// report shows a 1-5 bar per criterion; these one-line definitions tell the
// reader what that criterion is actually rating.
const WRITE_DEF: Record<string, string> = {
  task_achievement: "Addresses every part of the prompt with relevant, on-topic content.",
  coherence: "Organises ideas logically and links them with clear connectors.",
  lexical_range: "Range and precision of vocabulary, including word choice and collocation.",
  grammar: "Variety and correctness of sentence structures and grammatical forms.",
  register: "Maintains an appropriate, business-like tone for the audience and purpose.",
  etiquette: "Observes professional conventions - greeting, polite requests, sign-off.",
  mechanics: "Accuracy of spelling, punctuation and capitalisation.",
};
const SPEAK_DEF: Record<string, string> = {
  fluency: "Speaks at a natural pace with limited hesitation or self-correction.",
  coherence: "Organises spoken ideas logically so they are easy to follow.",
  lexical_range: "Range and precision of vocabulary used when speaking.",
  grammar: "Variety and correctness of the structures used in speech.",
};
const PRON_DEF = "Clarity of individual sounds, word stress and intonation.";

// Receptive skills (reading + listening) are auto-scored MCQs, so the report has
// no per-criterion bars to show - instead it narrates the sub-skills each one
// measures and what the band reflects (CAL-FLU receptive-detail).
const READING_NARRATIVE =
  "Reading measures comprehension of written English across four sub-skills: gist (the overall point of a passage), specific detail (locating explicit facts), inference (meaning that is implied rather than stated), and vocabulary in context (working out unfamiliar words from how they are used). Items are auto-scored multiple-choice; the band reflects the level of text the candidate can reliably understand.";
const LISTENING_NARRATIVE =
  "Listening measures comprehension of spoken English from a single hearing, across four sub-skills: gist, specific detail, inference, and following discourse and flow (how ideas connect across a passage). Items are auto-scored multiple-choice; the band reflects the level of speech the candidate can reliably follow without replaying it.";

const INTEGRITY_TIER_LABEL: Record<IntegritySignal["tier"], string> = {
  clean: "Clean",
  minor: "Minor activity",
  elevated: "Elevated activity",
};

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
  skillScoreLine: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 3 },
  narrative: { fontSize: 8.5, color: C.text, lineHeight: 1.45 },

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

  recProvider: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.accent, textTransform: "uppercase", letterSpacing: 0.5, marginTop: 7, marginBottom: 3 },
  recRow: { borderTopWidth: 1, borderTopColor: C.border, paddingTop: 4, marginTop: 4 },
  recTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary },
  recMeta: { fontSize: 7.5, color: C.light, marginTop: 1 },
  recReason: { fontSize: 8, color: C.text, lineHeight: 1.35, marginTop: 1 },

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
function integrityTone(tier: IntegritySignal["tier"]): { borderColor: string; backgroundColor: string } {
  if (tier === "elevated") return { borderColor: "#fda4af", backgroundColor: "#fff1f2" };
  if (tier === "minor") return { borderColor: "#fcd34d", backgroundColor: "#fffbeb" };
  return { borderColor: "#6ee7b7", backgroundColor: "#ecfdf5" };
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

const SKILL_LABEL: Record<string, string> = {
  reading: "reading", listening: "listening", writing: "writing", speaking: "speaking",
};

function RecRow({ c }: { c: EnglishCourseRec }) {
  const meta = [c.code, c.level_label].filter(Boolean).join(" · ");
  return (
    <View style={s.recRow} wrap={false}>
      <Text style={s.recTitle}>{c.title_en}</Text>
      {meta ? <Text style={s.recMeta}>{meta}</Text> : null}
      <Text style={s.recReason}>{c.reason_en}</Text>
      {c.url ? <Text style={s.recMeta}>{c.url}</Text> : null}
    </View>
  );
}

export function FluentReport({
  data,
}: {
  data: {
    name: string;
    date: string;
    result: FluentResult;
    rangeText: string | null;
    integrity?: IntegritySignal | null;
    recommendations?: EnglishRecommendations | null;
    proctoring?: { sessionId: string; reportUrl: string | null } | null;
  };
}) {
  const r = data.result;
  const w = r.writing;
  const sp = r.speaking;
  const issues = w.issues ?? [];
  const recs = data.recommendations ?? null;
  const hasRecs = !!recs && (recs.vifm.length > 0 || recs.partner.length > 0);
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

        {/* Reading detail - receptive skill: narrate the sub-skills measured */}
        <Text style={s.sectionTitle}>Reading</Text>
        <View style={s.block}>
          <Text style={s.skillScoreLine}>
            Band {r.reading_cefr} ({CEFR_LABEL[r.reading_cefr] ?? ""}) · {r.reading_correct}/{r.reading_total} correct
          </Text>
          <Text style={s.narrative}>{READING_NARRATIVE}</Text>
        </View>

        {/* Listening detail - only when the test included listening items */}
        {r.listening_total > 0 && (
          <>
            <Text style={s.sectionTitle}>Listening</Text>
            <View style={s.block}>
              <Text style={s.skillScoreLine}>
                Band {r.listening_cefr} ({CEFR_LABEL[r.listening_cefr] ?? ""}) · {r.listening_correct}/{r.listening_total} correct
              </Text>
              <Text style={s.narrative}>{LISTENING_NARRATIVE}</Text>
            </View>
          </>
        )}

        {/* Writing detail */}
        <Text style={s.sectionTitle}>Writing</Text>
        <View style={s.block} wrap={false}>
          {WRITE_CRIT.map(([k, label]) => (
            <Criterion key={k as string} label={label} value={w[k] as number} />
          ))}
          {w.feedback_en ? <Text style={s.feedback}>{w.feedback_en}</Text> : null}
        </View>
        <View style={s.block}>
          <Text style={s.defTitle}>What each writing criterion means</Text>
          {WRITE_CRIT.map(([k, label]) => (
            <Text key={k as string} style={s.defLine}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{label}: </Text>
              {WRITE_DEF[k as string]}
            </Text>
          ))}
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
            <View style={s.block}>
              <Text style={s.defTitle}>What each speaking criterion means</Text>
              {SPEAK_CRIT.map(([k, label]) => (
                <Text key={k as string} style={s.defLine}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>{label}: </Text>
                  {SPEAK_DEF[k as string]}
                </Text>
              ))}
              {typeof sp.pronunciation === "number" && (
                <Text style={s.defLine}>
                  <Text style={{ fontFamily: "Helvetica-Bold" }}>Pronunciation: </Text>
                  {PRON_DEF}
                </Text>
              )}
            </View>
          </>
        )}

        {/* Integrity signal (advisory) - mirrors the on-screen post-test signal
            (CAL-FLU-601). Review telemetry only; never affects the level. */}
        {data.integrity && (
          <>
            <Text style={s.sectionTitle}>Integrity signal (advisory)</Text>
            <View style={[s.block, integrityTone(data.integrity.tier)]}>
              <Text style={{ fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.primary }}>
                {INTEGRITY_TIER_LABEL[data.integrity.tier]} · {data.integrity.score}/100
              </Text>
              <View style={{ marginTop: 3 }}>
                {data.integrity.reasons.map((reason, i) => (
                  <Text key={i} style={s.defLine}>{"• "}{reason}</Text>
                ))}
              </View>
              <Text style={{ fontSize: 8, color: C.light, lineHeight: 1.4, marginTop: 4, fontStyle: "italic" }}>
                Advisory only - this is review telemetry from the test administration. It never affects the CEFR level, caps a score, or auto-fails the test.
              </Text>
            </View>
          </>
        )}

        {/* Camera-proctoring attestation: when the sitting was camera-proctored,
            acknowledge it and link to the separate Proctoring & Integrity Report
            (kept distinct as it carries face snapshots). Staff-only report. */}
        {data.proctoring && (
          <>
            <Text style={s.sectionTitle}>Camera proctoring</Text>
            <View style={s.block}>
              <Text style={s.narrative}>
                This session was camera-proctored with the candidate&apos;s consent. A separate Proctoring &amp;
                Integrity Report - timestamped snapshots and an AI integrity review - is available to authorised VIFM
                staff.
              </Text>
              {data.proctoring.reportUrl ? (
                <Link src={data.proctoring.reportUrl} style={{ fontSize: 8.5, color: C.accent, marginTop: 5 }}>
                  Open the Proctoring &amp; Integrity Report
                </Link>
              ) : null}
            </View>
          </>
        )}

        {/* Recommended development programmes (FLU course recs) - VIFM catalogue
            + pluggable partner (e.g. SE Training Academy) English courses.
            Omitted entirely when neither source returns a match. */}
        {hasRecs && recs && (
          <>
            <Text style={s.sectionTitle}>Recommended development programmes</Text>
            <View style={s.block}>
              <Text style={s.narrative}>
                Programmes to strengthen the English measured here
                {recs.weakest ? `, with a focus on ${SKILL_LABEL[recs.weakest.skill] ?? recs.weakest.skill}` : ""}.
              </Text>
              {recs.vifm.length > 0 && (
                <>
                  <Text style={s.recProvider}>From VIFM</Text>
                  {recs.vifm.map((c, i) => (
                    <RecRow key={`v${i}`} c={c} />
                  ))}
                </>
              )}
              {recs.partner.length > 0 && (
                <>
                  <Text style={s.recProvider}>From {recs.partner[0].provider_label}</Text>
                  {recs.partner.map((c, i) => (
                    <RecRow key={`p${i}`} c={c} />
                  ))}
                </>
              )}
              <Text style={{ fontSize: 7.5, color: C.light, marginTop: 6, fontStyle: "italic" }}>
                Suggested next steps to develop English and workplace communication. Not part of the assessment score.
              </Text>
            </View>
          </>
        )}

        {/* Scale + indicative-placement note */}
        <Text style={s.sectionTitle}>Scale</Text>
        <View style={s.block}>
          <Text style={s.defLine}>Each criterion is rated 1-5. Skill bands map to CEFR (A1 to C2). This is an indicative placement to inform a human decision, not a certified high-stakes score.</Text>
        </View>

        <Text style={s.foot} fixed>
          Virginia Institute of Finance and Management - Confidential. Indicative English placement; AI-assisted scoring, human-reviewed.
        </Text>
      </Page>
    </Document>
  );
}
