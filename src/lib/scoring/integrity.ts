/**
 * Advisory integrity signal for a Fluent placement run.
 *
 * Fluent is an INDICATIVE placement, never a high-stakes pass/fail. This signal
 * is ADVISORY telemetry only - it is surfaced to admins and on the candidate's
 * own results screen for context, but it NEVER auto-fails a test, caps a score,
 * or blocks a result. Call it an "integrity signal (advisory)" everywhere; never
 * a "trust score" and never a pass/fail.
 *
 * Pure functions only (mirrors src/lib/scoring/reliability.ts): no IO, no
 * randomness, fully unit-checkable. All weights are tunable constants here.
 *
 * Privacy (PDPL-safe): the input carries only COUNTS, DURATIONS and the
 * LENGTH of any pasted text - never the pasted content itself.
 *
 * Back-compatibility: old rows (migration 00043 jsonb) may carry only
 * { blurCount, pasteCount }. Every newer field is optional and read with a
 * safe default, so a legacy row scores cleanly without throwing.
 */

/** A single captured proctoring event, time-stamped from the test start. */
export type IntegrityEvent =
  | { kind: "blur"; at: number; awayMs?: number }
  | { kind: "paste"; at: number; pasteChars?: number };

/**
 * The advisory integrity telemetry persisted on a Fluent result
 * (eng_fluent_results.integrity_flags) or a Pre-Hire stage result (flags).
 *
 * blurCount + pasteCount are kept for back-compat with rows written before this
 * ticket; awayMs / pasteChars / events are the widened capture and are all
 * optional so old rows stay valid.
 */
export type IntegrityFlags = {
  /** Number of times the page was hidden or the window lost focus. */
  blurCount?: number;
  /** Number of paste events into a monitored field. */
  pasteCount?: number;
  /** Total time (ms) the test was hidden or unfocused, debounced. */
  awayMs?: number;
  /** Total length (chars) of all pasted text - never the text itself. */
  pasteChars?: number;
  /** Ordered, time-stamped event log (kind + meta). */
  events?: IntegrityEvent[];
  /**
   * Server-detected: the request IP at scoring differed from the IP at test
   * start (possible hand-off, VPN switch, or location change). Authoritative -
   * set server-side, never trusted from the client. Advisory only.
   */
  ipChanged?: boolean;
  /**
   * Advisory stylometric estimate (0-100) that a free-text writing response was
   * produced with a generative-AI tool (set server-side from the AI examiner's
   * scoring pass, never trusted from the client). AI-text detection is
   * inherently unreliable: this contributes to the advisory composite only
   * above a conservative floor, is strongest read alongside pasteChars, and
   * never auto-fails anything.
   */
  aiLikelihood?: number;
  /**
   * Server-detected: camera proctoring was REQUIRED for this administration
   * (voucher flag or org policy) but no proctoring session was recorded - the
   * browser-side consent gate was skipped, blocked, or stripped. Advisory only.
   */
  proctorMissing?: boolean;
};

export type IntegrityTier = "clean" | "minor" | "elevated";

export type IntegritySignal = {
  /**
   * 0-100 advisory composite. Higher = more activity worth a human glance.
   * This is NOT a trust score and NOT a pass/fail - it is a prompt to review,
   * never an automatic action.
   */
  score: number;
  tier: IntegrityTier;
  /** Short, human-readable reasons behind the score (advisory framing). */
  reasons: string[];
};

// ── Tunable weights ────────────────────────────────────────────────
// Each contributor saturates so a single very noisy dimension cannot, on its
// own, dominate the whole 0-100 scale - the composite reads as "how much is
// worth a glance", not "how guilty".

/** Points per tab-hide / focus-loss event, capped at MAX_BLUR_POINTS. */
const BLUR_POINTS_PER_EVENT = 8;
const MAX_BLUR_POINTS = 40;

/** Away-duration contribution: ramps to MAX_AWAY_POINTS at AWAY_MS_FOR_MAX. */
const MAX_AWAY_POINTS = 30;
const AWAY_MS_FOR_MAX = 120_000; // 2 minutes away reads as the full away weight

/** Pasted-characters contribution: ramps to MAX_PASTE_POINTS at PASTE_CHARS_FOR_MAX. */
const MAX_PASTE_POINTS = 40;
const PASTE_CHARS_FOR_MAX = 600; // ~a long paragraph pasted in reads as the full paste weight

/** A mid-test IP change (server-detected) is a meaningful integrity signal -
 *  enough to clear the "minor" bar on its own and to read as elevated alongside
 *  other activity. Advisory only (a legitimate network switch also changes IP). */
const IP_CHANGE_POINTS = 30;

/** AI-likeness contribution: nothing below the floor (detectors are unreliable
 *  and competent human writing must not accrue points), then a linear ramp to
 *  MAX_AI_POINTS at likelihood 100. At the floor+paste combination the composite
 *  reads elevated - which is exactly the "worth a human glance" case. */
const AI_LIKELIHOOD_FLOOR = 60;
const MAX_AI_POINTS = 25;

/** Required proctoring with no recorded session clears the "minor" bar on its
 *  own - a camera can legitimately fail, so it prompts review, never a fail. */
const PROCTOR_MISSING_POINTS = 30;

/** Tier cut-offs on the 0-100 composite. */
const MINOR_AT = 15;
const ELEVATED_AT = 45;

const clampNonNeg = (n: number | undefined): number =>
  typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0;

/**
 * Compute the advisory integrity signal from captured (PDPL-safe) flags.
 *
 * Tolerant of legacy rows: when awayMs / pasteChars are absent it derives a
 * conservative estimate from the events array where present, otherwise it
 * scores only on the counts that the old proctor captured.
 */
export function computeIntegritySignal(flags: IntegrityFlags | null | undefined): IntegritySignal {
  const f = flags ?? {};
  const events = Array.isArray(f.events) ? f.events : [];

  const blurCount = clampNonNeg(f.blurCount) || events.filter((e) => e.kind === "blur").length;
  const pasteCount = clampNonNeg(f.pasteCount) || events.filter((e) => e.kind === "paste").length;

  // Prefer the explicit totals; fall back to summing the event log for old/new
  // rows that carry events but not the aggregate (and vice-versa).
  const awayMs =
    clampNonNeg(f.awayMs) ||
    events.reduce((sum, e) => sum + (e.kind === "blur" ? clampNonNeg(e.awayMs) : 0), 0);
  const pasteChars =
    clampNonNeg(f.pasteChars) ||
    events.reduce((sum, e) => sum + (e.kind === "paste" ? clampNonNeg(e.pasteChars) : 0), 0);

  const blurPoints = Math.min(MAX_BLUR_POINTS, blurCount * BLUR_POINTS_PER_EVENT);
  const awayPoints = awayMs > 0 ? Math.min(MAX_AWAY_POINTS, (awayMs / AWAY_MS_FOR_MAX) * MAX_AWAY_POINTS) : 0;
  const pastePoints =
    pasteChars > 0
      ? Math.min(MAX_PASTE_POINTS, (pasteChars / PASTE_CHARS_FOR_MAX) * MAX_PASTE_POINTS)
      : pasteCount > 0
        ? // Legacy rows have no char length; a bare paste event still earns a
          // small, capped nudge so it is not invisible.
          Math.min(MAX_PASTE_POINTS, pasteCount * 6)
        : 0;

  const ipPoints = f.ipChanged ? IP_CHANGE_POINTS : 0;
  const aiLikelihood =
    typeof f.aiLikelihood === "number" && Number.isFinite(f.aiLikelihood)
      ? Math.min(100, Math.max(0, Math.round(f.aiLikelihood)))
      : null;
  const aiPoints =
    aiLikelihood !== null && aiLikelihood >= AI_LIKELIHOOD_FLOOR
      ? ((aiLikelihood - AI_LIKELIHOOD_FLOOR) / (100 - AI_LIKELIHOOD_FLOOR)) * MAX_AI_POINTS
      : 0;
  const proctorPoints = f.proctorMissing ? PROCTOR_MISSING_POINTS : 0;
  const score = Math.min(
    100,
    Math.round(blurPoints + awayPoints + pastePoints + ipPoints + aiPoints + proctorPoints)
  );

  const reasons: string[] = [];
  if (f.proctorMissing) {
    reasons.push("Camera proctoring was required but no proctoring session was recorded");
  }
  if (f.ipChanged) {
    reasons.push("IP address changed during the test");
  }
  if (aiLikelihood !== null && aiLikelihood >= AI_LIKELIHOOD_FLOOR) {
    reasons.push(
      `Writing style reads as possibly AI-assisted (advisory estimate ${aiLikelihood}/100 - stylometric, not proof)`
    );
  }
  if (blurCount > 0) {
    reasons.push(blurCount === 1 ? "Left the test once" : `Left the test ${blurCount} times`);
  }
  if (awayMs >= 5_000) {
    reasons.push(`About ${Math.round(awayMs / 1000)}s away from the test`);
  }
  if (pasteChars > 0) {
    reasons.push(`Pasted about ${pasteChars} characters`);
  } else if (pasteCount > 0) {
    reasons.push(pasteCount === 1 ? "Pasted text once" : `Pasted text ${pasteCount} times`);
  }
  if (reasons.length === 0) reasons.push("No unusual activity recorded");

  const tier: IntegrityTier = score >= ELEVATED_AT ? "elevated" : score >= MINOR_AT ? "minor" : "clean";

  return { score, tier, reasons };
}
