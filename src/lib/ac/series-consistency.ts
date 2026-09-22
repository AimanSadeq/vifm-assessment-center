/**
 * Do the centres in a series still run to the same design?
 *
 * BPS 5.19: where there are a series of centres, there shall be a clear process
 * to assure consistency across them. 9.13 adds that review recommendations
 * shall inform design changes - which is the legitimate way a series changes.
 *
 * The distinction the whole module turns on: **drift is not the same as
 * improvement.** A design that changed because a post-centre review said it
 * should is the standard working. A design that changed because somebody
 * edited an engagement is the thing 5.19 exists to catch. Code cannot tell
 * motive, so this reports the differences plainly and says which centres have a
 * review behind them - and never calls a difference an error.
 *
 * Comparing centres that were never meant to match would be worse than not
 * comparing at all, so a series is something someone declares, not something
 * inferred from two engagements sharing a client.
 */

export type SeriesCentre = {
  engagementId: string;
  name: string;
  startDate?: string | null;
  purpose?: string | null;
  integrationMethod?: string | null;
  otherMethodsRule?: string | null;
  externalEvidenceRule?: string | null;
  competencies: { id: string; name: string; weight: number | null }[];
  exerciseIds: string[];
  exerciseNames: string[];
  /** A post-centre review exists and recommends changes (9.13). */
  hasReview: boolean;
};

export type SeriesDifference = {
  field: string;
  label: string;
  clause: string;
  /** engagementId -> what that centre has. */
  values: { engagementId: string; name: string; value: string }[];
};

export type SeriesConsistency = {
  centres: number;
  differences: SeriesDifference[];
  /** Centres with no post-centre review, so no recorded reason for any change. */
  withoutReview: { engagementId: string; name: string }[];
  summary: string;
};

const fmtWeights = (c: SeriesCentre): string =>
  c.competencies
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((x) => `${x.name}${x.weight != null ? ` ${x.weight}` : ""}`)
    .join(", ") || "none";

const fmtExercises = (c: SeriesCentre): string =>
  c.exerciseNames.slice().sort().join(", ") || "none";

export function reviewSeriesConsistency(centres: SeriesCentre[]): SeriesConsistency {
  const ordered = [...centres].sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
  const differences: SeriesDifference[] = [];

  const compare = (
    field: string,
    label: string,
    clause: string,
    valueOf: (c: SeriesCentre) => string
  ) => {
    const values = ordered.map((c) => ({ engagementId: c.engagementId, name: c.name, value: valueOf(c) }));
    const distinct = new Set(values.map((v) => v.value));
    if (distinct.size > 1) differences.push({ field, label, clause, values });
  };

  compare("purpose", "What the centre is for", "3.7", (c) => c.purpose ?? "not recorded");
  compare(
    "integration_method",
    "How the overall rating is reached",
    "7.4",
    (c) => c.integrationMethod ?? "not recorded"
  );
  compare("competencies", "Criteria and their weights", "4.4 / 7.3", fmtWeights);
  compare("exercises", "Exercises used", "4.14", fmtExercises);
  compare(
    "other_methods_rule",
    "What results from other methods may do to a rating",
    "4.32",
    (c) => c.otherMethodsRule ?? "not decided"
  );
  compare(
    "external_evidence_rule",
    "Whether evidence from outside the centre may count",
    "7.14",
    (c) => c.externalEvidenceRule ?? "not decided"
  );

  const withoutReview = ordered.filter((c) => !c.hasReview).map((c) => ({ engagementId: c.engagementId, name: c.name }));

  let summary: string;
  if (ordered.length < 2) {
    summary = "A series needs at least two centres before there is anything to compare.";
  } else if (differences.length === 0) {
    summary = `All ${ordered.length} centres in this series run to the same design.`;
  } else {
    summary =
      `${differences.length} ${differences.length === 1 ? "difference" : "differences"} across ${ordered.length} centres. `
      + "A difference is not automatically a fault: a design that changed because a post-centre review said it should is the standard working (9.13). "
      + "A design that changed for no recorded reason is what 5.19 asks you to find.";
  }

  return { centres: ordered.length, differences, withoutReview, summary };
}
