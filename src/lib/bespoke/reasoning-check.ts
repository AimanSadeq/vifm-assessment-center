// Reasoning (Logica) sitting check, raised after Ali's 13 Oct sitting (18
// questions in 59 seconds): flags a section finished far faster than reading
// and solving the questions allows, so a rushed sitting is spotted before its
// score is used in a report. Screening response times is the usual way to spot
// rapid guessing in timed tests (Wise and Kong, 2005, Applied Measurement in
// Education 18(2), 163-183). Only the whole-section time is stored (session
// start to submission), so the screen uses the average time per question.
// Pure and client-safe.

/** Under this average per question, the section counts as rushed. */
export const RUSHED_SECONDS_PER_QUESTION = 10;

export type ReasoningSitting = {
  /** psy_sessions.created_at: when the section was opened. */
  startedAt: string | null | undefined;
  /** psy_results.created_at: when it was submitted. */
  submittedAt: string | null | undefined;
  answered: unknown;
  total: unknown;
};

export type ReasoningCheck = {
  seconds: number | null;
  answered: number | null;
  total: number | null;
  unanswered: number;
  rushed: boolean;
  /** Full sentence for a report, or null when there is nothing to say. */
  note: string | null;
  /** A few words for a table cell, or null. */
  short: string | null;
};

const count = (v: unknown): number | null => {
  const n = Number(v);
  return v != null && v !== "" && Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
};

/** "under a minute", "1 minute", "12 minutes". */
export function durationText(seconds: number): string {
  if (seconds < 60) return "under a minute";
  const m = Math.round(seconds / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
}

export function reasoningCheck(s: ReasoningSitting): ReasoningCheck {
  const total = count(s.total);
  const answered = count(s.answered);
  const start = s.startedAt ? Date.parse(s.startedAt) : NaN;
  const end = s.submittedAt ? Date.parse(s.submittedAt) : NaN;
  const seconds = Number.isFinite(start) && Number.isFinite(end) && end >= start ? Math.round((end - start) / 1000) : null;
  const unanswered = total != null && answered != null ? Math.max(0, total - answered) : 0;
  const rushed = seconds != null && total != null && total > 0 && seconds / total < RUSHED_SECONDS_PER_QUESTION;
  const blank = unanswered > 0 ? `${unanswered} of ${total} questions unanswered` : null;

  let note: string | null = null;
  let short: string | null = null;
  if (rushed) {
    const each = Math.max(1, Math.round(seconds! / total!));
    note = `Finished in ${durationText(seconds!)} (about ${each} second${each === 1 ? "" : "s"} a question)${blank ? `, with ${blank}` : ""}. The reasoning score may not reflect ability; check with the candidate before using it.`;
    short = `Rushed: ${durationText(seconds!)}`;
  } else if (blank) {
    note = `${blank.charAt(0).toUpperCase()}${blank.slice(1)} (counted as incorrect).`;
    short = `${unanswered} of ${total} blank`;
  }
  return { seconds, answered, total, unanswered, rushed, note, short };
}
