/**
 * Did this centre's outcomes fall differently on one group than another?
 *
 * BPS 3.19 requires demographic data to be collected from participants for
 * monitoring, 4.22 requires that exercise design not unfairly advantage or
 * disadvantage a sub-group, and 9.9 puts diversity in the evaluation plan.
 * Pre-Hire has answered this since migration 00051; the Assessment Center, the
 * older and more consequential product, could not answer it at all.
 *
 * The arithmetic is Pre-Hire's (computeAdverseImpactForPool): same 4/5ths
 * threshold, same reference group, same small-sample caveats. What is different
 * here is what "selected" means, which is a judgement the Assessment Center has
 * to make for itself:
 *
 *   A centre does not select anyone. It produces a recommendation, and somebody
 *   else decides. So the pool is every participant with a finalised overall
 *   rating, and "selected" is the favourable outcome - by default Ready Now,
 *   because that is the recommendation that opens a door. Ready Now or Ready
 *   with Development is offered as the alternative reading, since for many
 *   clients that is the shortlist, and the answer can differ between the two.
 *
 * A development centre selects nobody, so the analysis is not offered for one:
 * a 4/5ths table over ratings nobody acted on would invite exactly the
 * inference the standard warns against.
 */

import { computeAdverseImpactForPool, type AdverseImpactReport } from "@/lib/prehire/adverse-impact";
import type { PrehireGender, PrehireAgeBand, PrehireNationalityGroup } from "@/types/prehire";

export type AcFavourableOutcome = "ready_now" | "ready_now_or_development";

export const AC_FAVOURABLE_LABELS: Record<AcFavourableOutcome, string> = {
  ready_now: "Ready Now",
  ready_now_or_development: "Ready Now or Ready with Development",
};

export type AcFairnessCandidate = {
  gender?: string | null;
  age_band?: string | null;
  nationality_group?: string | null;
  demographics_submitted_at?: string | null;
  /** The finalised overall recommendation, or null if the centre has not rated them. */
  recommendation?: string | null;
};

export type AcFairnessView = {
  /** Null when the centre cannot support the analysis; `reason` says why. */
  report: AdverseImpactReport | null;
  reason: string | null;
  favourable: AcFavourableOutcome;
  participants: number;
  rated: number;
  disclosed: number;
};

const FAVOURABLE: Record<AcFavourableOutcome, string[]> = {
  ready_now: ["ready_now"],
  ready_now_or_development: ["ready_now", "ready_with_development"],
};

export function computeAcFairness(
  candidates: AcFairnessCandidate[],
  opts: { purpose?: string | null; favourable?: AcFavourableOutcome } = {}
): AcFairnessView {
  const favourable = opts.favourable ?? "ready_now";
  const rated = candidates.filter((c) => Boolean(c.recommendation));
  const disclosed = candidates.filter(
    (c) =>
      (c.gender && c.gender !== "prefer_not_to_say")
      || (c.age_band && c.age_band !== "prefer_not_to_say")
      || (c.nationality_group && c.nationality_group !== "prefer_not_to_say")
  );

  const base = {
    favourable,
    participants: candidates.length,
    rated: rated.length,
    disclosed: disclosed.length,
  };

  if (opts.purpose === "development") {
    return {
      ...base,
      report: null,
      reason:
        "This is a development centre, so no one is selected and there is no selection rate to compare. "
        + "Fairness here is a question about the development recommendations people received, which the "
        + "competency results answer better than a 4/5ths table.",
    };
  }
  if (rated.length === 0) {
    return { ...base, report: null, reason: "No participant has a finalised overall rating yet." };
  }
  if (disclosed.length === 0) {
    return {
      ...base,
      report: null,
      reason:
        "No participant has given any demographic information, so there is nothing to compare. "
        + "It is voluntary, and a centre where everyone declines is a legitimate outcome, not an error.",
    };
  }

  const pool = rated.map((c) => ({
    gender: (c.gender ?? null) as PrehireGender | null,
    age_band: (c.age_band ?? null) as PrehireAgeBand | null,
    nationality_group: (c.nationality_group ?? null) as PrehireNationalityGroup | null,
    selected: FAVOURABLE[favourable].includes(c.recommendation as string),
  }));

  return { ...base, report: computeAdverseImpactForPool(pool, "decision"), reason: null };
}
