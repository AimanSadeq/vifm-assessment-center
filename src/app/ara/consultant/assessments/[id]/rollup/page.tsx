import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { getCurrentCaller, isInternalAraRender } from "@/lib/ara/auth-guards";
import { VifmLogo } from "@/components/shared/vifm-logo";
import { BackLink } from "@/components/shared/back-link";
import { ARA_PILLARS, ARA_MATURITY_LEVELS } from "@/lib/constants/ara-pillars";
import { ARA_STAGE_MAP } from "@/lib/constants/ara-stages";
import { computeUnitRollup, UNEVEN_THRESHOLD, levelForScore } from "@/lib/ara/unit-rollup";
import { MaturityGauge } from "../report/_components/maturity-gauge";
import { SectionHeader, StatTile, TOKENS } from "../report/_components/report-primitives";
import type { AraAssessment, AraOrganization } from "@/types/ara";
import "../report/report.css";

export const dynamic = "force-dynamic";

const TARGET = 4.0;

/**
 * Cross-unit rollup report - the Division / Enterprise deliverable.
 *
 * A unit's own report answers "how ready is this department". This answers the
 * question a single unit cannot: which units are behind, where they differ,
 * and which gaps are shared (fix once, centrally) versus uneven (move capability
 * between units). It reuses the units' already-computed pillar scores, so it
 * can never disagree with the reports underneath it.
 */
export default async function AraRollupReportPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { bare?: string; weight?: string };
}) {
  const bare = searchParams?.bare === "1";
  const weighting = searchParams?.weight === "equal" ? "equal" : "respondents";
  const sb = createServiceClient();

  const { data: assessment } = await sb
    .from("ara_assessments")
    .select("*, organization:ara_organizations(id, name, name_ar, region, sector)")
    .eq("id", params.id)
    .maybeSingle<
      AraAssessment & {
        organization: Pick<AraOrganization, "id" | "name" | "name_ar" | "region" | "sector"> | null;
      }
    >();
  if (!assessment) return notFound();

  // Same ownership rule as the unit report: the layout gates role, this gates
  // the row. The PDF route authorizes first and marks its render internal.
  const internalRender = await isInternalAraRender();
  if (!internalRender) {
    const caller = await getCurrentCaller();
    if (caller && caller.role !== "admin" && assessment.consultant_id !== caller.uid) {
      return notFound();
    }
  }

  const rollup = await computeUnitRollup(assessment.id, weighting);
  const orgName = assessment.organization?.name ?? "Organisation";
  const stageLabel = ARA_STAGE_MAP[assessment.engagement_stage]?.label_en ?? assessment.engagement_stage;
  const reportDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const pillarName = (id: string) => ARA_PILLARS.find((p) => p.id === id)?.name_en ?? id;
  const pctOfTarget = (s: number) => Math.round((s / TARGET) * 100);

  if (rollup.units.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        {!bare && <BackLink href={`/ara/consultant/assessments/${assessment.id}`} label="Back to assessment" />}
        <h1 className="text-2xl font-semibold mt-4" style={{ color: TOKENS.navy }}>
          No units linked yet
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          A rollup compares the units beneath it - the departments in a division,
          or the divisions in an enterprise. Link at least two units on the
          assessment page, then this report will show how they compare. With one
          unit there is nothing to compare, and its own report already says
          everything this one could.
        </p>
      </div>
    );
  }

  const scoredUnits = rollup.units.filter((u) => u.overall != null);
  const cellFor = (score: number | undefined) => {
    if (score == null) return { background: "#f9fafb", color: "#cbd5e1", border: "1px solid #f1f5f9" };
    const level = levelForScore(score);
    const tint: Record<number, { bg: string; fg: string }> = {
      1: { bg: "#FB7185", fg: "white" },
      2: { bg: "#fdd9c7", fg: "#374151" },
      3: { bg: "#fef3c7", fg: "#374151" },
      4: { bg: "#a7f3d0", fg: "#065f46" },
      5: { bg: "#12805c", fg: "white" },
    };
    const t = tint[level] ?? tint[3];
    return { background: t.bg, color: t.fg, border: "none" };
  };

  return (
    <>
      {!bare && (
        <div className="no-print bg-white border-b px-6 py-3 flex items-center justify-between">
          <BackLink href={`/ara/consultant/assessments/${assessment.id}`} label="Back to assessment" />
          <a
            className="text-sm underline"
            href={`/api/ara/reports/${assessment.id}/rollup/pdf`}
          >
            Download PDF
          </a>
        </div>
      )}

      <div className={`report-body-wrap ${bare ? "" : "bg-gray-100 py-8"}`}>
        {/* ─── Cover ─── */}
        <section
          className="report-page report-cover flex flex-col justify-between"
          style={{ background: "#010131", color: "white" }}
        >
          <div className="flex items-center gap-3">
            <VifmLogo variant="white" size="md" />
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-widest" style={{ opacity: 0.7 }}>
              Confidential - {assessment.is_sandbox ? "Sample - Not for Client Distribution" : "For Internal VIFM Use"}
            </p>
            <h1 className="mt-6" style={{ fontSize: "34pt", fontWeight: 700, lineHeight: 1.15 }}>
              {orgName}
            </h1>
            <p className="text-lg mt-3" style={{ color: "white", opacity: 0.85 }}>
              {stageLabel} AI Readiness - Cross-unit comparison
            </p>
            <p className="text-sm mt-6" style={{ color: "white", opacity: 0.75 }}>
              {rollup.units.length} units · {rollup.totalRespondents} respondents
            </p>
          </div>
          <div className="flex justify-between text-xs" style={{ color: "white", opacity: 0.75 }}>
            <div>
              <p>{assessment.region === "saudi" ? "Saudi Arabia" : "United Arab Emirates"}</p>
              <p>{assessment.scope_label ?? stageLabel}</p>
            </div>
            <div className="text-right">
              <p>Report generated {reportDate}</p>
              <p>Virginia Institute of Finance and Management</p>
            </div>
          </div>
        </section>

        {/* ─── Executive summary ─── */}
        <section className="report-page">
          <SectionHeader
            eyebrow="Cross-unit summary"
            title="How the units compare"
            kicker={`Each unit was assessed separately and has its own report. This view compares them: where they stand together, and where they differ.`}
          />

          <div className="stat-strip" style={{ marginTop: "16pt" }}>
            <StatTile
              label="Units assessed"
              value={String(rollup.units.length)}
              accent={`${scoredUnits.length} with scores`}
              accentColor={TOKENS.navy}
            />
            <StatTile
              label={`${stageLabel} readiness`}
              value={rollup.overall != null ? rollup.overall.toFixed(2) : "-"}
              accent={rollup.overallBand ? rollup.overallBand.label_en : "Not yet scored"}
              accentColor={TOKENS.navy}
            />
            <StatTile
              label="Shared gaps"
              value={String(rollup.sharedGaps.length)}
              accent="Every unit below 4.00"
              accentColor={TOKENS.rose}
            />
            <StatTile
              label="Uneven pillars"
              value={String(rollup.unevenPillars.length)}
              accent={`Units differ by ${UNEVEN_THRESHOLD.toFixed(1)}+`}
              accentColor={TOKENS.amber}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 0.85fr", gap: "18pt", marginTop: "20pt", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: "8.5pt", letterSpacing: "0.12em", textTransform: "uppercase", color: TOKENS.mute, fontWeight: 700, margin: "0 0 6pt" }}>
                Narrative
              </p>
              <p className="report-body">
                Across {rollup.units.length} units and {rollup.totalRespondents} respondents,{" "}
                <strong>{orgName}</strong> scores{" "}
                <strong>{rollup.overall != null ? rollup.overall.toFixed(2) : "-"} / 5.00</strong>
                {rollup.overallBand ? ` (${rollup.overallBand.label_en})` : ""}.
                {rollup.units.length > 1 && scoredUnits.length > 1 && (
                  <>
                    {" "}The strongest unit is <strong>{scoredUnits[0].label}</strong> at{" "}
                    {scoredUnits[0].overall!.toFixed(2)}; the weakest is{" "}
                    <strong>{scoredUnits[scoredUnits.length - 1].label}</strong> at{" "}
                    {scoredUnits[scoredUnits.length - 1].overall!.toFixed(2)}.
                  </>
                )}
                {rollup.sharedGaps.length > 0 && (
                  <>
                    {" "}
                    {rollup.sharedGaps.length} pillar{rollup.sharedGaps.length === 1 ? " sits" : "s sit"} below
                    target in <em>every</em> unit, starting with{" "}
                    <strong>{pillarName(rollup.sharedGaps[0].pillar_id)}</strong>.
                  </>
                )}
              </p>
              {/* The point of a rollup: the average is the least useful number
                  on the page when the units disagree. */}
              {rollup.unevenPillars.length > 0 && (
                <p className="report-body" style={{ marginTop: "6pt" }}>
                  On{" "}
                  <strong>{pillarName(rollup.unevenPillars[0].pillar_id)}</strong> the
                  units are {rollup.unevenPillars[0].spread.toFixed(2)} apart
                  ({rollup.unevenPillars[0].weakest} {rollup.unevenPillars[0].min.toFixed(2)} to{" "}
                  {rollup.unevenPillars[0].strongest} {rollup.unevenPillars[0].max.toFixed(2)}).
                  A single average describes neither.
                </p>
              )}
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <MaturityGauge score={rollup.overall} />
            </div>
          </div>

          <p className="report-body report-muted" style={{ fontSize: "8.5pt", marginTop: "14pt" }}>
            The {stageLabel.toLowerCase()} score is a{" "}
            {rollup.weighting === "respondents"
              ? "respondent-weighted average of the unit scores, so a larger unit counts for more"
              : "straight average of the unit scores, so every unit counts equally"}
            . Each unit score is the mean of the pillars in that unit&apos;s own scope.
          </p>
        </section>

        {/* ─── Unit ranking ─── */}
        <section className="report-page">
          <h2 className="report-h2">Units ranked</h2>
          <p className="report-body">
            Every unit on the same 1.00-5.00 scale, against the 4.00 AI Ready
            target. Respondents shown because a score from three people carries
            less weight than one from forty.
          </p>
          <table className="report-body" style={{ width: "100%", borderCollapse: "collapse", marginTop: "12pt" }}>
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={cellHead}>Unit</th>
                <th style={cellHead}>Respondents</th>
                <th style={cellHead}>Score</th>
                <th style={cellHead}>% of target</th>
                <th style={cellHead}>Maturity</th>
              </tr>
            </thead>
            <tbody>
              {rollup.units.map((u) => {
                const lvl = u.overall != null ? levelForScore(u.overall) : null;
                const lvlLabel = lvl != null
                  ? ARA_MATURITY_LEVELS.find((l) => l.level === lvl)?.label_en ?? ""
                  : "Not scored";
                return (
                  <tr key={u.assessment_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={cell}><strong>{u.label}</strong></td>
                    <td style={cell}>{u.completed_respondents}</td>
                    <td style={{ ...cell, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {u.overall != null ? u.overall.toFixed(2) : "-"}
                    </td>
                    <td style={{ ...cell, fontVariantNumeric: "tabular-nums" }}>
                      {u.overall != null ? `${pctOfTarget(u.overall)}%` : "-"}
                    </td>
                    <td style={cell}>{lvl != null ? `L${lvl} ${lvlLabel}` : lvlLabel}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        {/* ─── Units x pillars matrix ─── */}
        <section className="report-page">
          <h2 className="report-h2">Units by pillar</h2>
          <p className="report-body">
            Every unit against every pillar it was assessed on. Blank means the
            pillar was not in that unit&apos;s scope, which is not the same as a
            low score. Colour is the maturity level, so a row of green and one
            red cell is a targeted problem, and a uniformly amber column is a
            problem the whole {stageLabel.toLowerCase()} shares.
          </p>
          <div style={{
            display: "grid",
            gridTemplateColumns: `120pt repeat(${rollup.pillars.length}, 1fr)`,
            gap: "2pt",
            marginTop: "14pt",
            fontSize: "8.5pt",
          }}>
            <div />
            {rollup.pillars.map((p) => (
              <div key={p} style={{ textAlign: "center", color: "#6b7280", fontSize: "7pt", lineHeight: 1.2, paddingBottom: "3pt" }}>
                {pillarName(p)}
              </div>
            ))}
            {rollup.units.map((u) => (
              <div key={u.assessment_id} style={{ display: "contents" }}>
                <div style={{ padding: "6pt 8pt", fontWeight: 500, fontSize: "8.5pt", color: "#374151", background: "#f9fafb", borderRadius: "3pt" }}>
                  {u.label}
                </div>
                {rollup.pillars.map((p) => {
                  const v = u.byPillar.get(p);
                  return (
                    <div key={`${u.assessment_id}-${p}`} style={{
                      ...cellFor(v),
                      padding: "6pt",
                      textAlign: "center",
                      borderRadius: "3pt",
                      fontWeight: 600,
                      fontVariantNumeric: "tabular-nums",
                      minHeight: "22pt",
                    }}>
                      {v != null ? v.toFixed(2) : "-"}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="report-body report-muted" style={{ fontSize: "8pt", marginTop: "10pt" }}>
            Scores run 1.00 to 5.00. 4.00 is the AI Ready target, not the maximum -
            L4 Advancing (4.00-4.44) and L5 Leading (4.50-5.00) sit above it.
          </p>

          {/* A pillar in the parent's scope that NO unit assessed produces no
              row and no colour, which reads as "fine". Naming it is the
              difference between no evidence and no problem. */}
          {rollup.uncoveredPillars.length > 0 && (
            <div style={{
              marginTop: "14pt", padding: "10pt 12pt",
              background: "#fffbeb", border: "1pt solid #FBBF24",
              borderRadius: "6pt",
            }}>
              <p className="report-body" style={{ margin: 0, fontSize: "9.5pt" }}>
                <strong>Not assessed at this level.</strong>{" "}
                {rollup.uncoveredPillars.map((p) => pillarName(p)).join(", ")}{" "}
                {rollup.uncoveredPillars.length === 1 ? "is" : "are"} in the
                {" "}{stageLabel.toLowerCase()}&apos;s scope but{" "}
                {rollup.uncoveredPillars.length === 1 ? "was" : "were"} not
                covered by any unit beneath it - these are typically set above
                the individual unit. No evidence was collected, which is not the
                same as no gap. Assess {rollup.uncoveredPillars.length === 1 ? "it" : "them"}
                {" "}at {stageLabel.toLowerCase()} level to complete the picture.
              </p>
            </div>
          )}
        </section>

        {/* ─── Where the units differ ─── */}
        <section className="report-page">
          <h2 className="report-h2">Shared gaps and uneven pillars</h2>
          <p className="report-body">
            This is the finding a single unit&apos;s report cannot produce. A gap
            every unit shares is usually structural and is fixed once, centrally.
            A pillar where the units are far apart is usually capability that
            already exists somewhere in the organisation and has not travelled.
          </p>

          <h3 className="report-h3" style={{ marginTop: "14pt" }}>
            Shared gaps ({rollup.sharedGaps.length})
          </h3>
          {rollup.sharedGaps.length === 0 ? (
            <p className="report-body report-muted">
              No pillar is below target in every unit. Each gap belongs to
              specific units, so the work is targeted rather than central.
            </p>
          ) : (
            <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={cellHead}>Pillar</th>
                  <th style={cellHead}>Mean</th>
                  <th style={cellHead}>% of target</th>
                  <th style={cellHead}>Best unit</th>
                </tr>
              </thead>
              <tbody>
                {rollup.sharedGaps.map((s) => (
                  <tr key={s.pillar_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={cell}><strong>{pillarName(s.pillar_id)}</strong></td>
                    <td style={{ ...cell, fontVariantNumeric: "tabular-nums" }}>{s.mean.toFixed(2)}</td>
                    <td style={{ ...cell, fontVariantNumeric: "tabular-nums" }}>{pctOfTarget(s.mean)}%</td>
                    <td style={cell}>{s.strongest} ({s.max.toFixed(2)})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 className="report-h3" style={{ marginTop: "16pt" }}>
            Uneven pillars ({rollup.unevenPillars.length})
          </h3>
          {rollup.unevenPillars.length === 0 ? (
            <p className="report-body report-muted">
              No pillar shows a spread of {UNEVEN_THRESHOLD.toFixed(1)} or more
              between units. The units are performing consistently, so the
              {" "}{stageLabel.toLowerCase()} average is a fair description of all of them.
            </p>
          ) : (
            <table className="report-body" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f3f4f6" }}>
                  <th style={cellHead}>Pillar</th>
                  <th style={cellHead}>Spread</th>
                  <th style={cellHead}>Strongest</th>
                  <th style={cellHead}>Weakest</th>
                </tr>
              </thead>
              <tbody>
                {rollup.unevenPillars.map((s) => (
                  <tr key={s.pillar_id} style={{ borderTop: "1px solid #e5e7eb" }}>
                    <td style={cell}><strong>{pillarName(s.pillar_id)}</strong></td>
                    <td style={{ ...cell, fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                      {s.spread.toFixed(2)}
                    </td>
                    <td style={cell}>{s.strongest} ({s.max.toFixed(2)})</td>
                    <td style={cell}>{s.weakest} ({s.min.toFixed(2)})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{
            marginTop: "18pt", padding: "12pt 14pt",
            background: "var(--ara-bg-soft)", border: "1pt solid var(--ara-line)",
            borderLeft: "3pt solid var(--ara-accent)", borderRadius: "6pt",
          }}>
            <h3 className="report-h3" style={{ marginTop: 0 }}>Reading this together</h3>
            <p className="report-body" style={{ margin: 0 }}>
              Shared gaps set the central agenda: policy, platform and standards
              that no single unit can fix alone. Uneven pillars set the internal
              agenda: the unit already scoring highest has practice worth moving,
              and the Phase 2 workshop is where that transfer gets specified.
              Each unit&apos;s own report carries its detailed findings and its
              recommended actions.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}

const cellHead: React.CSSProperties = {
  textAlign: "left", padding: "6pt 8pt", fontWeight: 600,
  fontSize: "9pt", color: "#374151",
};
const cell: React.CSSProperties = { padding: "6pt 8pt", fontSize: "9.5pt", color: "#374151" };
