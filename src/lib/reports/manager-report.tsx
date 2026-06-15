// Manager DEVELOPMENT report. The line manager's lens: where the person stands
// against the role today, then concrete development advice (a "where they stand"
// read + actionable tips) for each competency, ordered develop-first. This is a
// development guide, NOT a hiring decision - the selection call lives in the
// Talent Acquisition report.
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  C, sh, BARS, scoreColor, ScoreDots, CompetencyMatrix,
  developmentStatement, developmentTipsFor, CoverHero, SectionHeader, Footer,
  groupByDomain, DomainHeader, type AudienceReportProps,
} from "./_audience-shared";

const AUDIENCE = "Manager Development Report";
const TARGET = 3; // "Competent" - the role bar

// Development emphasis chip per band.
function emphasis(score: number): { label: string; bg: string; border: string; fg: string } {
  if (score >= 4) return { label: "Leverage", bg: C.positiveBg, border: C.positive, fg: C.positive };
  if (score === 3) return { label: "Sustain", bg: C.infoBg, border: C.accent, fg: C.info };
  return { label: "Develop", bg: C.warningBg, border: C.warning, fg: C.warning };
}

const m = StyleSheet.create({
  card: { marginBottom: 9, borderWidth: 0.5, borderColor: C.border, borderRadius: 4, borderLeftWidth: 3, padding: 11 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  name: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: C.primary, flex: 1, paddingRight: 8 },
  chip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, borderWidth: 0.5 },
  chipText: { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 0.4, textTransform: "uppercase" },
  barRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  scoreTag: { fontSize: 7.5, color: C.textLight, marginLeft: 8 },
  stmt: { fontSize: 8.5, lineHeight: 1.45, color: C.text, fontFamily: "Helvetica-Bold", marginBottom: 5 },
  tipsLbl: { fontSize: 6.5, color: C.textLight, letterSpacing: 1, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 3 },
  glossRow: { marginBottom: 6 },
  glossName: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: C.primary },
  glossDef: { fontSize: 8, lineHeight: 1.4, color: C.textLight },
});

export function ManagerReport({ data }: AudienceReportProps) {
  const comps = data.competencies;
  const oar = data.overallScore;
  const leverage = comps.filter((c) => (c.consensusScore ?? 0) >= 4);
  const onTarget = comps.filter((c) => (c.consensusScore ?? 0) === 3);
  const develop = comps.filter((c) => (c.consensusScore ?? 0) < TARGET);
  // Develop-first ordering for the advice section.
  const ranked = [...comps].sort((a, b) => (a.consensusScore ?? 0) - (b.consensusScore ?? 0));
  const groups = groupByDomain(comps);
  const firstName = data.candidateName.split(" ")[0];

  return (
    <Document title={`Manager Development Report - ${data.candidateName}`} author="VIFM Behavioural Assessment">
      {/* Cover */}
      <Page size="A4" style={sh.cover}>
        <CoverHero
          eyebrow="Behavioural Psychometric · For the Line Manager"
          title="Manager Development Report"
          subtitle={`Developing ${firstName} - where they stand and how to grow`}
          candidateName={data.candidateName}
          audience={AUDIENCE}
          rows={[
            ["Organisation", data.organizationName],
            ["Role", data.targetRole ?? "-"],
            ["Date completed", data.assessmentDates],
            ["Competencies measured", String(comps.length)],
            ["Prepared", data.generatedAt],
          ]}
        />
      </Page>

      {/* Development at a glance */}
      <Page size="A4" style={sh.page}>
        <SectionHeader eyebrow="At a glance" title="Where they stand, and what to develop" />

        <View wrap={false} style={[sh.panel, { borderLeftColor: C.accent }]}>
          <Text style={[sh.panelTitle, { color: C.accent }]}>How to use this development guide</Text>
          <Text style={{ fontSize: 8.5, lineHeight: 1.5, color: C.text }}>
            This report turns the assessment into a development plan. Everyone, at every score, can grow - use the
            advice on the next pages to focus effort where it pays off most. Start with the &quot;Develop&quot;
            competencies, agree one or two with {firstName}, and revisit progress over the coming quarter. Treat
            strengths as assets to extend and to share with the team, not areas to leave alone.
          </Text>
        </View>

        <View style={[sh.statStrip, { marginBottom: 12 }]}>
          <View style={sh.statTile}>
            <Text style={sh.statLabel}>Overall rating</Text>
            <Text style={sh.statValue}>{oar != null ? oar.toFixed(1) : "-"}</Text>
            <Text style={sh.statSuffix}>of 5</Text>
          </View>
          <View style={sh.statTile}>
            <Text style={sh.statLabel}>To leverage</Text>
            <Text style={sh.statValue}>{leverage.length}</Text>
            <Text style={sh.statSuffix}>strengths (4-5)</Text>
          </View>
          <View style={sh.statTile}>
            <Text style={sh.statLabel}>To sustain</Text>
            <Text style={sh.statValue}>{onTarget.length}</Text>
            <Text style={sh.statSuffix}>on target (3)</Text>
          </View>
          <View style={sh.statTile}>
            <Text style={sh.statLabel}>To develop</Text>
            <Text style={sh.statValue}>{develop.length}</Text>
            <Text style={sh.statSuffix}>below bar</Text>
          </View>
        </View>

        <Text style={sh.eyebrow}>Where they stand today (bar = Competent, 3/5)</Text>
        <View style={{ marginBottom: 10 }}>
          <CompetencyMatrix competencies={comps} target={TARGET} />
        </View>

        {develop.length > 0 && (
          <View wrap={false} style={[sh.panel, { borderLeftColor: C.warning, backgroundColor: C.warningBg }]}>
            <Text style={[sh.panelTitle, { color: C.warning }]}>Start the conversation here</Text>
            <Text style={{ fontSize: 8.5, lineHeight: 1.45, color: C.text }}>
              The clearest development priorities are {develop.map((c) => `${c.competencyName} (${c.consensusScore}/5)`).join(", ")}.
              Pick one or two to focus on first - the per-competency advice that follows gives concrete actions.
            </Text>
          </View>
        )}

        <Footer name={data.candidateName} audience={AUDIENCE} />
      </Page>

      {/* Development advice, develop-first */}
      <Page size="A4" style={sh.page}>
        <SectionHeader eyebrow="Development advice" title="Competency by competency" />
        {ranked.map((c) => {
          const score = c.consensusScore ?? 0;
          const col = scoreColor(score);
          const em = emphasis(score);
          const tips = developmentTipsFor(c).slice(0, 3);
          return (
            <View key={c.competencyName} wrap={false} style={[m.card, { borderLeftColor: col }]}>
              <View style={m.head}>
                <Text style={m.name}>{c.competencyName}</Text>
                <View style={[m.chip, { backgroundColor: em.bg, borderColor: em.border }]}>
                  <Text style={[m.chipText, { color: em.fg }]}>{em.label}</Text>
                </View>
              </View>
              <View style={m.barRow}>
                <ScoreDots score={score} />
                <Text style={m.scoreTag}>{score}/5 · {BARS[score]} · {c.domainName}</Text>
              </View>
              <Text style={m.stmt}>{developmentStatement(c)}</Text>
              <Text style={m.tipsLbl}>Development focus</Text>
              {tips.map((t, i) => (
                <View style={sh.liRow} key={i}>
                  <Text style={[sh.liGlyph, { color: em.fg }]}>{">"}</Text>
                  <Text style={sh.liText}>{t}</Text>
                </View>
              ))}
            </View>
          );
        })}
        <Footer name={data.candidateName} audience={AUDIENCE} />
      </Page>

      {/* Glossary + scale */}
      <Page size="A4" style={sh.page}>
        <SectionHeader eyebrow="Reference" title="What each competency means" />
        <Text style={[sh.body, { marginBottom: 8 }]}>
          Definitions for every competency assessed, grouped by behavioural domain, with the 1-5 rating scale used
          throughout this report.
        </Text>
        {groups.map((g, gi) => (
          <View key={g.name} wrap={false}>
            <DomainHeader name={g.name} marginTop={gi === 0 ? 2 : 8} />
            {g.items.map((c) => (
              <View key={c.competencyName} style={m.glossRow}>
                <Text style={m.glossName}>{c.competencyName}</Text>
                {c.explanation ? <Text style={m.glossDef}>{c.explanation}</Text> : null}
              </View>
            ))}
          </View>
        ))}

        <Text style={[sh.eyebrow, { marginTop: 6 }]}>The 1-5 rating scale</Text>
        <View style={[sh.note, { marginTop: 4 }]} wrap={false}>
          {[1, 2, 3, 4, 5].map((n) => (
            <View key={n} style={{ flexDirection: "row", marginBottom: 3 }}>
              <Text style={{ width: 16, fontSize: 8.5, fontFamily: "Helvetica-Bold", color: scoreColor(n) }}>{n}</Text>
              <Text style={{ fontSize: 8.5, color: C.textLight }}>{BARS[n]}</Text>
            </View>
          ))}
        </View>

        <View style={[sh.note, { marginTop: 8 }]} wrap={false}>
          <Text style={sh.noteText}>
            This is a development guide based on the VIFM online behavioural psychometric, scored against the VIFM
            competency framework. It supports coaching and growth conversations; it is not a performance rating or a
            hiring decision. Findings are most relevant for the next ~24 months.
          </Text>
        </View>

        <Footer name={data.candidateName} audience={AUDIENCE} />
      </Page>
    </Document>
  );
}
