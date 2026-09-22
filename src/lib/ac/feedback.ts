/**
 * Who has been told their results, and who is still waiting.
 *
 * BPS 8.14 makes feedback mandatory for a development centre and 8.15 expects
 * it for a selection one; 8.16 says soon after the centre; 8.21 says an oral
 * session needs a written record; 8.22 says a development centre's feedback
 * should include an oral element.
 *
 * The distinction this module exists to make: releasing a report is not giving
 * feedback. The platform tracked the first and called it the second. A
 * participant who received a PDF and no conversation has had a document, not
 * feedback, and for a development centre that is a clause unmet.
 */

export type FeedbackRecord = {
  candidateId: string;
  form: "written_report" | "oral" | "both";
  deliveredAt: string;
  deliveredByName: string;
  delivererTrained: boolean;
  hasSummary: boolean;
  acknowledgedAt?: string | null;
};

export type FeedbackParticipant = {
  candidateId: string;
  name: string;
  /** Whether the centre has produced a finalised result for them. */
  rated: boolean;
};

export type FeedbackReview = {
  /** Feedback is owed to these participants and has not been recorded. */
  owed: { candidateId: string; name: string }[];
  /** Given, but longer after the centre than the standard expects. */
  late: { candidateId: string; name: string; days: number }[];
  /** Oral sessions with no written record of what was discussed (8.21). */
  withoutWrittenRecord: { candidateId: string; name: string }[];
  /** Development centres owe an oral element (8.22). */
  withoutOralElement: { candidateId: string; name: string }[];
  /** Given by someone not recorded as feedback-trained (8.17). */
  byUntrained: { candidateId: string; name: string; by: string }[];
  /** Mandatory for development and succession centres (8.14). */
  mandatory: boolean;
  problems: string[];
};

/**
 * "As soon as possible" (8.16) has no number in the standard. Two weeks after
 * the centre closes is the working threshold here, and it is named as practice
 * wherever it is shown - long enough for a real scheduling delay, short enough
 * that a forgotten participant surfaces while it can still be fixed.
 */
export const FEEDBACK_PROMPT_DAYS = 14;

const daysBetween = (from: string, to: string): number =>
  Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000);

export function reviewFeedback(input: {
  purpose?: string | null;
  centreEndDate?: string | null;
  participants: FeedbackParticipant[];
  records: FeedbackRecord[];
  now?: string;
}): FeedbackReview {
  // 8.14 makes it mandatory for development; succession centres are treated the
  // same, because a person told they are not ready for a role and given no
  // explanation has been assessed at, not assessed.
  const mandatory = input.purpose === "development" || input.purpose === "succession";
  const latest = new Map<string, FeedbackRecord>();
  for (const r of input.records) {
    const prev = latest.get(r.candidateId);
    if (!prev || new Date(r.deliveredAt) > new Date(prev.deliveredAt)) latest.set(r.candidateId, r);
  }

  const owed: FeedbackReview["owed"] = [];
  const late: FeedbackReview["late"] = [];
  const withoutWrittenRecord: FeedbackReview["withoutWrittenRecord"] = [];
  const withoutOralElement: FeedbackReview["withoutOralElement"] = [];
  const byUntrained: FeedbackReview["byUntrained"] = [];

  for (const p of input.participants) {
    const rec = latest.get(p.candidateId);
    if (!rec) {
      // Only owed once the centre has something to tell them.
      if (p.rated) owed.push({ candidateId: p.candidateId, name: p.name });
      continue;
    }
    if (input.centreEndDate) {
      const days = daysBetween(input.centreEndDate, rec.deliveredAt);
      if (days > FEEDBACK_PROMPT_DAYS) late.push({ candidateId: p.candidateId, name: p.name, days });
    }
    if ((rec.form === "oral" || rec.form === "both") && !rec.hasSummary) {
      withoutWrittenRecord.push({ candidateId: p.candidateId, name: p.name });
    }
    if (mandatory && rec.form === "written_report") {
      withoutOralElement.push({ candidateId: p.candidateId, name: p.name });
    }
    if (!rec.delivererTrained) {
      byUntrained.push({ candidateId: p.candidateId, name: p.name, by: rec.deliveredByName });
    }
  }

  const problems: string[] = [];
  if (owed.length > 0) {
    problems.push(
      mandatory
        ? `${owed.map((o) => o.name).join(", ")} ${owed.length === 1 ? "has" : "have"} a finalised result and no feedback recorded. A development centre must give feedback (8.14).`
        : `${owed.map((o) => o.name).join(", ")} ${owed.length === 1 ? "has" : "have"} a finalised result and no feedback recorded (8.15).`
    );
  }
  for (const l of late) {
    problems.push(
      `${l.name} was given feedback ${l.days} days after the centre closed. The standard asks for it as soon as possible (8.16); ${FEEDBACK_PROMPT_DAYS} days is the working threshold here, not a clause value.`
    );
  }
  if (withoutWrittenRecord.length > 0) {
    problems.push(
      `${withoutWrittenRecord.map((x) => x.name).join(", ")} had an oral session with no written record of what was discussed (8.21). A conversation nobody wrote down is one they cannot refer back to.`
    );
  }
  if (withoutOralElement.length > 0) {
    problems.push(
      `${withoutOralElement.map((x) => x.name).join(", ")} received a written report only. A development centre's feedback should include a conversation, so the findings can be worked through (8.22).`
    );
  }
  if (byUntrained.length > 0) {
    problems.push(
      `Feedback was given by someone not recorded as feedback-trained: ${Array.from(new Set(byUntrained.map((x) => x.by))).join(", ")} (8.17, 8.18). Record their competence, or have someone trained repeat it.`
    );
  }

  return { owed, late, withoutWrittenRecord, withoutOralElement, byUntrained, mandatory, problems };
}
