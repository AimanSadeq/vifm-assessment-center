// ─────────────────────────────────────────────────────────────
// VIFM High-Potential (HiPo) model.
//
// Original VIFM construction on top of the instruments we actually run:
//   ASPIRATION (will they rise?)  - Persona: eight drive / growth / initiative
//     markers from the 41-competency framework.
//   ABILITY (can they succeed at the next level?) - a stated-weight blend of
//     - behavioural ability: the Persona leadership-relevant competencies
//       (everything outside the aspiration set), and
//     - cognitive agility: the Logica reasoning composite (see the subtest
//       recommendation below).
//   ENGAGEMENT is deliberately NOT scored: commitment to stay cannot be read
//   from a self-report sitting. The report says so and directs it to the
//   manager/HR conversation - an honesty line, not a gap.
//
// The two scored pillars place the individual on a nine-grid (3x3) of
// Aspiration x Ability, each cell carrying a VIFM archetype with a narrative
// and a development focus. Cuts are scale-midpoint based (indicative) until a
// Persona norm sample exists - same posture as the Leadership Report.
// ─────────────────────────────────────────────────────────────

const PREFIX = "a0000001-0000-0000-0000-0000000000";
const id = (suffix: string) => PREFIX + suffix;

/** The eight Persona competencies that mark ASPIRATION - drive, initiative,
 *  growth appetite and the courage to step up. */
export const HIPO_ASPIRATION_IDS: string[] = [
  id("10"), // Proactive Initiative
  id("11"), // Outcome Ownership
  id("12"), // Accountability for Commitments
  id("16"), // Learning by Doing
  id("18"), // Mobilising Around Purpose
  id("31"), // Principled Courage
  id("34"), // Adaptive Learning Capacity
  id("35"), // Continuous Self-Development
];

/** Stated blend for the Ability pillar. Behavioural evidence carries more
 *  weight than a single cognitive sitting; both are visible separately in the
 *  report so the blend is never a black box. */
export const HIPO_ABILITY_WEIGHTS = { behavioural: 0.6, cognitive: 0.4 } as const;

/** Which Logica subtests feed the cognitive axis, and why. */
export const HIPO_LOGICA_RECOMMENDATION = {
  required: [
    {
      key: "inductive",
      why: "Inductive reasoning is the closest proxy for learning agility - spotting patterns in unfamiliar material predicts how quickly someone grows into a bigger, less-defined role.",
    },
    {
      key: "numerical",
      why: "Senior roles in the region's banking, government and corporate context are data- and financially-loaded; numerical reasoning underwrites judgement with numbers.",
    },
  ],
  recommendedForSenior: [
    {
      key: "deductive",
      why: "Rule-based, rigorous conclusions from stated premises - add it when the pipeline targets senior or governance-heavy roles.",
    },
  ],
} as const;

export type HipoBand = "developing" | "solid" | "strong";

/** Indicative cut points on the shared 1-5 scale (midpoint-based until a norm
 *  sample exists - stated in the methodology). */
export const HIPO_CUTS = { solidAt: 3.0, strongAt: 3.8 } as const;

export function hipoBand(score: number): HipoBand {
  if (score >= HIPO_CUTS.strongAt) return "strong";
  if (score >= HIPO_CUTS.solidAt) return "solid";
  return "developing";
}

export const HIPO_BAND_LABEL: Record<HipoBand, string> = {
  developing: "Developing",
  solid: "Solid",
  strong: "Strong",
};

/** Map a Logica % correct onto the shared 1-5 scale. */
export function cognitiveTo5(pctCorrect: number): number {
  const p = Math.max(0, Math.min(100, pctCorrect));
  return 1 + 4 * (p / 100);
}

export type HipoCell = {
  /** 0-2 column (Ability: developing→strong), 0-2 row (Aspiration). */
  col: number;
  row: number;
  archetype: string;
  narrative: string;
  developmentFocus: string;
};

const CELL = (
  col: number,
  row: number,
  archetype: string,
  narrative: string,
  developmentFocus: string,
): HipoCell => ({ col, row, archetype, narrative, developmentFocus });

/** The VIFM nine-grid. Row = Aspiration band, Col = Ability band. */
export const HIPO_GRID: HipoCell[] = [
  // Aspiration STRONG (row 2)
  CELL(2, 2, "High Potential - Accelerate",
    "Strong drive to rise, matched by the behavioural and cognitive capability to succeed at the next level. The profile most worth deliberate, visible investment.",
    "Stretch assignments with real accountability, senior sponsorship, and early exposure to enterprise-level decisions. Guard against under-challenge."),
  CELL(1, 2, "Emerging Potential - Stretch with Support",
    "The ambition is clearly there and capability is solid but not yet senior-ready across the board. With targeted development the trajectory points upward.",
    "Pair one capability-building priority per quarter with a visible stretch task; review progress with a mentor who names the gap honestly."),
  CELL(0, 2, "Eager Developer - Build Foundations",
    "Appetite to rise runs ahead of current capability. Untempered, this profile takes on roles it cannot yet carry; well-coached, it grows fast.",
    "Channel the drive into structured skill-building before role expansion. Small, complete ownership loops beat premature scope."),
  // Aspiration SOLID (row 1)
  CELL(2, 1, "Quiet Strength - Ignite Ambition",
    "Capability at or near next-level standard, with measured rather than hungry aspiration. Often the most under-recognised profile in a pipeline.",
    "Explore what would make a bigger role attractive - scope, mission, autonomy. A targeted conversation can unlock more here than training."),
  CELL(1, 1, "Solid Contributor - Grow Steadily",
    "Balanced aspiration and capability around the standard expected today. A dependable core-talent profile with genuine headroom.",
    "Maintain a steady development rhythm: one behavioural and one technical growth objective at a time, revisited each cycle."),
  CELL(0, 1, "Steady Performer - Focus Development",
    "Moderate drive with capability gaps against next-level demands. Progress is available but needs focus rather than breadth.",
    "Pick the two lowest markers in this report and work only those for six months; breadth can follow depth."),
  // Aspiration DEVELOPING (row 0)
  CELL(2, 0, "Untapped Expert - Re-engage",
    "Real capability without the current appetite to climb. The risk is quiet disengagement; the opportunity is a role redesign that re-energises.",
    "Diagnose the aspiration gap before prescribing anything - fit, recognition, workload or life-stage often explain it. Expert-track paths may fit better than management."),
  CELL(1, 0, "Developing Contributor",
    "Both pillars sit mid-range or below, without a single dominant gap. Potential is not absent - it is unfocused.",
    "Agree one meaningful, visible goal with the line manager and use it as the engine for both capability and confidence."),
  CELL(0, 0, "Early Journey - Foundational Development",
    "Early in the development curve on both pillars. The honest read: not a current high-potential nomination - and that is a timing statement, not a ceiling.",
    "Foundational skills first, delivered through day-to-day work with close feedback loops. Revisit the profile after a full development cycle."),
];

export function hipoCell(aspiration: number, ability: number): HipoCell {
  const rowBand = hipoBand(aspiration);
  const colBand = hipoBand(ability);
  const row = rowBand === "strong" ? 2 : rowBand === "solid" ? 1 : 0;
  const col = colBand === "strong" ? 2 : colBand === "solid" ? 1 : 0;
  return HIPO_GRID.find((c) => c.col === col && c.row === row)!;
}

/** Cognitive development activities per subtest (used when a subtest is the
 *  weakest element - the behavioural tips come from the competency tip bank). */
export const COGNITIVE_DEV_ACTIVITIES: Record<string, string[]> = {
  numerical: [
    "Work one business case per week from raw figures to recommendation - build the habit of quantifying before concluding.",
    "Re-build a report you receive as a consumer (budget, dashboard) from its source data once a month.",
  ],
  inductive: [
    "Practise structured problem decomposition: take an unfamiliar process and map its rules from examples before asking for the manual.",
    "Rotate onto one task outside your specialism each quarter - pattern-finding grows fastest on genuinely new material.",
  ],
  deductive: [
    "Write the explicit if-then logic behind your next three significant decisions and pressure-test each premise.",
    "Review a policy or SOP and trace one real case through it end-to-end, noting every rule applied.",
  ],
  verbal: [
    "Summarise one dense document per week into five defensible bullet points, then verify each against the text.",
  ],
};
