/**
 * Two house rules VIFM has set for every assessment centre (decided 2026-09-28,
 * written into the centre agreement template at clauses 8.1 and 8.4):
 *
 *   - a participant may appeal against a result within APPEAL_WINDOW_DAYS of
 *     receiving it (BPS 5.48, 5.49);
 *   - the joining pack goes out at least PACK_NOTICE_DAYS before the centre
 *     (BPS 5.40, whose note suggests two to three weeks for development centres).
 *
 * Both are defaults the agreement lets a centre change for a stated reason, so
 * the platform never silently enforces a different number: a late appeal is
 * still accepted and shown as late, and a pack published at short notice needs
 * the reason recorded. Every surface reads these constants rather than
 * restating "21".
 */

export const APPEAL_WINDOW_DAYS = 21;
export const PACK_NOTICE_DAYS = 21;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar-day index of a date or timestamp, in UTC, so time of day never moves a deadline. */
function dayIndex(value: string | Date): number | null {
  const d = typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00:00Z` : value) : value;
  const t = d.getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY_MS);
}

/**
 * The last day an appeal counts as in time: APPEAL_WINDOW_DAYS after the
 * result was released to the participant. Null while there is no result, since
 * the window has not started.
 */
export function appealDeadline(resultReleasedAt: string | null | undefined): Date | null {
  if (!resultReleasedAt) return null;
  const start = dayIndex(resultReleasedAt);
  if (start === null) return null;
  return new Date((start + APPEAL_WINDOW_DAYS) * DAY_MS);
}

export type AppealTiming = "before_result" | "in_time" | "late";

/** Whether an appeal raised at `raisedAt` falls inside the window. Late appeals are shown, never refused. */
export function appealTiming(
  raisedAt: string | Date,
  resultReleasedAt: string | null | undefined
): AppealTiming {
  const deadline = appealDeadline(resultReleasedAt);
  if (!deadline) return "before_result";
  const raised = dayIndex(raisedAt);
  const last = dayIndex(deadline);
  if (raised === null || last === null) return "in_time";
  return raised > last ? "late" : "in_time";
}

/**
 * Whole days between `at` and the first day of the centre. Negative once the
 * centre has started; null when the centre has no start date to measure from.
 */
export function packNoticeDays(startDate: string | null | undefined, at: string | Date): number | null {
  if (!startDate) return null;
  const start = dayIndex(startDate);
  const from = dayIndex(at);
  if (start === null || from === null) return null;
  return start - from;
}

/** True when publishing at `at` gives less notice than the house rule. */
export function packNoticeShort(startDate: string | null | undefined, at: string | Date): boolean {
  const days = packNoticeDays(startDate, at);
  return days !== null && days < PACK_NOTICE_DAYS;
}

/** The shortest reason accepted for publishing at short notice. */
export const PACK_LATE_REASON_MIN = 10;
