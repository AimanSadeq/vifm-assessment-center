// Candidate-facing RESULTS report (talent-acquisition context). Shows the
// individual only the result of their assessment: which competencies were
// measured, how they scored, what each competency means, and a plain-language
// reading of their result. Deliberately NO development tips, NO recommendations,
// NO hiring verdict - role-fit and next steps are the hiring organisation's call
// (the development advice lives in the Manager report; the decision in the TA report).
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import {
  C, sh, BARS, scoreColor, DOMAIN_TONE, ScoreDots, DomainHeader, groupByDomain,
  resultNarrative, CoverHero, SectionHeader, Footer, type AudienceReportProps,
} from "./_audience-shared";

const AUDIENCE = "Assessment Results";

const r = StyleSheet.create({
  card: { marginBottom: 8, borderWidth: 0.5, borderColor: C.border, borderRadius: 4, borderLeftWidth: 3, padding: 10 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5 },
  name: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: C.primary, flex: 1, paddingRight: 8 },
  pill: { paddingHorizontal: 8, paddingVertical: 2.5, borderRadius: 9 },
  pillText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff", letterSpacing: 0.2 },
  meta: { fontSize: 6.5, color: C.textMuted, letterSpacing: 0.4, marginBottom: 6, textTransform: "uppercase" },
  lbl: { fontSize: 6.5, color: C.textLight, letterSpacing: 1, fontFamily: "Helvetica-Bold", textTransform: "uppercase", marginBottom: 2 },
  explain: { fontSize: 8.5, lineHeight: 1.45, color: C.text, marginBottom: 5 },
  narr: { fontSize: 8.5, lineHeight: 1.45, color: C.text },
  legendRow: { flexDirection: "row", marginBottom: 3 },
  legendNum: { width: 16, fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  legendText: { fontSize: 8.5, color: C.textLight },
});

export function CandidateResultsReport({ data }: AudienceReportProps) {
  const comps = data.competencies;
  const oar = data.overallScore;
  const groups = groupByDomain(comps);

  // Behavioural domains covered, in first-seen order, with a per-domain count.
  const domains = groups.map((g) => ({ name: g.name, n: g.items.length }));

  return (
    <Document title={`Assessment Results - ${data.candidateName}`} author="VIFM Behavioural Assessment">
      {/* Cover */}
      <Page size="A4" style={sh.cover}>
        <CoverHero
          eyebrow="VIFM Behavioural Assessment"
          title="Your Assessment Results"
          subtitle={data.targetRole ? `Assessed for ${data.targetRole}` : "Behavioural psychometric results"}
          candidateName={data.candidateName}
          audience={AUDIENCE}
          rows={[
            ["Organisation", data.organizationName],
            ["Role assessed for", data.targetRole ?? "-"],
            ["Date completed", data.assessmentDates],
            ["Competencies measured", String(comps.length)],
            ["Issued", data.generatedAt],
          ]}
        />
      </Page>

      {/* What was assessed + how to read it */}
      <Page size="A4" style={sh.page}>
        <SectionHeader eyebrow="About this report" title="What was measured, and how to read it" />

        <Text style={sh.body}>
          You completed the VIFM online behavioural psychometric assessment. It measures how you typically
          work against the VIFM competency framework and rates each competency on a 1-5 scale. Your responses
          are compared against a reference group of professionals who completed the same assessment.
        </Text>
        <Text style={sh.body}>
          This report describes your result on every competency that was measured, grouped by behavioural
          domain, with a short explanation of what each one assesses and a plain reading of your result. It
          reflects how you described your own way of working - it is a record of your results, not a hiring
          decision.
        </Text>

        <Text style={[sh.eyebrow, { marginTop: 6 }]}>What this assessment covers</Text>
        <Text style={[sh.body, { marginBottom: 6 }]}>
          Your competencies sit across the four VIFM behavioural domains. The assessment measured {comps.length} of
          them in total.
        </Text>
        <View style={[sh.chipRow, { marginBottom: 12 }]}>
          {domains.map((d) => {
            const tone = DOMAIN_TONE[d.name] ?? C.textLight;
            return (
              <View key={d.name} style={[sh.chip, { borderColor: tone, backgroundColor: C.bg }]}>
                <Text style={[sh.chipText, { color: tone }]}>{d.name} · {d.n}</Text>
              </View>
            );
          })}
        </View>

        <Text style={[sh.eyebrow, { marginTop: 2 }]}>The 1-5 rating scale</Text>
        <View style={[sh.note, { marginTop: 4 }]}>
          {[1, 2, 3, 4, 5].map((n) => (
            <View key={n} style={r.legendRow}>
              <Text style={[r.legendNum, { color: scoreColor(n) }]}>{n}</Text>
              <Text style={r.legendText}>{BARS[n]}</Text>
            </View>
          ))}
          <Text style={[r.legendText, { marginTop: 5 }]}>
            The bar for this role is Competent (3 of 5). A score below the bar simply shows where there is more room
            to grow - it does not mean you are unsuitable.
          </Text>
        </View>

        {oar != null && (
          <>
            <Text style={[sh.eyebrow, { marginTop: 14 }]}>Overall result</Text>
            <View style={sh.statStrip}>
              <View style={sh.statTile}>
                <Text style={sh.statLabel}>Overall rating</Text>
                <Text style={sh.statValue}>{oar.toFixed(1)}</Text>
                <Text style={sh.statSuffix}>of 5, across {comps.length} competencies</Text>
              </View>
            </View>
          </>
        )}

        <Footer name={data.candidateName} audience={AUDIENCE} />
      </Page>

      {/* Your results, grouped by domain */}
      <Page size="A4" style={sh.page}>
        <SectionHeader eyebrow="Your results" title="Your competencies, domain by domain" />
        {groups.map((g, gi) => (
          <View key={g.name}>
            {g.items.map((c, ci) => {
              const score = c.consensusScore ?? 0;
              const col = scoreColor(score);
              const card = (
                <View wrap={false} style={[r.card, { borderLeftColor: col }]}>
                  <View style={r.head}>
                    <Text style={r.name}>{c.competencyName}</Text>
                    <View style={[r.pill, { backgroundColor: col }]}>
                      <Text style={r.pillText}>{score}/5 · {BARS[score]}</Text>
                    </View>
                  </View>
                  <View style={{ marginBottom: 6 }}>
                    <ScoreDots score={score} />
                  </View>
                  {c.explanation ? (
                    <>
                      <Text style={r.lbl}>What it measures</Text>
                      <Text style={r.explain}>{c.explanation}</Text>
                    </>
                  ) : null}
                  <Text style={r.lbl}>Your result</Text>
                  <Text style={r.narr}>{resultNarrative(c)}</Text>
                </View>
              );
              // Keep each domain header with its first card (no orphan headers).
              return ci === 0 ? (
                <View key={c.competencyName} wrap={false}>
                  <DomainHeader name={g.name} marginTop={gi === 0 ? 2 : 10} />
                  {card}
                </View>
              ) : (
                <View key={c.competencyName}>{card}</View>
              );
            })}
          </View>
        ))}

        <View style={[sh.note, { marginTop: 8 }]} wrap={false}>
          <Text style={sh.noteText}>
            These are your results on the VIFM behavioural assessment, valid as a guide for roughly the next
            24 months. Any decision about role fit or next steps rests with the hiring organisation. If you would
            like to talk through your results, VIFM is happy to help.
          </Text>
        </View>

        <Footer name={data.candidateName} audience={AUDIENCE} />
      </Page>
    </Document>
  );
}
