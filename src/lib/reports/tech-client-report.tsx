import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { ClientReportPayload, LevelMetrics, Insight } from "@/lib/reports/tech-aggregation/types";

/**
 * Technical CLIENT report PDF (Company -> Project aggregation). English /
 * React-PDF (Helvetica), mirroring the on-screen /admin/tech-sandbox/client-report
 * page and the per-session tech-sandbox-report styling. Fed by buildClientReport.
 */

const C = {
  primary: "#010131",
  accent: "#5391D5",
  text: "#121232",
  light: "#5b6577",
  border: "#dbe3ec",
  bgSoft: "#fafbfc",
  emerald: "#047857",
  sky: "#0284c7",
  amber: "#b45309",
  rose: "#be123c",
};

/** Band colour for an average %: emerald>=85 / sky>=70 / amber>=60 / rose<60. */
function pctColor(pct: number | null): string {
  if (pct == null) return C.light;
  if (pct >= 85) return C.emerald;
  if (pct >= 70) return C.sky;
  if (pct >= 60) return C.amber;
  return C.rose;
}

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 40, fontFamily: "Helvetica", fontSize: 9.5, color: C.text },
  banner: { backgroundColor: C.primary, borderRadius: 6, paddingVertical: 16, paddingHorizontal: 18, marginBottom: 14 },
  eyebrow: { fontSize: 7.5, color: C.accent, letterSpacing: 2, textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  title: { fontSize: 20, color: "#ffffff", fontFamily: "Helvetica-Bold", marginTop: 4 },
  subtitle: { fontSize: 9, color: "#ffffff", opacity: 0.8, marginTop: 3 },

  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 6, marginTop: 4 },
  projectTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.primary, marginBottom: 4 },
  projectSub: { fontSize: 8, color: C.light, marginBottom: 6 },

  funnelRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  stat: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 5, padding: 8 },
  statValue: { fontSize: 15, fontFamily: "Helvetica-Bold", color: C.primary },
  statLabel: { fontSize: 7, color: C.light, textTransform: "uppercase", letterSpacing: 0.4, marginTop: 2 },

  table: { borderWidth: 1, borderColor: C.border, borderRadius: 5, marginBottom: 10 },
  th: { flexDirection: "row", backgroundColor: C.bgSoft, borderBottomWidth: 1, borderBottomColor: C.border, paddingVertical: 4, paddingHorizontal: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.border, paddingVertical: 3.5, paddingHorizontal: 6 },
  thText: { fontSize: 7, color: C.light, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  cell: { fontSize: 8.5 },
  cDomain: { flex: 3 },
  cNum: { flex: 1, textAlign: "right" },

  insightCols: { flexDirection: "row", gap: 8, marginBottom: 12 },
  insightCol: { flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 5, padding: 8 },
  insightHead: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
  insightItem: { marginBottom: 5 },
  insightTitle: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.text },
  insightDetail: { fontSize: 8, color: C.light, marginTop: 1, lineHeight: 1.35 },
  courseChip: { fontSize: 7, color: C.accent, marginTop: 1 },

  footer: { position: "absolute", bottom: 22, left: 40, right: 40, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 5, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 7, color: C.light },
});

function Funnel({ m }: { m: LevelMetrics }) {
  const p = m.participation;
  return (
    <View style={s.funnelRow}>
      <View style={s.stat}><Text style={s.statValue}>{p.invited}</Text><Text style={s.statLabel}>Invited</Text></View>
      <View style={s.stat}><Text style={s.statValue}>{p.started}</Text><Text style={s.statLabel}>Started</Text></View>
      <View style={s.stat}><Text style={s.statValue}>{p.completed}</Text><Text style={s.statLabel}>Completed</Text></View>
      <View style={s.stat}><Text style={s.statValue}>{Math.round(p.completionRate * 100)}%</Text><Text style={s.statLabel}>Completion</Text></View>
    </View>
  );
}

function ProfilesTable({ m }: { m: LevelMetrics }) {
  if (m.skill_profiles.length === 0) {
    return <Text style={{ fontSize: 8.5, color: C.light, marginBottom: 10 }}>No completed, scored results yet.</Text>;
  }
  return (
    <View style={s.table}>
      <View style={s.th} fixed>
        <Text style={[s.thText, s.cDomain]}>Domain</Text>
        <Text style={[s.thText, s.cNum]}>Avg</Text>
        <Text style={[s.thText, s.cNum]}>High</Text>
        <Text style={[s.thText, s.cNum]}>Low</Text>
        <Text style={[s.thText, s.cNum]}>n</Text>
        <Text style={[s.thText, s.cNum]}>Gap</Text>
      </View>
      {m.skill_profiles.map((d) => {
        const gap = m.skill_gaps.find((g) => g.domainKey === d.domainKey);
        return (
          <View key={d.domainKey} style={s.tr} wrap={false}>
            <Text style={[s.cell, s.cDomain]}>{d.domainLabel}</Text>
            <Text style={[s.cell, s.cNum, { color: pctColor(d.averagePct), fontFamily: "Helvetica-Bold" }]}>{d.averagePct}%</Text>
            <Text style={[s.cell, s.cNum, { color: C.light }]}>{d.highestPct}%</Text>
            <Text style={[s.cell, s.cNum, { color: C.light }]}>{d.lowestPct}%</Text>
            <Text style={[s.cell, s.cNum, { color: C.light }]}>{d.n}</Text>
            <Text style={[s.cell, s.cNum, { color: gap ? C.rose : C.light }]}>{gap ? `-${gap.gapPct}` : "-"}</Text>
          </View>
        );
      })}
    </View>
  );
}

function InsightColumns({ insights }: { insights: Insight[] }) {
  const groups: Array<{ kind: Insight["kind"]; label: string; color: string }> = [
    { kind: "strength", label: "Key strengths", color: C.emerald },
    { kind: "vulnerability", label: "Critical vulnerabilities", color: C.rose },
    { kind: "recommendation", label: "Training recommendations", color: C.accent },
  ];
  const present = groups.filter((g) => insights.some((i) => i.kind === g.kind));
  if (present.length === 0) return null;
  return (
    <View style={s.insightCols} wrap={false}>
      {present.map((g) => (
        <View key={g.kind} style={s.insightCol}>
          <Text style={[s.insightHead, { color: g.color }]}>{g.label}</Text>
          {insights.filter((i) => i.kind === g.kind).map((i, idx) => (
            <View key={idx} style={s.insightItem}>
              <Text style={s.insightTitle}>{i.title}</Text>
              <Text style={s.insightDetail}>{i.detail}</Text>
              {i.courseCodes && i.courseCodes.length > 0 && (
                <Text style={s.courseChip}>Programmes: {i.courseCodes.join(", ")}</Text>
              )}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

export function TechClientReportPdf({ data }: { data: ClientReportPayload }) {
  const generated = data.generated_at ? new Date(data.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  return (
    <Document title={`Technical client report - ${data.company_label}`}>
      <Page size="A4" style={s.page}>
        <View style={s.banner}>
          <Text style={s.eyebrow}>VIFM · Technical client report</Text>
          <Text style={s.title}>{data.company_label}</Text>
          <Text style={s.subtitle}>
            {data.projects.length} project{data.projects.length === 1 ? "" : "s"}
            {data.portals.length ? ` · portals: ${data.portals.join(", ")}` : ""}
            {generated ? ` · ${generated}` : ""}
          </Text>
        </View>

        <Text style={s.sectionTitle}>Company overall</Text>
        <Funnel m={data.company_metrics} />
        <ProfilesTable m={data.company_metrics} />
        <InsightColumns insights={data.company_overall_insights} />

        <Text style={s.sectionTitle}>Projects</Text>
        {data.projects.map((p) => (
          <View key={p.project_id} style={{ marginBottom: 12 }} wrap={false}>
            <Text style={s.projectTitle}>{p.project_label}</Text>
            <Text style={s.projectSub}>
              {p.project_metrics.participation.completed} of {p.project_metrics.participation.invited} completed
            </Text>
            <Funnel m={p.project_metrics} />
            <ProfilesTable m={p.project_metrics} />
            <InsightColumns insights={p.project_insights} />
          </View>
        ))}

        <Text style={{ fontSize: 7.5, color: C.light, marginTop: 6 }}>
          Bands: Advanced (&ge;85%) · Proficient (&ge;70%) · Developing (&ge;60%) · Foundational (&lt;60%). Gaps are
          domains below the {data.company_metrics.skill_gaps[0]?.baselinePct ?? 70}% baseline. Indicative -
          a development signal, not a hiring decision.
        </Text>

        <View style={s.footer} fixed>
          <Text style={s.footerText}>Virginia Institute of Finance and Management - Confidential</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
