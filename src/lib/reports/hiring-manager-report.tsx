// Hiring-manager lens on an AC result. Same data as the candidate report,
// re-framed for a selection decision: verdict up front, role-fit at a glance,
// strengths vs watch-outs, and probes to validate the gaps before deciding.
import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import {
  C, sh, BARS, recLabel, recColor, CoverHero, SectionHeader, Footer,
  CompetencyMatrix, type AudienceReportProps,
} from "./_audience-shared";

const AUDIENCE = "Hiring Manager Brief";
const TARGET = 3; // "Competent" - the role bar

export function HiringManagerReport({ data }: AudienceReportProps) {
  const comps = data.competencies;
  const atOrAbove = comps.filter((c) => (c.consensusScore ?? 0) >= TARGET);
  const below = comps.filter((c) => (c.consensusScore ?? 0) < TARGET);
  const strengths = comps
    .filter((c) => (c.consensusScore ?? 0) >= 4)
    .sort((a, b) => (b.consensusScore ?? 0) - (a.consensusScore ?? 0));
  const oar = data.overallScore;
  const rc = recColor(data.recommendation);

  const verdict =
    data.executiveSummary ??
    `${data.candidateName} meets the bar on ${atOrAbove.length} of ${comps.length} assessed competencies. ` +
    `${below.length > 0 ? `Targeted development is needed on ${below.length} (${below.map((c) => c.competencyName).join(", ")}).` : "No competency sits below the role bar."}`;

  return (
    <Document
      title={`Hiring Manager Brief - ${data.candidateName}`}
      author="VIFM Assessment Center"
    >
      {/* Cover */}
      <Page size="A4" style={sh.cover}>
        <CoverHero
          eyebrow="Assessment Center · For the Hiring Manager"
          title="Hiring Decision Brief"
          subtitle={data.targetRole ? `Selection for ${data.targetRole}` : "Selection decision support"}
          candidateName={data.candidateName}
          audience={AUDIENCE}
          rows={[
            ["Organisation", data.organizationName],
            ["Target role", data.targetRole ?? "-"],
            ["Assessment dates", data.assessmentDates],
            ["Assessors", data.assessorNames.join(", ") || "-"],
            ["Prepared", data.generatedAt],
          ]}
        />
      </Page>

      {/* Decision summary */}
      <Page size="A4" style={sh.page}>
        <SectionHeader eyebrow="At a glance" title="The decision in one view" />

        <View style={[sh.verdictBox, { borderLeftWidth: 3, borderLeftColor: rc }]}>
          <View style={sh.verdictTop}>
            <Text style={[sh.verdictNum, { color: rc }]}>{oar != null ? oar.toFixed(1) : "-"}</Text>
            <Text style={[sh.verdictRec, { color: rc }]}>{recLabel(data.recommendation)}</Text>
          </View>
          <Text style={sh.verdictText}>{verdict}</Text>
        </View>

        <View style={sh.statStrip}>
          <View style={sh.statTile}>
            <Text style={sh.statLabel}>Overall rating</Text>
            <Text style={sh.statValue}>{oar != null ? oar.toFixed(1) : "-"}</Text>
            <Text style={sh.statSuffix}>of 5</Text>
          </View>
          <View style={sh.statTile}>
            <Text style={sh.statLabel}>At / above bar</Text>
            <Text style={sh.statValue}>{atOrAbove.length}</Text>
            <Text style={sh.statSuffix}>of {comps.length} competencies</Text>
          </View>
          <View style={sh.statTile}>
            <Text style={sh.statLabel}>Below bar</Text>
            <Text style={sh.statValue}>{below.length}</Text>
            <Text style={sh.statSuffix}>need development</Text>
          </View>
          <View style={sh.statTile}>
            <Text style={sh.statLabel}>Clear strengths</Text>
            <Text style={sh.statValue}>{strengths.length}</Text>
            <Text style={sh.statSuffix}>score 4-5</Text>
          </View>
        </View>

        <Text style={sh.eyebrow}>Role-fit at a glance (bar = Competent, 3/5)</Text>
        <View style={{ marginBottom: 14 }}>
          <CompetencyMatrix competencies={comps} target={TARGET} />
        </View>

        {/* What they bring */}
        <View wrap={false} style={[sh.panel, { borderLeftColor: C.positive, backgroundColor: C.positiveBg }]}>
          <Text style={[sh.panelTitle, { color: C.positive }]}>What they bring</Text>
          {(strengths.length ? strengths : comps.slice(0, 2)).slice(0, 4).map((c) => (
            <View style={sh.liRow} key={c.competencyName}>
              <Text style={[sh.liGlyph, { color: C.positive }]}>+</Text>
              <Text style={sh.liText}>
                <Text style={sh.liLabel}>{c.competencyName} ({c.consensusScore}/5). </Text>
                {c.strengths[0]?.text ?? "Demonstrated consistently across exercises."}
              </Text>
            </View>
          ))}
        </View>

        <Footer name={data.candidateName} audience={AUDIENCE} />
      </Page>

      {/* Validate + onboard */}
      <Page size="A4" style={sh.page}>
        <SectionHeader eyebrow="Before you decide" title="Validate the gaps, then onboard" />

        <Text style={[sh.body, { marginBottom: 10 }]}>
          The assessment is one structured input - not the decision. Below are the areas to weigh,
          probes to test them in your own interview or reference checks, and where to focus support
          in the first 90 days if you appoint.
        </Text>

        {below.length > 0 && (
          <View wrap={false} style={[sh.panel, { borderLeftColor: C.negative, backgroundColor: C.negativeBg }]}>
            <Text style={[sh.panelTitle, { color: C.negative }]}>Watch-outs if appointed</Text>
            {below.slice(0, 4).map((c) => (
              <View style={sh.liRow} key={c.competencyName}>
                <Text style={[sh.liGlyph, { color: C.negative }]}>!</Text>
                <Text style={sh.liText}>
                  <Text style={sh.liLabel}>{c.competencyName} ({c.consensusScore}/5). </Text>
                  {c.developmentAreas[0]?.text ?? "Below the role bar - plan targeted support."}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View wrap={false} style={[sh.panel, { borderLeftColor: C.accent }]}>
          <Text style={[sh.panelTitle, { color: C.accent }]}>Probe these before you decide</Text>
          {(below.length ? below : comps.slice(-2)).slice(0, 4).map((c) => (
            <View style={sh.liRow} key={c.competencyName}>
              <Text style={[sh.liGlyph, { color: C.accent }]}>?</Text>
              <Text style={sh.liText}>
                <Text style={sh.liLabel}>{c.competencyName}. </Text>
                Ask for a recent, concrete example that stretched this. Probe what they actually did,
                the trade-offs they weighed, and the result{c.developmentAreas[0]?.text ? ` - and whether "${c.developmentAreas[0].text.replace(/\.$/, "")}" still shows up under pressure.` : "."}
              </Text>
            </View>
          ))}
        </View>

        {data.developmentRecommendations.length > 0 && (
          <View wrap={false} style={[sh.panel, { borderLeftColor: C.warning, backgroundColor: C.warningBg }]}>
            <Text style={[sh.panelTitle, { color: C.warning }]}>If appointed - first 90 days</Text>
            {data.developmentRecommendations.slice(0, 5).map((r, i) => (
              <View style={sh.liRow} key={i}>
                <Text style={[sh.liGlyph, { color: C.warning }]}>{">"}</Text>
                <Text style={sh.liText}>
                  <Text style={sh.liLabel}>{r.competencyName}. </Text>{r.recommendation}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={sh.note}>
          <Text style={sh.noteText}>
            How to use this brief: the rating reflects behaviour observed across {data.exercisesUsed.length} exercises
            and the assessor wash-up consensus. It is a decision aid, not an automatic accept or reject - a single
            below-bar competency does not disqualify a candidate. Findings are most relevant for the next ~24 months.
            BARS scale: 1 = {BARS[1]} · 3 = {BARS[3]} · 5 = {BARS[5]}.
          </Text>
        </View>

        <Footer name={data.candidateName} audience={AUDIENCE} />
      </Page>
    </Document>
  );
}
