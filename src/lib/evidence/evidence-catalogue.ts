/**
 * Research & validity catalogue - the curated, citable evidence base for every
 * assessment instrument on the platform. Pure data (no server import) so the
 * page and a future PDF can both consume it. Item COUNTS are filled in live
 * from the database at render time (see countKey + loadEvidenceCounts).
 *
 * Citations are real, canonical sources for each method - the page's whole job
 * is to prove the items are grounded in established research, not invented. The
 * honest `tier` flag separates literature-grounded instruments from items that
 * are still indicative (AI-generated, no local norms / IRT yet).
 */

export type EvidenceTier = "grounded" | "indicative";

export interface EvidenceInstrument {
  key: string;
  /** Instrument / module name. */
  name: string;
  /** Where it lives, for the "open" link. */
  href: string;
  /** Question / item types used. */
  itemTypes: string;
  /** What the items measure. */
  construct: string;
  /** The validity claim, stated honestly. */
  validity: string;
  /** Reliability evidence (or the planned path to it). */
  reliability: string;
  /** Honest grounding tier. */
  tier: EvidenceTier;
  /** Canonical literature / framework sources. */
  literature: string[];
  /** Links to in-app supporting documentation. */
  docs: { label: string; href: string }[];
  /** Live-count source key (resolved by loadEvidenceCounts) + its unit label. */
  countKey: string;
  countLabel: string;
}

export const EVIDENCE_INSTRUMENTS: EvidenceInstrument[] = [
  {
    key: "ac",
    name: "Assessment Center",
    href: "/admin",
    itemTypes:
      "Behaviourally Anchored Rating Scales (BARS, 1-5 + No Evidence) applied by trained assessors to observed behaviour across multiple exercises, integrated in a consensus wash-up.",
    construct: "The 41 VIFM behavioural competencies (4 domains, 9 clusters, 249 behavioural indicators).",
    validity:
      "Content validity - competencies and indicators derived from the VIFM framework; each competency is observed in at least two exercises (the exercise-competency matrix), the design basis for content coverage.",
    reliability: "Inter-rater reliability via Intraclass Correlation (ICC) across assessors; ratings integrated to consensus.",
    tier: "grounded",
    literature: [
      "ISO 10667 - Assessment service delivery in work and organizational settings",
      "International Taskforce on Assessment Center Operations - Guidelines (6th ed., 2015)",
      "Smith & Kendall (1963) - Behaviourally Anchored Rating Scales",
      "Shrout & Fleiss (1979) - Intraclass correlations",
    ],
    docs: [
      { label: "AC evidence", href: "/admin/ac-evidence" },
      { label: "Evidence map", href: "/admin/evidence-map" },
      { label: "Competency framework", href: "/admin/framework" },
    ],
    countKey: "competencies",
    countLabel: "competencies",
  },
  {
    key: "ara",
    name: "AI Readiness Compass® (ARA)",
    href: "/ara",
    itemTypes:
      "Layer-1 self-assessment maturity items (Likert 1-5), plus situational-judgment and knowledge-check items; mapped to 8 organisational pillars and 4 individual factors.",
    construct: "Organisational and individual AI readiness across 8 pillars / 4 VIFM factors.",
    validity:
      "Content validity - a vetted Production Bank (v1.1) with per-question validation evidence (anchor instruments + human-review status); pillars pre-mapped to 16 UAE/Saudi regulatory frameworks.",
    reliability: "Distortion detection and perception-vs-reality validated scoring; per-pillar internal-consistency planned.",
    tier: "grounded",
    literature: [
      "UAE PDPL, NCA ECC, SDAIA NDGF, DCAI, ADDA frameworks",
      "Saudi PDPL and Vision 2030 AI governance frameworks",
      "ISO/IEC 42001 - AI management systems",
    ],
    docs: [
      { label: "Methodology brief (PDF)", href: "/api/ara/methodology/pdf" },
      { label: "Question bank", href: "/ara/admin/questions" },
    ],
    countKey: "ara_questions",
    countLabel: "active bank questions",
  },
  {
    key: "persona",
    name: "Persona® (behavioural self-assessment)",
    href: "/ac/persona",
    itemTypes: "Likert self-ratings across the behavioural competencies - the 'self' view that feeds Succession Readiness.",
    construct: "Self-perceived standing on the VIFM behavioural competencies.",
    validity:
      "Content validity - the same competency framework as the Assessment Center and Reflect 360; single-source self-report, triangulated against 360 ratings in Succession Readiness.",
    reliability: "Internal consistency planned; self-vs-others gap computed against Reflect 360 (others).",
    tier: "grounded",
    literature: [
      "Atwater & Yammarino (1992) - self-other rating agreement",
      "ISO 10667 - assessment service delivery",
    ],
    docs: [{ label: "Competency framework", href: "/admin/framework" }],
    countKey: "persona_competencies",
    countLabel: "competencies",
  },
  {
    key: "cognitive",
    name: "Logica®",
    href: "/ac/cognitive",
    itemTypes: "MCQ numerical, verbal, inductive and deductive reasoning subtests, with a general mental ability (g) composite.",
    construct: "Reasoning aptitude / general mental ability (a foundational predictor).",
    validity:
      "Construct framing from the g / CHC literature. Tier 1 is INDICATIVE: AI-generated items, no local norms or IRT calibration yet, and it issues no credential.",
    reliability: "Classical scoring; Cronbach's alpha and Rasch/IRT calibration are the documented Tier-2 path (not yet met).",
    tier: "indicative",
    literature: [
      "Spearman (1904) - general intelligence (g)",
      "Carroll (1993) - Three-Stratum theory (CHC)",
      "Schmidt & Hunter (1998) - validity of general mental ability in selection",
    ],
    docs: [{ label: "Item bank & calibration", href: "/admin/psychometrics" }],
    countKey: "cognitive_items",
    countLabel: "calibrated items",
  },
  {
    key: "personality",
    name: "Big Five personality (Psychometrics)",
    href: "/admin/psychometrics",
    itemTypes:
      "Public-domain IPIP Big-Five Likert items (Mini-IPIP 20-item / IPIP-50 50-item), reverse-keyed, with social-desirability and inconsistency validity flags.",
    construct: "The Five-Factor Model (Openness, Conscientiousness, Extraversion, Agreeableness, Emotional Stability).",
    validity:
      "Construct validity from the published IPIP instruments. Scores are indicative until a local norm sample is collected (Tier 2); the platform issues no personality credential.",
    reliability: "Reliabilities reported in the source instruments; local alpha + norms are the documented Tier-2 path.",
    tier: "grounded",
    literature: [
      "Donnellan, Oswald, Baird & Lucas (2006) - the Mini-IPIP",
      "Goldberg (1992); Goldberg et al. (2006) - IPIP Big-Five markers",
      "Costa & McCrae (1992) - the Five-Factor Model",
    ],
    docs: [{ label: "Item bank & calibration", href: "/admin/psychometrics" }],
    countKey: "personality_items",
    countLabel: "items",
  },
  {
    key: "fluent",
    name: "Fluent® (English placement)",
    href: "/ac/fluent",
    itemTypes:
      "Four CEFR-aligned skills - reading + listening (auto-scored MCQ) and writing + speaking (rubric-scored against the CEFR), from a calibrated item bank.",
    construct: "CEFR English proficiency (A1-C2).",
    validity:
      "Content validity anchored to the CEFR can-do descriptors; positioned as indicative placement, not a certified high-stakes score.",
    reliability: "AI-vs-human Quadratic Weighted Kappa calibration (target >= 0.70) per skill; overall confidence band.",
    tier: "grounded",
    literature: [
      "Council of Europe (2001, 2020) - Common European Framework of Reference for Languages",
      "Cohen (1968) - weighted kappa for agreement",
    ],
    docs: [{ label: "Scoring calibration", href: "/ac/fluent/calibration" }],
    countKey: "fluent_items",
    countLabel: "calibrated items",
  },
  {
    key: "technical",
    name: "Technical proficiency",
    href: "/admin/tech-sandbox",
    itemTypes:
      "Performance-based sandbox tasks (spreadsheet / calculation / SQL) scored against a master answer via weighted checkpoints, plus SME-reviewed MCQ knowledge items with documented cut-scores.",
    construct: "Functional technical skill per finance domain.",
    validity:
      "Content validity - an SME-reviewed item bank with documented cut-scores. The CERTIFIED path assembles only approved items; otherwise the result is INDICATIVE.",
    reliability: "Light item statistics (p-values); IRT calibration not yet; single-use secure delivery with re-randomised options.",
    tier: "grounded",
    literature: [
      "Roth, Bobko & McFarland (2005) - work-sample test validity",
      "ISO 10667 - assessment service delivery",
    ],
    docs: [
      { label: "SME item review", href: "/admin/tech-sandbox/items" },
      { label: "Sandbox tasks", href: "/admin/tech-sandbox/sandbox-blocks" },
    ],
    countKey: "technical_tasks",
    countLabel: "sandbox tasks",
  },
  {
    key: "reflect",
    name: "Reflect 360®",
    href: "/reflect",
    itemTypes:
      "Multi-rater behavioural items on a 5-point frequency scale, decomposed from the client's own values/competencies; rated by Self, Manager, Peer and Direct Report.",
    construct: "Observed leadership behaviours against the client's competency model.",
    validity:
      "Content validity - behaviours derived from the client's own framework; the multi-source design reduces single-rater bias.",
    reliability: "Anonymity threshold (min-n) before group means surface; self-vs-others gap and year-on-year deltas.",
    tier: "grounded",
    literature: [
      "Bracken, Timmreck & Church (2001) - the handbook of multisource feedback",
      "Atwater & Yammarino (1992) - self-other agreement",
    ],
    docs: [{ label: "Reflect 360", href: "/reflect" }],
    countKey: "reflect_behaviors",
    countLabel: "seeded behaviours",
  },
  {
    key: "prehire",
    name: "Pre-Hire® (screening composite)",
    href: "/admin/prehire",
    itemTypes:
      "An orchestration layer - a weighted composite of a competency quiz, the Fluent placement and an AI behavioural interview (CBI). It adds no items of its own.",
    construct: "A defensible screening signal - never an auto-reject; a human always decides.",
    validity:
      "Process / defensibility validity - per-stage cut-scores, adverse-impact (4/5ths) monitoring, and an immutable audit trail. The composite is a signal, not a decision.",
    reliability: "Weighted composite over the instruments above; advisory band only (advance / review / hold, never reject).",
    tier: "grounded",
    literature: [
      "Uniform Guidelines on Employee Selection Procedures (1978) - the 4/5ths rule",
      "Ployhart, Schneider & Schmitt (2006) - staffing organizations",
    ],
    docs: [{ label: "Fairness & audit", href: "/admin/prehire" }],
    countKey: "prehire_stages",
    countLabel: "screening stages",
  },
];
