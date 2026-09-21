/**
 * The participant's joining pack.
 *
 * BPS 5.38 requires the pack; 5.39 and 5.41 say what has to be in it. Most of
 * it is already known - the purpose, the dates, the exercises and how long each
 * one runs - so the pack is generated from the design and the engagement only
 * stores what the design cannot know. That matters beyond tidiness: a pack
 * typed out by hand drifts from the centre it describes, and a participant who
 * was told the wrong thing consented to the wrong thing.
 *
 * `missing` is the list of clause items that still have no answer. It drives
 * the admin checklist and the refusal to publish, because a pack that omits how
 * long results are kept is not a pack, it is a letter.
 */

import { acPurposeLabel } from "@/lib/constants/ac-purpose";

export type PackEngagement = {
  id: string;
  name: string;
  target_role?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  purpose?: string | null;
  pack_purpose_statement?: string | null;
  pack_location?: string | null;
  pack_preparation?: string | null;
  pack_results_use?: string | null;
  pack_decisions?: string | null;
  pack_decision_timing?: string | null;
  pack_report_recipients?: string | null;
  pack_feedback_offer?: string | null;
  pack_feedback_when?: string | null;
  retention_months?: number | null;
  research_use?: boolean | null;
  pack_adjustments_note?: string | null;
  pack_published_at?: string | null;
  participant_contact_name?: string | null;
  participant_contact_email?: string | null;
  organizations?: { name?: string | null } | { name?: string | null }[] | null;
};

export type PackExercise = {
  name?: string | null;
  exercise_type?: string | null;
  duration_minutes?: number | null;
};

export type PackSection = { heading: string; body: string; clause: string };

export type JoiningPack = {
  title: string;
  organisationName: string | null;
  published: boolean;
  sections: PackSection[];
  /** Clause items with nothing to say yet, in the words of the checklist. */
  missing: { field: string; label: string; clause: string }[];
};

const FEEDBACK_TEXT: Record<string, string> = {
  written_report: "You will receive a written report on your results.",
  verbal_debrief: "You will be offered a conversation with an assessor to talk through your results.",
  both: "You will receive a written report and be offered a conversation with an assessor to talk it through.",
  none: "No individual feedback is offered for this centre.",
};

const orgName = (e: PackEngagement): string | null => {
  const o = e.organizations;
  const row = Array.isArray(o) ? o[0] : o;
  return (row?.name as string | undefined) ?? null;
};

const dateRange = (e: PackEngagement): string | null => {
  if (!e.start_date && !e.end_date) return null;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  if (e.start_date && e.end_date && e.start_date !== e.end_date) {
    return `${fmt(e.start_date)} to ${fmt(e.end_date)}`;
  }
  return fmt((e.start_date ?? e.end_date) as string);
};

/** What the participant will actually do, from the exercises in the design (5.41.2). */
export function describeExercises(exercises: PackExercise[]): string | null {
  if (exercises.length === 0) return null;
  const lines = exercises.map((x) => {
    const mins = x.duration_minutes ? ` - about ${x.duration_minutes} minutes` : "";
    return `${x.name ?? "Exercise"}${mins}`;
  });
  const total = exercises.reduce((sum, x) => sum + (x.duration_minutes ?? 0), 0);
  const totalLine = total > 0 ? `\n\nAltogether the assessed activities take about ${Math.round(total / 60 * 10) / 10} hours, not counting breaks and briefings.` : "";
  return `You will take part in ${exercises.length} ${exercises.length === 1 ? "activity" : "activities"}:\n\n${lines.map((l) => `- ${l}`).join("\n")}${totalLine}\n\nYou will be told at the start of each activity when you are being assessed and when you are not. Breaks, briefings and social conversation are not assessed.`;
}

export function buildJoiningPack(engagement: PackEngagement, exercises: PackExercise[]): JoiningPack {
  const missing: JoiningPack["missing"] = [];
  const sections: PackSection[] = [];
  const add = (heading: string, body: string | null | undefined, clause: string, field: string, label: string) => {
    if (body && body.trim()) {
      sections.push({ heading, body: body.trim(), clause });
    } else {
      missing.push({ field, label, clause });
    }
  };

  const purposeWords = engagement.purpose ? acPurposeLabel(engagement.purpose) : null;
  const purposeIntro = purposeWords
    ? `This is a ${purposeWords.toLowerCase()} centre.`
    : null;
  add(
    "What this assessment is for",
    [purposeIntro, engagement.pack_purpose_statement].filter(Boolean).join(" "),
    "5.41.1",
    "pack_purpose_statement",
    "What this centre is for, in words a participant reads"
  );

  const when = dateRange(engagement);
  add(
    "When and where",
    [when ? `The centre runs on ${when}.` : null, engagement.pack_location].filter(Boolean).join(" "),
    "5.39",
    "pack_location",
    "Where the centre takes place"
  );

  add("What you will be asked to do", describeExercises(exercises), "5.41.2", "exercises", "Exercises on the engagement");
  add("How to prepare", engagement.pack_preparation, "5.41.3", "pack_preparation", "How to prepare, and any practice materials");
  add("How your results will be used", engagement.pack_results_use, "5.41.4", "pack_results_use", "How the results will be used");

  add(
    "What happens next",
    [engagement.pack_decisions, engagement.pack_decision_timing].filter(Boolean).join(" "),
    "5.41.5 / 5.12",
    "pack_decisions",
    "What decisions follow, and when you will hear"
  );

  add(
    "Who will see your results",
    engagement.pack_report_recipients
      ? `${engagement.pack_report_recipients}\n\nAnyone not named here needs your express permission before they are given your report.`
      : null,
    "5.13",
    "pack_report_recipients",
    "Who receives reports from this centre"
  );

  add(
    "Feedback",
    engagement.pack_feedback_offer
      ? [FEEDBACK_TEXT[engagement.pack_feedback_offer], engagement.pack_feedback_when].filter(Boolean).join(" ")
      : null,
    "5.11",
    "pack_feedback_offer",
    "Whether and how feedback is given"
  );

  const months = engagement.retention_months ?? 24;
  sections.push({
    heading: "How long your results are kept",
    clause: "5.41.6 / 5.41.7",
    body:
      `Your results are held for ${months} months from the assessment date and then deleted.\n\n` +
      (engagement.research_use
        ? "With your separate agreement, anonymised results may also be used to check that the assessment works as it should. You can take part without agreeing to this."
        : "Your results are not used for research or validation studies."),
  });

  add(
    "If you need an adjustment",
    engagement.pack_adjustments_note,
    "5.41.8 / 5.45",
    "pack_adjustments_note",
    "How to request a reasonable adjustment"
  );

  const contact = engagement.participant_contact_name || engagement.participant_contact_email;
  sections.push({
    heading: "Your rights, and who to ask",
    clause: "4.47 / 5.1 / 5.43",
    body:
      "You are entitled to be assessed fairly and consistently, to know what is being assessed and why, to ask questions " +
      "at any point, and to challenge a result you believe is wrong. Raising a question or a concern does not affect your results.\n\n" +
      (contact
        ? `Questions about this centre go to ${engagement.participant_contact_name ?? "your assessment contact"}` +
          (engagement.participant_contact_email ? ` (${engagement.participant_contact_email})` : "") +
          "."
        : "A named contact for this centre has not been set yet."),
  });
  if (!contact) {
    missing.push({ field: "participant_contact_name", label: "A named contact for participants", clause: "5.43" });
  }

  return {
    title: engagement.name,
    organisationName: orgName(engagement),
    published: Boolean(engagement.pack_published_at),
    sections,
    missing,
  };
}
