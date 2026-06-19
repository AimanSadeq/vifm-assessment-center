import { THRESHOLDS } from "./metrics";
import { INSTRUMENTS } from "./types";
import { COMPETENCY_COUNT } from "@/lib/competencies/framework-meta";
import type { EvidenceMetrics, CellStatus, Cell, MatrixRow } from "./types";

export { INSTRUMENTS } from "./types";
export type { CellStatus, Cell, InstrumentKey, MatrixRow } from "./types";

/**
 * The tabulated coverage matrix: what scientific/psychometric
 * documentation exists per instrument, per validity/reliability
 * category (the AERA/APA/NCME Standards families). Most cells are a
 * curated static judgement from the schema inventory; a handful are
 * COMPUTED live from the database so they update as data accrues
 * (research anchors, internal consistency, inter-rater, test-retest,
 * norms). Computed cells are marked `live: true`.
 *
 * Status meaning:
 *   documented — defensible evidence exists today
 *   partial    — some evidence / in progress / computable but not signed off
 *   missing    — gap; nothing yet (the honest red cells)
 *   na         — not applicable to this instrument's design/use
 */

const d = (note?: string): Cell => ({ status: "documented", note });
const p = (note?: string): Cell => ({ status: "partial", note });
const m = (note?: string): Cell => ({ status: "missing", note });
const na = (note?: string): Cell => ({ status: "na", note });

// ── Computed-cell helpers ─────────────────────────────────────────────
function anchorCell(verified: number | null, total: number | null): Cell {
  if (total === null) return { status: "missing", note: "no data", live: true };
  if (total === 0) return { status: "missing", note: "0 constructs", live: true };
  const v = verified ?? 0;
  const ratio = v / total;
  const note = `${v}/${total} verified`;
  if (ratio >= 0.8) return { status: "documented", note, live: true };
  if (v > 0) return { status: "partial", note, live: true };
  return { status: "missing", note, live: true };
}

/** Sample-size cell: can we yet compute a statistic (alpha/CFA) from accrued data? */
function sampleCell(n: number | null, threshold: number, noun: string): Cell {
  if (n === null) return { status: "missing", note: "no data", live: true };
  if (n >= threshold) return { status: "partial", note: `N=${n} — ${noun} computable`, live: true };
  return { status: "missing", note: `N=${n}/${threshold} for ${noun}`, live: true };
}

function presenceCell(n: number | null, okNote: string, gapNote: string): Cell {
  if (n === null) return { status: "missing", note: "no data", live: true };
  if (n > 0) return { status: "documented", note: okNote.replace("{n}", String(n)), live: true };
  return { status: "missing", note: gapNote, live: true };
}

export function buildMatrix(metrics: EvidenceMetrics): MatrixRow[] {
  const acAnchor = anchorCell(metrics.ac.competenciesVerified, metrics.ac.competenciesTotal);
  const arcAnchor = anchorCell(metrics.arc.questionsVerified, metrics.arc.questionsTotal);
  // The four adapter-driven instruments now carry the same per-construct
  // validation_evidence trail; their anchor cells go live off it.
  const flAnchor = anchorCell(metrics.fluent.anchorsVerified, metrics.fluent.items);
  const tcAnchor = anchorCell(metrics.technical.anchorsVerified, metrics.technical.items);
  const rfAnchor = anchorCell(metrics.reflect.anchorsVerified, metrics.reflect.competencies);
  const psyAnchor = anchorCell(metrics.psy.anchorsVerified, metrics.psy.scalesTotal);

  return [
    {
      category: "Construct definition",
      blurb: "Each construct is explicitly defined before items are written.",
      cells: {
        ac: d(`${COMPETENCY_COUNT} competencies + 249 indicators`),
        arc_org: d("8 pillars — methodology brief §2"),
        arc_ind: d("4 factors — methodology brief §2"),
        fluent: d("CEFR descriptors"),
        technical: d("Domain taxonomy"),
        reflect: d("Framework + behaviours"),
        psy: d("OCEAN + cognitive subtests"),
      },
    },
    {
      category: "Content validity (construct ↔ item map)",
      blurb: "Every item/exercise maps to exactly one defined construct.",
      cells: {
        ac: d("exercise_competency_matrix + indicators"),
        arc_org: d("pillar_id FK on every item"),
        arc_ind: d("individual_factor_id FK"),
        fluent: d("skill-tagged items"),
        technical: d("domain-tagged items"),
        reflect: d("behaviour → competency"),
        psy: d("scale-tagged items"),
      },
    },
    {
      category: "Item / competency research anchors",
      blurb: "Each construct is anchored to published research, human-verified.",
      cells: {
        ac: acAnchor,
        arc_org: arcAnchor,
        arc_ind: arcAnchor,
        fluent: flAnchor,
        technical: tcAnchor,
        reflect: rfAnchor,
        psy: psyAnchor,
      },
    },
    {
      category: "Face validity",
      blurb: "Items use observable behaviours respondents can interpret.",
      cells: {
        ac: p("behavioural indicators; not formally documented"),
        arc_org: d("methodology brief §4"),
        arc_ind: d("methodology brief §4"),
        fluent: d("CEFR can-do statements"),
        technical: p("SME review"),
        reflect: p("behaviour anchors"),
        psy: p("IPIP wording"),
      },
    },
    {
      category: "Construct validity (factor analysis / CFA)",
      blurb: "Empirical confirmation the model carves nature at its joints.",
      cells: {
        ac: m("not run"),
        arc_org: m("planned"),
        arc_ind: sampleCell(metrics.arc.respondentsCompleted, THRESHOLDS.arcIndividualN, "CFA"),
        fluent: p("Rasch item calibration"),
        technical: p("Rasch item calibration"),
        reflect: m("not run"),
        psy: m("planned post-pilot"),
      },
    },
    {
      category: "Internal consistency (Cronbach α)",
      blurb: "Items within a construct correlate; ≥ .80 for high-stakes.",
      cells: {
        ac: na("observational, not scale-based"),
        arc_org: sampleCell(metrics.arc.assessments, THRESHOLDS.arcOrgN, "α"),
        arc_ind: sampleCell(metrics.arc.respondentsCompleted, THRESHOLDS.arcIndividualN, "α"),
        fluent: p("Rasch reliability per skill"),
        technical: p("computable from item bank"),
        reflect: m("not computed"),
        psy: sampleCell(metrics.psy.itemResponses, THRESHOLDS.alphaN, "α"),
      },
    },
    {
      category: "Inter-rater reliability",
      blurb: "Independent raters agree (ICC / consensus).",
      cells: {
        ac: presenceCell(metrics.ac.ratings, "ICC computable — {n} ratings", "no ratings yet"),
        arc_org: p("Phase 2 consultant validation logged"),
        arc_ind: na("single self-report"),
        fluent: p("human–AI QWK ≥ .70 logged"),
        technical: na("auto-scored MCQ"),
        reflect: p("multi-rater; anonymity gate ≥3"),
        psy: na("auto/keyed scoring"),
      },
    },
    {
      category: "Test–retest reliability",
      blurb: "Scores are stable across repeated administrations.",
      cells: {
        ac: m("not tracked"),
        arc_org: p("annual reassessment link supports it"),
        arc_ind: p("prior-attempt link supports it"),
        fluent: m("not tracked"),
        technical: m("not tracked"),
        reflect: m("not tracked"),
        psy: m("not tracked"),
      },
    },
    {
      category: "Criterion validity",
      blurb: "Predicts an outcome (job performance). Selection gold standard.",
      cells: {
        ac: p("AC method meta-analytic support (literature)"),
        arc_org: m("not claimed — developmental tool"),
        arc_ind: m("not claimed — developmental tool"),
        fluent: na("proficiency measure"),
        technical: p("cut-scores via standard-setting"),
        reflect: na("developmental feedback"),
        psy: m("needs validation study"),
      },
    },
    {
      category: "Norms (local / GCC)",
      blurb: "Percentiles referenced to a relevant population.",
      cells: {
        ac: na("criterion-referenced (1–5)"),
        arc_org: m("GCC norms accruing"),
        arc_ind: m("GCC norms accruing"),
        fluent: na("CEFR criterion-referenced"),
        technical: na("cut-score referenced"),
        reflect: na("self-referenced"),
        psy: presenceCell(metrics.psy.norms, "{n} norm row(s) loaded", "no norms loaded — stays indicative"),
      },
    },
    {
      category: "Fairness / DIF",
      blurb: "No differential functioning across protected groups.",
      cells: {
        ac: m("not run"),
        arc_org: m("planned"),
        arc_ind: m("planned"),
        fluent: m("planned"),
        technical: m("planned"),
        reflect: na("non-selection use"),
        psy: m("planned (adverse-impact engine reusable)"),
      },
    },
    {
      category: "Technical manual / methodology doc",
      blurb: "A written artefact a reviewer/client can grade.",
      cells: {
        ac: d("docs/AC-Methodology-Brief.md"),
        arc_org: d("docs/ARA-Methodology-Brief.md"),
        arc_ind: d("docs/ARA-Methodology-Brief.md"),
        fluent: d("docs/Fluent-Methodology-Brief.md"),
        technical: d("docs/Technical-Methodology-Brief.md"),
        reflect: d("docs/Reflect-Methodology-Brief.md"),
        psy: p("docs/psychometrics-proposal.md (draft)"),
      },
    },
  ];
}

/** Roll-up: count of each status across the whole matrix (for the header). */
export function matrixTotals(rows: MatrixRow[]) {
  const totals = { documented: 0, partial: 0, missing: 0, na: 0 } as Record<CellStatus, number>;
  for (const r of rows) for (const inst of INSTRUMENTS) totals[r.cells[inst.key].status]++;
  return totals;
}
