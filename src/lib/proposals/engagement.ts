// Engagement (professional-services) pricing for proposals - the bespoke, high-touch
// model, primarily the Assessment Center, whose cost is dominated by consultant time
// rather than per-seat platform usage. A flexible line-item quote: each line has a
// basis (fixed / per participant / per assessor-day / per feedback session), a
// quantity and a unit rate. Pure maths, no I/O - safe on client + server. Lines are
// denormalised (label + basis snapshot) so an issued proposal never retro-changes.

export type EngagementBasis = "fixed" | "per_participant" | "per_day" | "per_session";

// Where candidate + assessment data is stored/processed for this engagement.
// KSA / UAE = in-country (sovereign) data residency; VIFM = VIFM-managed cloud.
export type DataResidency = "ksa" | "uae" | "vifm";

export interface EngagementLineInput {
  label?: string;
  basis?: EngagementBasis;
  quantity?: number;
  unitRate?: number;
}
export interface EngagementModelInput {
  name?: string;
  lines?: EngagementLineInput[];
  participants?: number;
  discountPct?: number;
}

export interface NormalizedEngagementLine {
  label: string;
  basis: EngagementBasis;
  quantity: number;
  unitRate: number;
}
export interface NormalizedEngagementModel {
  name: string;
  lines: NormalizedEngagementLine[];
  participants: number;
  discountPct: number;
}

const BASES: EngagementBasis[] = ["fixed", "per_participant", "per_day", "per_session"];
const RESIDENCIES: DataResidency[] = ["ksa", "uae", "vifm"];

/** Short display label for the data-residency choice (EN). */
export const DATA_RESIDENCY_LABEL: Record<DataResidency, string> = {
  ksa: "Saudi Arabia (KSA)",
  uae: "United Arab Emirates (UAE)",
  vifm: "VIFM-managed cloud",
};

/** Validate an arbitrary value into a DataResidency, defaulting to VIFM-managed. */
export function resolveDataResidency(v: unknown): DataResidency {
  return RESIDENCIES.includes(v as DataResidency) ? (v as DataResidency) : "vifm";
}

/** Full data-residency commitment sentence for the proposal body (EN). */
export function dataResidencyStatement(r: DataResidency): string {
  switch (r) {
    case "ksa":
      return "All candidate and assessment data is stored and processed within the Kingdom of Saudi Arabia, meeting in-country (sovereign) data-residency requirements.";
    case "uae":
      return "All candidate and assessment data is stored and processed within the United Arab Emirates, meeting in-country (sovereign) data-residency requirements.";
    default:
      return "All candidate and assessment data is hosted on VIFM's managed cloud platform, with in-country (KSA or UAE) data residency available on request.";
  }
}
const num = (v: unknown, f = 0) => { const n = Number(v); return Number.isFinite(n) ? n : f; };
const clampPct = (v: unknown) => Math.min(100, Math.max(0, num(v)));
const str = (v: unknown, max = 160) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Human label for each basis (EN). */
export const ENGAGEMENT_BASIS_LABEL: Record<EngagementBasis, string> = {
  fixed: "Fixed",
  per_participant: "Per participant",
  per_day: "Per consultant-day",
  per_session: "Per feedback session",
};

/** Round to 2dp to avoid float noise in stored line totals. */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Normalise submitted input -> clean model, or null when nothing is priced. Never throws. */
export function normalizeEngagementModel(value: unknown): NormalizedEngagementModel | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as EngagementModelInput;
  const lines = (Array.isArray(v.lines) ? v.lines : [])
    .map((l) => {
      const basis: EngagementBasis = BASES.includes(l?.basis as EngagementBasis) ? (l!.basis as EngagementBasis) : "fixed";
      return {
        label: str(l?.label, 160),
        basis,
        quantity: basis === "fixed" ? 1 : Math.max(0, num(l?.quantity)),
        unitRate: Math.max(0, num(l?.unitRate)),
      };
    })
    // Keep a line only if it has a label and a positive amount.
    .filter((l) => l.label && l.unitRate > 0 && (l.basis === "fixed" || l.quantity > 0));
  if (lines.length === 0) return null;
  return {
    name: str(v.name, 120) || "Assessment Center engagement",
    lines,
    participants: Math.max(0, Math.round(num(v.participants))),
    discountPct: clampPct(v.discountPct),
  };
}

/** Compute the line totals + subtotal / discount / total. Returns null for an empty model. */
export function computeEngagement(model: NormalizedEngagementModel | null) {
  if (!model || model.lines.length === 0) return null;
  const lines = model.lines.map((l) => ({
    ...l,
    lineTotal: round2(l.basis === "fixed" ? l.unitRate : l.quantity * l.unitRate),
  }));
  const subtotal = round2(lines.reduce((s, l) => s + l.lineTotal, 0));
  const discountPct = clampPct(model.discountPct);
  const discountAmount = round2(subtotal * (discountPct / 100));
  const total = round2(subtotal - discountAmount);
  return {
    name: model.name,
    lines,
    participants: model.participants,
    subtotal,
    discountPct,
    hasDiscount: discountAmount > 0,
    discountAmount,
    total,
  };
}

/** Assessment Center starter template. Rates are editable placeholders (benchmark
 *  anchors), quantities scale off the participant count. Assessor-days ~ 1 day per
 *  2 delegates (rounded up), feedback = one session per delegate. */
export function acEngagementTemplate(participants: number): EngagementModelInput {
  const p = Math.max(1, Math.round(participants) || 8);
  const assessorDays = Math.max(1, Math.ceil(p / 2)) + 1; // observation days + one wash-up/integration day
  return {
    name: "Assessment Center",
    participants: p,
    discountPct: 0,
    lines: [
      { label: "Assessment Center design & setup", basis: "fixed", quantity: 1, unitRate: 6000 },
      { label: "Per-participant assessment (materials, platform, exercises)", basis: "per_participant", quantity: p, unitRate: 600 },
      { label: "Assessor days (observation + wash-up / integration)", basis: "per_day", quantity: assessorDays, unitRate: 1500 },
      { label: "1:1 developmental feedback sessions", basis: "per_session", quantity: p, unitRate: 350 },
      { label: "Cohort integration & read-out report", basis: "fixed", quantity: 1, unitRate: 2500 },
    ],
  };
}
