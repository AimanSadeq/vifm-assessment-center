import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { formatFitScore } from "@/lib/recommender/format";
import {
  ARA_INDIVIDUAL_FACTORS,
  getIndividualMaturityStage,
  type AraIndividualFactorId,
  type AraIndividualMaturityStageId,
} from "@/lib/constants/ara-individual-factors";
import { VIFM_VERTICAL_LABELS, type VifmVertical } from "@/types/database";

/**
 * Personal AI Readiness Snapshot - multi-page mini-report.
 *
 * Page 1 - score & per-factor stand
 *   Hero:  overall score, stage pill, stage narrative
 *   Legend: how to read the 1-5 scale + tone bands
 *   Cards: four factors with score, tone, description, and stage-
 *          keyed "where to focus next" guidance
 *
 * Page 2 - context, training, methodology
 *   Cohort: how the four factors map to VIFM AC competencies
 *   Stage:  three personalised next-step prompts keyed to the
 *           overall maturity stage
 *   Courses: VIFM programmes ranked by fit, or a useful empty
 *           state when none are returned
 *   Methodology: short paragraph + pointer to the brief
 *
 * Pure React-PDF (same engine as the AC Learning Plan). English-only
 * for now - Arabic rendering needs a Puppeteer port (React-PDF does
 * not shape Arabic glyphs). The org-side ARA report PDFs already use
 * Puppeteer for that reason; we'll bring the personal PDF onto the
 * same pipeline when bilingual is prioritised.
 */

const C = {
  primary: "#010131",
  accent: "#5391D5",
  text: "#121232",
  textLight: "#6b7280",
  textMuted: "#9ca3af",
  bg: "#ffffff",
  bgSoft: "#fafbfc",
  border: "#e5e7eb",
  positive: "#059669",
  warning: "#D97706",
  negative: "#E11D48",
  gold: "#FBBF24",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: C.text,
  },
  // Hero
  hero: {
    backgroundColor: C.primary,
    color: "#fff",
    padding: 24,
    borderRadius: 6,
    marginBottom: 18,
  },
  heroEyebrow: {
    fontSize: 8,
    color: "#fff",
    opacity: 0.7,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroTitle: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#fff", marginBottom: 4 },
  heroIdentity: { fontSize: 11, color: "#fff", opacity: 0.85 },
  heroScoreRow: { flexDirection: "row", alignItems: "flex-end", gap: 12, marginTop: 14 },
  heroScoreNum: { fontSize: 38, fontFamily: "Helvetica-Bold", color: "#fff" },
  heroScoreOf: { fontSize: 11, color: "#fff", opacity: 0.6, marginBottom: 5 },
  heroVerdict: { fontSize: 9.5, color: "#fff", opacity: 0.85, lineHeight: 1.5, marginTop: 12, maxWidth: 380 },
  heroStagePill: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 8,
    alignSelf: "flex-start",
  },

  // Sections
  sectionEyebrow: { fontSize: 8, color: C.accent, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4, fontFamily: "Helvetica-Bold" },
  sectionTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 6 },
  sectionRule: { width: 24, height: 1.5, backgroundColor: C.accent, marginBottom: 10 },

  // Scale legend
  legendBox: {
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 4,
    padding: 10,
    marginBottom: 16,
    backgroundColor: C.bgSoft,
  },
  legendTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 4 },
  legendRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  legendCell: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  legendPill: { fontSize: 7, fontFamily: "Helvetica-Bold", paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 6 },
  legendText: { fontSize: 8, color: C.textLight, flex: 1, lineHeight: 1.4 },

  // Factor grid
  factorRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  factorCard: {
    width: "48%",
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  factorTopRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  factorDot: { width: 6, height: 6, borderRadius: 3 },
  factorDomain: { fontSize: 7, color: C.textLight, letterSpacing: 1.2, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  factorTonePill: { fontSize: 7, fontFamily: "Helvetica-Bold", paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 6, marginLeft: "auto" },
  factorName: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: C.primary },
  factorScoreRow: { flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 4 },
  factorScoreNum: { fontSize: 18, fontFamily: "Helvetica-Bold", color: C.primary },
  factorScoreOf: { fontSize: 8, color: C.textLight },
  factorDesc: { fontSize: 8, color: C.textLight, lineHeight: 1.45, marginTop: 5 },
  factorGuidanceLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: C.accent,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 6,
  },
  factorGuidance: { fontSize: 8, color: C.text, lineHeight: 1.45, marginTop: 2 },
  factorCompetencies: { fontSize: 7, color: C.textMuted, marginTop: 5, fontStyle: "italic" },

  // Two-column key panels
  twoCol: { flexDirection: "row", gap: 10, marginBottom: 14 },
  keyPanel: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 4,
    padding: 10,
    backgroundColor: C.bgSoft,
  },
  keyPanelTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 4 },
  keyPanelBullet: { fontSize: 8.5, color: C.text, lineHeight: 1.45, marginTop: 3, paddingLeft: 9 },

  // Course cards
  courseCard: {
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 4,
    padding: 9,
    backgroundColor: C.bgSoft,
  },
  courseHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  courseTitle: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: C.primary, flex: 1 },
  courseFitPill: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "#fef3c7",
    color: "#92400e",
    letterSpacing: 0.3,
  },
  courseMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4, marginBottom: 4 },
  courseMetaPill: {
    fontSize: 7,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: C.border,
    backgroundColor: C.bg,
    color: C.text,
  },
  driverChip: {
    fontSize: 7,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    color: "#1e40af",
    marginRight: 3,
    marginBottom: 3,
  },
  fitExplainerBox: {
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 4,
    padding: 9,
    marginBottom: 8,
    backgroundColor: C.bgSoft,
  },
  fitExplainerText: { fontSize: 8, color: C.text, lineHeight: 1.5 },
  fitExplainerMono: { fontFamily: "Courier", fontSize: 8 },
  emptyCourses: {
    borderWidth: 0.5,
    borderColor: C.border,
    borderRadius: 4,
    padding: 12,
    backgroundColor: C.bgSoft,
    marginBottom: 14,
  },
  emptyCoursesTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 3 },
  emptyCoursesBody: { fontSize: 9, color: C.textLight, lineHeight: 1.5 },

  // Methodology
  methodBox: {
    borderTopWidth: 0.5,
    borderTopColor: C.border,
    paddingTop: 10,
    marginTop: 6,
  },
  methodTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 3 },
  methodBody: { fontSize: 8, color: C.textLight, lineHeight: 1.5 },
  methodLink: { fontSize: 8, color: C.accent, marginTop: 4 },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: C.border,
  },
  footerText: { fontSize: 8, color: C.textMuted },
});

export type PersonalSnapshotData = {
  respondentName: string;
  respondentEmail: string;
  language: "en" | "ar";
  generatedAt: string;
  overallScore: number;
  factorScores: Record<AraIndividualFactorId, number>;
  recommendedCourses: Array<{
    course_id: string;
    title_en: string;
    title_ar: string | null;
    code: string | null;
    vertical: VifmVertical;
    level: string;
    duration_label: string;
    total_score: number;
    drivers: Array<{ label: string; gap: number; relevance: 1 | 2 | 3 }>;
  }>;
};

function toneFor(score: number): { label: string; bg: string; fg: string; stageId: AraIndividualMaturityStageId } {
  if (score >= 4) return { label: "Strong", bg: "#dcfce7", fg: "#166534", stageId: "embedded" };
  if (score >= 3) return { label: "Developing", bg: "#fef3c7", fg: "#92400e", stageId: "practising" };
  return { label: "Opportunity", bg: "#fee2e2", fg: "#991b1b", stageId: "emerging" };
}

/**
 * Stage-keyed coaching guidance, factor by factor. Three short blurbs
 * per factor (one per maturity tier) tell the respondent what to do
 * next given where they actually sit on that factor. Generic factor
 * descriptions can't do that - they describe the construct without
 * adapting to the score.
 */
const FACTOR_GUIDANCE: Record<
  AraIndividualFactorId,
  Record<AraIndividualMaturityStageId, string>
> = {
  thinking_sense_check: {
    emerging:
      "Treat every AI output as a draft. Build a personal checklist of 'always verify' items - numbers, names, citations - and run it before anything leaves your hands.",
    practising:
      "You're checking AI work, but probably only when it feels off. Define explicit triggers (high-stakes claims, unfamiliar domains) that automatically push you to verify, so the habit doesn't depend on suspicion.",
    embedded:
      "You spot hallucinations naturally. Share your verification techniques with the team and codify them into a sense-check protocol others can follow when you're not in the room.",
  },
  results_working_practice: {
    emerging:
      "Pick one recurring task and integrate AI into it for two weeks. Track the time saved - that data builds confidence faster than experimenting at random across everything you do.",
    practising:
      "You're using AI on real work. Invest now in prompt templates and reusable workflows so your productivity compounds across runs instead of starting from scratch each time.",
    embedded:
      "AI is part of how you work. Document your strongest workflow patterns so colleagues can adopt them without re-inventing the wheel - multiplying your impact past your own keyboard.",
  },
  people_collaboration: {
    emerging:
      "Start as a translator: when AI helps you on a task, briefly tell a colleague what it did well and where you stepped in. That opens the conversation without putting anyone on the spot.",
    practising:
      "You're sharing AI usefully. Go further - invite teammates to bring their AI questions to you, and set a recurring 15-minute slot for the team to compare prompts and patterns.",
    embedded:
      "You're a multiplier on AI adoption. Watch for over-reliance signals (colleagues taking outputs at face value) and surface them constructively before they show up in a deliverable.",
  },
  self_adaptive_mindset: {
    emerging:
      "Block 30 minutes a week to learn about one new AI capability - not to use it, just to know it exists. Curiosity is the leading indicator of every other factor improving.",
    practising:
      "You stay curious. Stress-test your role now: pick a task you do well and ask 'what would AI need to do this better?' - that surfaces where to lean in versus where to deepen your own expertise.",
    embedded:
      "You adapt fluidly. Use that capacity to mentor someone earlier in their AI journey - teaching cements your own adaptability and surfaces your blind spots.",
  },
};

/**
 * Overall-stage 'what to do next' bullets - three concrete moves keyed
 * to the respondent's overall maturity, shown on page 2.
 */
const STAGE_NEXT_STEPS: Record<AraIndividualMaturityStageId, { title: string; bullets: string[] }> = {
  emerging: {
    title: "Where to focus next",
    bullets: [
      "Pick the one factor with your lowest score and apply the per-factor guidance from page 1 for the next two weeks. Don't try to lift all four at once.",
      "Schedule a single 30-minute weekly slot specifically for AI practice. Without a calendar block, the habit won't form.",
      "Find one person on your team who's further along on AI - a peer, not a manager - and ask them to share one prompt they trust. Borrowing beats starting cold.",
    ],
  },
  practising: {
    title: "Where to focus next",
    bullets: [
      "You're past the experiment phase. Convert your three most-repeated AI interactions into named, saved prompts so you stop reinventing them.",
      "Pair your strongest factor with your weakest: use the muscle you've already built to expand into the area you're avoiding. AI Working Practice often pulls AI Sense-Check up with it, for example.",
      "Surface one concrete AI-assisted outcome to your manager or team this month - speed gain, quality lift, mistake caught. Visibility unlocks investment.",
    ],
  },
  embedded: {
    title: "Where to focus next",
    bullets: [
      "Your individual fluency is solid. The next ceiling is influence: pick one team norm (verification, prompt sharing, escalation rules) and propose it.",
      "Audit one of your AI workflows for fairness, confidentiality, and policy fit. Embedded users get blindsided by governance, not by tools.",
      "Mentor someone in the Emerging tier - the act of teaching one person will surface gaps in your own model and harden your judgment.",
    ],
  },
};

const HOW_TO_USE_PANELS = {
  read: {
    title: "How to read these scores",
    bullets: [
      "1.0 - 2.9 - Opportunity. Foundation-building zone; deliberate practice will move the needle quickly.",
      "3.0 - 3.9 - Developing. The habit exists; the next gain is making it reliable rather than situational.",
      "4.0 - 5.0 - Strong. You operate fluently; the lift now is sharing the practice and stress-testing it.",
    ],
  },
  about: {
    title: "What this measures",
    bullets: [
      "Four behavioural factors that predict whether AI tools turn into real outcomes for you, not just experiments.",
      "Each factor maps to VIFM Assessment Centre competencies you may already be working on - so AI growth compounds with the rest of your development.",
      "This snapshot is self-report only. A consultant-led deep-dive doubles the items and adds peer benchmarking.",
    ],
  },
};

export function PersonalSnapshot({ data }: { data: PersonalSnapshotData }) {
  const stage = getIndividualMaturityStage(data.overallScore);
  const stageNext = STAGE_NEXT_STEPS[stage.id];
  return (
    <Document
      title={`Personal AI Readiness Snapshot - ${data.respondentName}`}
      author="VIFM Assessment Center"
      subject="Personal AI Readiness Snapshot"
    >
      {/* ─── Page 1 - Score & per-factor stand ───────────────── */}
      <Page size="A4" style={s.page} wrap>
        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroEyebrow}>VIFM AI Readiness Compass · Personal</Text>
          <Text style={s.heroTitle}>Personal AI Readiness Snapshot</Text>
          <Text style={s.heroIdentity}>
            {data.respondentName} · {data.respondentEmail}
          </Text>
          <View style={s.heroScoreRow}>
            <Text style={s.heroScoreNum}>{data.overallScore.toFixed(1)}</Text>
            <Text style={s.heroScoreOf}>/ 5 overall</Text>
          </View>
          {data.overallScore > 0 && (
            <Text style={s.heroStagePill}>{stage.name_en}</Text>
          )}
          <Text style={s.heroVerdict}>
            {data.overallScore > 0 ? stage.blurb_en : "No data yet."}
          </Text>
        </View>

        {/* Scale legend */}
        <View style={s.legendBox}>
          <Text style={s.legendTitle}>{HOW_TO_USE_PANELS.read.title}</Text>
          <View style={s.legendRow}>
            <View style={s.legendCell}>
              <Text style={[s.legendPill, { backgroundColor: "#fee2e2", color: "#991b1b" }]}>
                OPPORTUNITY
              </Text>
              <Text style={s.legendText}>1.0 - 2.9</Text>
            </View>
            <View style={s.legendCell}>
              <Text style={[s.legendPill, { backgroundColor: "#fef3c7", color: "#92400e" }]}>
                DEVELOPING
              </Text>
              <Text style={s.legendText}>3.0 - 3.9</Text>
            </View>
            <View style={s.legendCell}>
              <Text style={[s.legendPill, { backgroundColor: "#dcfce7", color: "#166534" }]}>
                STRONG
              </Text>
              <Text style={s.legendText}>4.0 - 5.0</Text>
            </View>
          </View>
        </View>

        {/* Factors */}
        <Text style={s.sectionEyebrow}>Per-factor breakdown</Text>
        <Text style={s.sectionTitle}>Where you stand on each VIFM factor</Text>
        <View style={s.sectionRule} />
        <View style={s.factorRow}>
          {ARA_INDIVIDUAL_FACTORS.map((f) => {
            const score = data.factorScores[f.id] ?? 0;
            const tone = toneFor(score);
            const guidance = score > 0 ? FACTOR_GUIDANCE[f.id][tone.stageId] : null;
            return (
              <View key={f.id} style={s.factorCard} wrap={false}>
                <View style={s.factorTopRow}>
                  <View style={[s.factorDot, { backgroundColor: f.color }]} />
                  <Text style={s.factorDomain}>{f.domain}</Text>
                  {score > 0 && (
                    <Text style={[s.factorTonePill, { backgroundColor: tone.bg, color: tone.fg }]}>
                      {tone.label.toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={s.factorName}>{f.name_en}</Text>
                <View style={s.factorScoreRow}>
                  <Text style={s.factorScoreNum}>
                    {score > 0 ? score.toFixed(1) : "-"}
                  </Text>
                  <Text style={s.factorScoreOf}>/ 5</Text>
                </View>
                <Text style={s.factorDesc}>{f.description_en}</Text>
                {guidance && (
                  <>
                    <Text style={s.factorGuidanceLabel}>Where to focus next</Text>
                    <Text style={s.factorGuidance}>{guidance}</Text>
                  </>
                )}
                <Text style={s.factorCompetencies}>
                  Maps to VIFM AC: {f.ac_competency_names.join(" · ")}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>VIFM AI Readiness Compass · Personal Snapshot</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ─── Page 2 - Context, training, methodology ─────────── */}
      <Page size="A4" style={s.page} wrap>
        {/* Context panels */}
        <Text style={s.sectionEyebrow}>How to use this snapshot</Text>
        <Text style={s.sectionTitle}>Reading your result in context</Text>
        <View style={s.sectionRule} />
        <View style={s.twoCol}>
          <View style={s.keyPanel}>
            <Text style={s.keyPanelTitle}>{HOW_TO_USE_PANELS.about.title}</Text>
            {HOW_TO_USE_PANELS.about.bullets.map((b, i) => (
              <Text key={i} style={s.keyPanelBullet}>• {b}</Text>
            ))}
          </View>
          <View style={s.keyPanel}>
            <Text style={s.keyPanelTitle}>{stageNext.title} · {stage.name_en.toUpperCase()}</Text>
            {stageNext.bullets.map((b, i) => (
              <Text key={i} style={s.keyPanelBullet}>• {b}</Text>
            ))}
          </View>
        </View>

        {/* Courses */}
        <Text style={s.sectionEyebrow}>Targeted training</Text>
        <Text style={s.sectionTitle}>Develop with VIFM programmes</Text>
        <View style={s.sectionRule} />
        {data.recommendedCourses.length > 0 && (
          <View style={s.fitExplainerBox} wrap={false}>
            <Text style={s.fitExplainerText}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>How to read these.</Text>{" "}
              Each chip below is one match between a course and a factor where
              you scored below the target of 4 / 5. The notation{" "}
              <Text style={s.fitExplainerMono}>gap N x xR</Text>{" "}means your gap
              to target (N) multiplied by how strongly the course is tagged to
              that factor&apos;s competencies (relevance{" "}
              <Text style={s.fitExplainerMono}>x1</Text> light,{" "}
              <Text style={s.fitExplainerMono}>x2</Text> medium,{" "}
              <Text style={s.fitExplainerMono}>x3</Text> strong). The{" "}
              <Text style={{ fontFamily: "Helvetica-Bold" }}>fit score</Text>{" "}
              is the sum of those matches.{" "}
              <Text style={{ fontFamily: "Helvetica-Bold" }}>* High fit</Text>{" "}
              marks programmes at fit 4 or higher.
            </Text>
          </View>
        )}
        {data.recommendedCourses.length > 0 ? (
          data.recommendedCourses.slice(0, 5).map((c) => {
            const isHighFit = c.total_score >= 4;
            return (
              <View key={c.course_id} style={s.courseCard} wrap={false}>
                <View style={s.courseHead}>
                  <Text style={s.courseTitle}>
                    {c.title_en}
                    {c.code && (
                      <Text style={{ fontSize: 8, color: C.textLight, fontFamily: "Helvetica" }}>
                        {`  ${c.code}`}
                      </Text>
                    )}
                  </Text>
                  {isHighFit && <Text style={s.courseFitPill}>★ HIGH FIT · {formatFitScore(c.total_score)}</Text>}
                </View>
                <View style={s.courseMetaRow}>
                  <Text style={s.courseMetaPill}>
                    {VIFM_VERTICAL_LABELS[c.vertical] ?? c.vertical}
                  </Text>
                  <Text style={s.courseMetaPill}>
                    {c.level.charAt(0).toUpperCase() + c.level.slice(1)}
                  </Text>
                  <Text style={s.courseMetaPill}>{c.duration_label}</Text>
                  {!isHighFit && <Text style={s.courseMetaPill}>fit · {formatFitScore(c.total_score)}</Text>}
                </View>
                <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                  {c.drivers.map((d, i) => (
                    <Text key={i} style={s.driverChip}>
                      {d.label} · gap {formatFitScore(d.gap)} × ×{d.relevance}
                    </Text>
                  ))}
                </View>
              </View>
            );
          })
        ) : (
          <View style={s.emptyCourses}>
            <Text style={s.emptyCoursesTitle}>No targeted recommendations this run</Text>
            <Text style={s.emptyCoursesBody}>
              You&apos;re at or near target across all four factors, or the gaps that
              do exist sit outside the current VIFM training catalogue. Browse
              the full programme list at caliber.viftraining.com to pick
              development areas that aren&apos;t tied to a measured gap, or come back
              to this snapshot after focused practice to see recommendations
              shift.
            </Text>
          </View>
        )}

        {/* Methodology */}
        <View style={s.methodBox}>
          <Text style={s.methodTitle}>How we built this assessment</Text>
          <Text style={s.methodBody}>
            Four-factor framework, 24 self-report items rated on a 1-5 Likert
            scale, scored as the unweighted mean per factor. Factors map to the
            VIFM AC behavioural competency model so personal AI readiness lines
            up with the development work you&apos;re already doing. This is a
            snapshot - a paid consultant-led deep-dive doubles the items and
            adds peer benchmarking and a structured conversation about
            findings.
          </Text>
          <Text style={s.methodLink}>
            github.com/AimanSadeq/vifm-assessment-center/blob/master/docs/ARA-Methodology-Brief.md
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Generated {data.generatedAt}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
