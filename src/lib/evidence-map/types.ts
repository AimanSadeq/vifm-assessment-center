/**
 * Client-safe types + constants for the Evidence & Validity Map.
 * Kept free of any server-only imports (no Supabase client) so the
 * client component can import INSTRUMENTS and the cell/matrix types
 * without dragging the service-role client into the browser bundle.
 */

export type CellStatus = "documented" | "partial" | "missing" | "na";
export type Cell = { status: CellStatus; note?: string; live?: boolean };

export type InstrumentKey =
  | "ac"
  | "arc_org"
  | "arc_ind"
  | "fluent"
  | "technical"
  | "reflect"
  | "psy";

export type InstrumentMeta = { key: InstrumentKey; label: string; href?: string };

export const INSTRUMENTS: readonly InstrumentMeta[] = [
  { key: "ac", label: "Assessment Center", href: "/admin/ac-evidence" },
  { key: "arc_org", label: "ARC - Org", href: "/ara/admin/questions" },
  { key: "arc_ind", label: "ARC - Individual", href: "/ara/admin/questions" },
  { key: "fluent", label: "Fluent (English)", href: "/admin/evidence/fluent" },
  { key: "technical", label: "Technical Cert", href: "/admin/evidence/technical" },
  { key: "reflect", label: "Reflect 360", href: "/admin/evidence/reflect" },
  { key: "psy", label: "Psychometrics", href: "/admin/evidence/psy" },
];

export type MatrixRow = {
  category: string;
  blurb: string;
  cells: Record<InstrumentKey, Cell>;
};

export type EvidenceMetrics = {
  ac: {
    competenciesTotal: number | null;
    competenciesVerified: number | null;
    competenciesProposed: number | null;
    indicators: number | null;
    exercises: number | null;
    ratings: number | null;
  };
  arc: {
    questionsTotal: number | null;
    questionsVerified: number | null;
    questionsProposed: number | null;
    responses: number | null;
    assessments: number | null;
    respondentsCompleted: number | null;
  };
  fluent: { items: number | null; live: number | null; calibrated: number | null; humanRatings: number | null; results: number | null; anchorsVerified: number | null; anchorsProposed: number | null };
  technical: { items: number | null; approved: number | null; calibrated: number | null; cutScores: number | null; results: number | null; anchorsVerified: number | null; anchorsProposed: number | null };
  reflect: { competencies: number | null; behaviors: number | null; behaviorsAi: number | null; responses: number | null; anchorsVerified: number | null; anchorsProposed: number | null };
  psy: { items: number | null; approved: number | null; norms: number | null; itemResponses: number | null; results: number | null; scalesTotal: number | null; anchorsVerified: number | null; anchorsProposed: number | null };
};
