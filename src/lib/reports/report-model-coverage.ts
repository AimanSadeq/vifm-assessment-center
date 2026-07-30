// ─────────────────────────────────────────────────────────────
// Report-model coverage for a Persona competency selection.
//
// A bespoke sitting scoped to a subset of the 41 only fully feeds the report
// models whose competencies were all selected - the reports honestly mark the
// rest "not selected" rather than fabricating scores. This helper tells the
// composer, LIVE, what a given selection buys: Full / Partial / Won't
// generate, per model. Client-safe (pure constants only - no server imports).
// ─────────────────────────────────────────────────────────────

import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { LEADERSHIP_DIMENSION } from "@/lib/reports/persona-leadership-dimensions";
import { DARE_ROLE } from "@/lib/reports/persona-dare-dimensions";
import { EQ_QUADRANT } from "@/lib/reports/persona-eq-dimensions";
import { HIPO_ASPIRATION_IDS } from "@/lib/reports/persona-hipo-model";

export type CoverageState = "full" | "partial" | "unavailable";

export type ModelCoverage = {
  key: "leadership" | "dare" | "eq" | "hipo";
  label: string;
  state: CoverageState;
  /** Short human note, e.g. "18/22 EI competencies". */
  note: string;
};

const ALL_IDS = BEHAVIORAL_COMPETENCIES.map((c) => c.acCompetencyId);
const LEADERSHIP_IDS = Object.keys(LEADERSHIP_DIMENSION);
const DARE_IDS = Object.keys(DARE_ROLE);
const EQ_IDS = Object.keys(EQ_QUADRANT);

// Mirrors the fail-closed floors in the HiPo data loader (persona-hipo-data.ts).
const HIPO_MIN_ASPIRATION = 4;
const HIPO_MIN_BROADER = 4;

/** Coverage of each Persona-derived report model for a competency selection. */
export function reportModelCoverage(selectedIds: string[]): ModelCoverage[] {
  const sel = new Set(selectedIds);
  const count = (ids: string[]) => ids.filter((i) => sel.has(i)).length;

  const mk = (
    key: ModelCoverage["key"],
    label: string,
    covered: number,
    total: number,
    unavailable: boolean,
    unavailableNote: string,
  ): ModelCoverage => ({
    key,
    label,
    state: unavailable ? "unavailable" : covered === total ? "full" : "partial",
    note: unavailable ? unavailableNote : `${covered}/${total} competencies`,
  });

  const leadership = count(LEADERSHIP_IDS);
  const dare = count(DARE_IDS);
  const eq = count(EQ_IDS);
  const aspiration = count(HIPO_ASPIRATION_IDS);
  const broader = count(ALL_IDS.filter((i) => !HIPO_ASPIRATION_IDS.includes(i)));
  const hipoUnavailable = aspiration < HIPO_MIN_ASPIRATION || broader < HIPO_MIN_BROADER;

  return [
    mk("leadership", "Leadership Report", leadership, LEADERSHIP_IDS.length, leadership === 0, "No competencies selected"),
    mk("dare", "DARE Profile", dare, DARE_IDS.length, dare === 0, "No competencies selected"),
    mk("eq", "EQ Profile", eq, EQ_IDS.length, eq === 0, "No EI-mapped competencies selected"),
    {
      key: "hipo",
      label: "High-Potential Profile",
      state: hipoUnavailable ? "unavailable" : aspiration === HIPO_ASPIRATION_IDS.length && broader === ALL_IDS.length - HIPO_ASPIRATION_IDS.length ? "full" : "partial",
      note: hipoUnavailable
        ? `Needs ${HIPO_MIN_ASPIRATION}+ drive markers and ${HIPO_MIN_BROADER}+ broader competencies (${aspiration}/8 markers selected)`
        : `${aspiration}/8 drive markers · ${broader}/${ALL_IDS.length - HIPO_ASPIRATION_IDS.length} broader`,
    },
  ];
}
