import { Document, Page, Text, View, StyleSheet, Svg, Path, Circle, Line, Polygon } from "@react-pdf/renderer";
import { personaBand } from "@/lib/scoring/persona-bands";

// Persona - Behavioural Competency Self-Assessment profile PDF (English /
// React-PDF). Works for any behavioral session (anonymous /ac/persona or
// candidate-bound). Self-report only - not a readiness verdict.
//
// Two framings off one instrument (purpose):
//   HIRING - a role-benchmarked screening signal supporting a HUMAN decision:
//     areas-to-verify flag, fit panel, a structured interview guide, and a
//     decision-integration worksheet (computes nothing).
//   DEVELOPMENT - a growth plan: an opening synthesis, the alignment read, a
//     VIFM Academy course plan, a development-planning scaffold, and coaching
//     prompts. Markers are SVG only (no emoji / icon-font).

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
  rose: "#b91c1c",
};

const band = (v: number) => (v >= 4 ? C.emerald : v >= 3 ? C.sky : C.amber);

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
const pctSuffix = (p?: number | null) => (p != null ? ` · ${ordinal(p)} pct` : "");

export type PersonaPdfRow = {
  name: string;
  score: number;
  definition?: string;
  narrative?: string;
  tip?: string;
  /** A.3 role-critical marking. 'critical' = weight at/above role median; 'role' = a role competency. */
  roleMark?: "critical" | "role" | null;
  target?: number | null;
  /** B.4 overused-strength flag (development, score >= 4.5). */
  overused?: boolean;
  /** E percentile vs the norm group. */
  percentile?: number | null;
};
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
export type PersonaPdfInterviewGroup = { competencyId: string; name: string; probes: string[] };
export type PersonaPdfPlanRow = { competency: string; action: string };
export type PersonaPdfData = {
  takerName: string | null;
  generatedAt: string;
  overall: number;
  clusters: PersonaPdfCluster[];
  purpose?: "development" | "hiring";
  fit?: PersonaPdfFit | null;
  /** VIFM Academy training plan (development reports). */
  courses?: PersonaPdfCourse[];
  /** A.1 structured interview guide (hiring). */
  interviewProbes?: PersonaPdfInterviewGroup[];
  /** A.4 role-critical competencies sitting well below target (hiring). */
  watchAreas?: string[];
  /** B.1 holistic opening narrative (development). */
  summary?: string | null;
  /** B.2 development-planning scaffold (development). */
  planRows?: PersonaPdfPlanRow[];
  /** B.3 coaching + self-reflection prompts (development). */
  coaching?: { forConversation: string[]; forSelf: string[] } | null;
  /** C response-style indicator (advisory). */
  consistency?: { flag: "ok" | "review"; note: string } | null;
  /** E norm context. */
  overallPercentile?: number | null;
  normGroupLabel?: string | null;
  normProvisional?: boolean;
  normN?: number | null;
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
  overallPct: { fontSize: 9, color: C.textLight, marginTop: 2 },

  clusterTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4, marginTop: 10 },
  clusterName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.primary },
  clusterAvg: { fontSize: 10, fontFamily: "Helvetica-Bold" },

  row: { marginBottom: 7 },
  rowHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowNameWrap: { flexDirection: "row", alignItems: "center", flex: 1 },
  rowName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.text },
  rowScore: { fontSize: 9.5, color: C.textLight },
  rowDef: { fontSize: 8, color: C.textLight, marginTop: 1, lineHeight: 1.4 },
  rowNarr: { fontSize: 8, color: C.text, marginTop: 2, lineHeight: 1.4 },
  rowTip: { fontSize: 8, color: C.primary, marginTop: 2, lineHeight: 1.4 },
  rowOveruse: { fontSize: 8, color: C.emerald, marginTop: 2, lineHeight: 1.4 },
  barTrack: { height: 5, backgroundColor: "#eef0f3", borderRadius: 3, marginTop: 3 },
  barFill: { height: 5, borderRadius: 3 },

  // Section blocks
  sectionPanel: { borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 12, marginBottom: 14, backgroundColor: C.bgSoft },
  sectionTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 4 },
  sectionSub: { fontSize: 8, color: C.textLight, marginBottom: 6, lineHeight: 1.4 },
  para: { fontSize: 9.5, color: C.text, lineHeight: 1.5 },

  // Fit panel
  fitPanel: { borderWidth: 1, borderColor: C.border, borderRadius: 6, padding: 12, marginBottom: 14, backgroundColor: C.bgSoft },
  fitLabel: { fontSize: 8, color: C.textLight, textTransform: "uppercase", letterSpacing: 0.6 },
  fitValue: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 2 },
  // Big, centered "Role fit" headline (hiring).
  fitTitleBig: { fontSize: 17, fontFamily: "Helvetica-Bold", color: C.primary, textAlign: "center", textTransform: "uppercase", letterSpacing: 0.5 },
  fitRoleSub: { fontSize: 9, color: C.textLight, textAlign: "center", marginTop: 1 },
  fitValueBig: { fontSize: 22, fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 4 },
  fitGapTitle: { fontSize: 8.5, color: C.textLight, marginTop: 8, marginBottom: 3 },
  fitGapRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  fitGapName: { fontSize: 9 },
  fitGapNum: { fontSize: 9, color: C.rose },
  fitGapNumDev: { fontSize: 9, color: "#B45309" },
  fitCaveat: { fontSize: 8, color: C.amber, marginTop: 8, lineHeight: 1.4 },
  fitNote: { fontSize: 8, color: C.primary, marginTop: 8, lineHeight: 1.4 },
  normNote: { fontSize: 7.5, color: C.textLight, marginTop: 6, lineHeight: 1.4 },

  // Watch areas (hiring)
  watchBox: { borderWidth: 1, borderColor: "#fcd34d", backgroundColor: "#fffbeb", borderRadius: 5, padding: 8, marginBottom: 8 },
  watchTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  watchTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#92400e" },
  watchItem: { fontSize: 8.5, color: "#92400e", lineHeight: 1.4 },

  // Consistency
  consistOk: { fontSize: 8, color: C.textLight, marginTop: 8 },
  consistReview: { fontSize: 8, color: "#92400e", marginTop: 8, fontFamily: "Helvetica-Bold" },

  // Interview guide
  ivGroup: { marginBottom: 8 },
  ivHeadRow: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
  ivName: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.primary },
  ivProbe: { fontSize: 9, color: C.text, marginBottom: 2, lineHeight: 1.4 },
  ivEvidence: { fontSize: 8, color: C.textLight, marginTop: 2 },

  // Decision block
  decRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 5 },
  decLabel: { width: 130, fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary },
  decValue: { flex: 1, fontSize: 9, color: C.text },
  decBlank: { flex: 1, fontSize: 9, color: C.textLight },

  // VIFM Academy training plan
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

  // Planning scaffold
  planCard: { borderWidth: 1, borderColor: C.border, borderRadius: 5, padding: 8, marginBottom: 6, backgroundColor: "#ffffff" },
  planComp: { fontSize: 9.5, fontFamily: "Helvetica-Bold", color: C.primary },
  planAction: { fontSize: 8.5, color: C.text, marginTop: 2, lineHeight: 1.4 },
  planBlankRow: { flexDirection: "row", marginTop: 3 },
  planBlankLabel: { fontSize: 8, color: C.textLight, width: 120 },
  planBlankLine: { flex: 1, borderBottomWidth: 1, borderBottomColor: "#d1d5db", height: 10 },

  // Coaching
  coachCol: { marginBottom: 6 },
  coachHead: { fontSize: 9, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 3 },
  coachItemRow: { flexDirection: "row", marginBottom: 2, alignItems: "flex-start" },
  coachItem: { fontSize: 8.5, color: C.text, lineHeight: 1.4, flex: 1 },

  caption: { marginTop: 6, borderWidth: 1, borderColor: C.border, borderRadius: 5, backgroundColor: C.bgSoft, padding: 9, fontSize: 8.5, color: C.textLight, lineHeight: 1.4 },
  methodNote: { marginTop: 8, fontSize: 7.5, color: C.textLight, lineHeight: 1.4 },
  footer: { position: "absolute", bottom: 22, left: 44, right: 44, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7.5, color: C.textLight },
});

// ── SVG markers (no emoji / icon-font) ──
function RoleMark({ kind }: { kind: "critical" | "role" }) {
  return (
    <Svg width={8} height={8} viewBox="0 0 8 8" style={{ marginRight: 4 }}>
      <Polygon points="4,0 8,4 4,8 0,4" fill={kind === "critical" ? C.accent : "#ffffff"} stroke={C.accent} strokeWidth={1} />
    </Svg>
  );
}
function CautionMark() {
  return (
    <Svg width={10} height={10} viewBox="0 0 10 10" style={{ marginRight: 4 }}>
      <Polygon points="5,0.5 9.5,9.5 0.5,9.5" fill="none" stroke="#b45309" strokeWidth={1} />
      <Line x1="5" y1="3.5" x2="5" y2="6.5" stroke="#b45309" strokeWidth={1} />
      <Circle cx="5" cy="8.2" r="0.6" fill="#b45309" />
    </Svg>
  );
}
function Bullet({ color }: { color: string }) {
  return (
    <Svg width={5} height={5} viewBox="0 0 5 5" style={{ marginRight: 5, marginTop: 3 }}>
      <Circle cx="2.5" cy="2.5" r="2" fill={color} />
    </Svg>
  );
}
function CheckMark() {
  return (
    <Svg width={9} height={9} viewBox="0 0 10 10" style={{ marginRight: 4 }}>
      <Path d="M1.5 5 L4 7.5 L8.5 2.5" fill="none" stroke={C.emerald} strokeWidth={1.4} />
    </Svg>
  );
}

export function PersonaProfilePdf({ data }: { data: PersonaPdfData }) {
  const dev = data.purpose === "development";
  const hiring = data.purpose === "hiring";
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.banner}>
          <Text style={s.eyebrow}>Persona® - Behavioural Self-Assessment</Text>
          <Text style={s.title}>{data.takerName || "Self-profile"}</Text>
          <Text style={s.subtitle}>
            {hiring
              ? "Role-fit read across the VIFM competency framework (the same framework as the 360)"
              : "Development read across the VIFM competency framework (the same framework as the 360)"}
          </Text>
        </View>

        {/* B.1 - holistic opening narrative (development), right after the banner */}
        {dev && data.summary ? (
          <View style={s.sectionPanel} wrap={false}>
            <Text style={s.sectionTitle}>Profile at a glance</Text>
            <Text style={s.para}>{data.summary}</Text>
          </View>
        ) : null}

        {/* Role panel - hiring fit OR the development plan */}
        {data.fit && (
          <View style={s.fitPanel} wrap={false}>
            {/* A.4 - areas to verify (hiring), at the top of the fit panel */}
            {hiring && data.watchAreas && data.watchAreas.length > 0 ? (
              <View style={s.watchBox}>
                <View style={s.watchTitleRow}>
                  <CautionMark />
                  <Text style={s.watchTitle}>Areas to verify at interview</Text>
                </View>
                <Text style={s.watchItem}>
                  Role-critical competencies the candidate self-rates well below target. Verify with
                  evidence; this is a prompt to probe, not a reason to reject: {data.watchAreas.join(", ")}.
                </Text>
              </View>
            ) : null}

            {dev ? (
              <>
                <Text style={s.fitLabel}>Development plan · {data.fit.roleName}</Text>
                <Text style={[s.fitValue, { color: C.primary }]}>{data.fit.fitPct}% aligned to the role target</Text>
              </>
            ) : (
              <View style={{ alignItems: "center", marginBottom: 4 }}>
                <Text style={s.fitTitleBig}>Role fit</Text>
                <Text style={s.fitRoleSub}>{data.fit.roleName}</Text>
                <Text style={[s.fitValueBig, { color: data.fit.bandHex }]}>{data.fit.fitPct}%  ·  {data.fit.bandLabel}</Text>
              </View>
            )}
            {data.fit.strengths && data.fit.strengths.length > 0 ? (
              <>
                <Text style={[s.fitGapTitle, { color: C.emerald }]}>
                  {dev ? "Strengths to leverage (self / target)" : "Biggest strengths (self / target)"}
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
                  {dev ? "Development priorities (self / target)" : "Biggest gaps vs the role target (self / target)"}
                </Text>
                {data.fit.gaps.map((g) => (
                  <View key={g.name} style={s.fitGapRow}>
                    <Text style={s.fitGapName}>{g.name}</Text>
                    <Text style={dev ? s.fitGapNumDev : s.fitGapNum}>
                      {g.self.toFixed(1)} / {g.target.toFixed(1)}  (-{g.gap.toFixed(1)})
                    </Text>
                  </View>
                ))}
              </>
            ) : (
              <Text style={s.fitGapTitle}>Meets or exceeds every target competency.</Text>
            )}
            {dev ? (
              <Text style={s.fitNote}>
                A self-report development plan - pair it with a Reflect 360 (others&apos; view) and the recommended VIFM programmes below to turn priorities into progress.
              </Text>
            ) : (
              <Text style={s.fitCaveat}>
                A self-report screening signal - corroborate with a Reflect 360, interview and evidence before any hiring decision.
              </Text>
            )}

            {/* C - response-style indicator (prominent for hiring, soft for development) */}
            {data.consistency ? (
              <Text style={data.consistency.flag === "review" && hiring ? s.consistReview : s.consistOk}>
                Response style: {data.consistency.flag === "review" ? "review" : "consistent"} - {data.consistency.note}
              </Text>
            ) : null}

            {/* E - norm group context */}
            {data.normGroupLabel ? (
              <Text style={s.normNote}>
                Percentiles are relative to {data.normGroupLabel}
                {data.normProvisional ? ` (provisional${data.normN ? `, n=${data.normN}` : ""})` : data.normN ? `, n=${data.normN}` : ""},
                {" "}and are based on self-report.
              </Text>
            ) : null}
          </View>
        )}

        {/* A.2 - decision-integration worksheet (hiring, computes nothing) */}
        {hiring && data.fit ? (
          <View style={s.sectionPanel} wrap={false}>
            <Text style={s.sectionTitle}>Decision integration</Text>
            <Text style={s.sectionSub}>
              Combine the assessment signal with interview evidence into a documented recommendation.
              The panel completes this; Persona does not compute a decision.
            </Text>
            <View style={s.decRow}>
              <Text style={s.decLabel}>Assessment signal</Text>
              <Text style={s.decValue}>
                {data.fit.fitPct}% · {data.fit.bandLabel}
                {data.fit.gaps.length > 0
                  ? `. Watch: ${data.fit.gaps.slice(0, 2).map((g) => g.name).join(", ")}`
                  : ""}
              </Text>
            </View>
            <View style={s.decRow}>
              <Text style={s.decLabel}>Interview rating (1-5)</Text>
              <Text style={s.decBlank}>____________________________________________</Text>
            </View>
            <View style={s.decRow}>
              <Text style={s.decLabel}>Evidence / notes</Text>
              <Text style={s.decBlank}>____________________________________________</Text>
            </View>
            <View style={s.decRow}>
              <Text style={s.decLabel}>Overall recommendation</Text>
              <Text style={s.decValue}>Advance        /        Hold        /        Decline</Text>
            </View>
            <Text style={s.fitCaveat}>
              A self-report screening signal - corroborate with a Reflect 360, interview and evidence before any hiring decision.
            </Text>
          </View>
        ) : null}

        {/* B.3 - coaching + self-reflection prompts (development) */}
        {dev && data.coaching && (data.coaching.forConversation.length > 0 || data.coaching.forSelf.length > 0) ? (
          <View style={s.sectionPanel} wrap={false}>
            <Text style={s.sectionTitle}>Discussion prompts</Text>
            {data.coaching.forConversation.length > 0 ? (
              <View style={s.coachCol}>
                <Text style={s.coachHead}>For the development conversation</Text>
                {data.coaching.forConversation.map((q, i) => (
                  <View key={`cv-${i}`} style={s.coachItemRow}><Bullet color={C.accent} /><Text style={s.coachItem}>{q}</Text></View>
                ))}
              </View>
            ) : null}
            {data.coaching.forSelf.length > 0 ? (
              <View style={s.coachCol}>
                <Text style={s.coachHead}>Self-reflection questions</Text>
                {data.coaching.forSelf.map((q, i) => (
                  <View key={`sf-${i}`} style={s.coachItemRow}><Bullet color={C.persona} /><Text style={s.coachItem}>{q}</Text></View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={s.overallRow}>
          <View>
            <Text style={s.overallLabel}>Overall self-rating</Text>
            <Text style={[s.overallValue, { color: band(data.overall) }]}>{data.overall.toFixed(2)} / 5  ·  {personaBand(data.overall).label}</Text>
            {data.overallPercentile != null ? (
              <Text style={s.overallPct}>{ordinal(data.overallPercentile)} percentile vs {data.normGroupLabel ?? "the norm group"}</Text>
            ) : null}
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
                  <View style={s.rowNameWrap}>
                    {hiring && r.roleMark ? <RoleMark kind={r.roleMark} /> : null}
                    <Text style={s.rowName}>{r.name}</Text>
                  </View>
                  <Text style={s.rowScore}>
                    {r.score.toFixed(1)}
                    {hiring && r.target != null ? ` / ${r.target.toFixed(1)}` : ""}
                    {pctSuffix(r.percentile)} · {personaBand(r.score).label}
                  </Text>
                </View>
                {r.definition ? <Text style={s.rowDef}>{r.definition}</Text> : null}
                <View style={s.barTrack}>
                  <View style={[s.barFill, { width: `${(r.score / 5) * 100}%`, backgroundColor: C.accent }]} />
                </View>
                {r.narrative ? <Text style={s.rowNarr}>{r.narrative}</Text> : null}
                {r.tip ? <Text style={s.rowTip}>Suggestion: {r.tip}</Text> : null}
                {dev && r.overused ? (
                  <View style={{ flexDirection: "row", alignItems: "flex-start", marginTop: 2 }}>
                    <CheckMark />
                    <Text style={s.rowOveruse}>A real strength: keep it, and watch it does not crowd out the competencies below.</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ))}

        {/* B.2 - development-planning scaffold (development) - the take-away
            action plan, placed at the end after all the analysis. */}
        {dev && data.planRows && data.planRows.length > 0 ? (
          <View style={s.sectionPanel}>
            <Text style={s.sectionTitle}>Development action plan</Text>
            <Text style={s.sectionSub}>
              For each priority: a development goal, on-the-job application and a success measure,
              for the person to complete with their manager or coach.
            </Text>
            {data.planRows.map((p, i) => (
              <View key={`plan-${i}`} style={s.planCard} wrap={false}>
                <Text style={s.planComp}>{i + 1}. {p.competency}</Text>
                <Text style={s.planAction}>Action / stretch: {p.action}</Text>
                <View style={s.planBlankRow}><Text style={s.planBlankLabel}>Development goal</Text><View style={s.planBlankLine} /></View>
                <View style={s.planBlankRow}><Text style={s.planBlankLabel}>On-the-job application</Text><View style={s.planBlankLine} /></View>
                <View style={s.planBlankRow}><Text style={s.planBlankLabel}>Success measure</Text><View style={s.planBlankLine} /></View>
                <View style={s.planBlankRow}><Text style={s.planBlankLabel}>Review by</Text><View style={s.planBlankLine} /></View>
              </View>
            ))}
          </View>
        ) : null}

        {/* VIFM Academy training plan (development) - at the END of the report,
            the courses that close the gaps after the analysis + the plan. */}
        {dev && data.courses && data.courses.length > 0 && (
          <View style={s.academyPanel}>
            <Text style={s.academyTitle}>Recommended VIFM Academy programmes</Text>
            <Text style={s.academySub}>
              Mapped to the development priorities - ranked by gap size and how strongly each programme targets it.
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

        {/* A.1 - structured interview guide (hiring) - the take-into-the-room
            artifact, placed at the end after the competency analysis. */}
        {hiring && data.interviewProbes && data.interviewProbes.length > 0 ? (
          <View style={s.sectionPanel}>
            <Text style={s.sectionTitle}>Interview guide</Text>
            <Text style={s.sectionSub}>
              Behavioural (STAR) probes for the role-critical competencies, grounded in the candidate&apos;s
              lower-rated answers. A screening aid; record evidence and your own rating.
            </Text>
            {data.interviewProbes.map((grp) => (
              <View key={grp.competencyId} style={s.ivGroup} wrap={false}>
                <View style={s.ivHeadRow}>
                  <RoleMark kind="critical" />
                  <Text style={s.ivName}>{grp.name}</Text>
                </View>
                {grp.probes.map((p, i) => (
                  <Text key={`${grp.competencyId}-p-${i}`} style={s.ivProbe}>{i + 1}. {p}</Text>
                ))}
                <Text style={s.ivEvidence}>Evidence / rating (1-5): ______________________________</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={s.caption}>
          {hiring
            ? "This is an indicative self-report fit against the target role - a screening signal, not a hiring decision. Corroborate with a Reflect 360 (others), structured interview and work evidence."
            : "This is an indicative self-report - how the person sees themselves across the competencies. To turn it into a readiness verdict, pair Persona (self) with a Reflect 360 (others) against a target role."}
        </Text>
        <Text style={s.methodNote}>
          Methodology: Persona is a 1-5 behavioural self-report scored per competency (reverse items
          mapped), averaged by cluster, and compared against a target role and, where set, a norm group.
          It is a self-report signal, not an objective measure or a decision. See the Persona Methodology Brief for full detail.
        </Text>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Virginia Institute of Finance and Management - Confidential</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Generated ${data.generatedAt}  -  ${pageNumber}/${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
