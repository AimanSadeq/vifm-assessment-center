// Bundle progress: the parts safe for client components (labels, types, the
// follow-up rule and the reminder text). The loader lives in ./progress.

import type { ReasoningCheck } from "./reasoning-check";

export type PersonStatus = "not_started" | "signed_in" | "in_progress" | "completed" | "scored";

export const PERSON_STATUS_LABEL: Record<PersonStatus, string> = {
  not_started: "Not started",
  signed_in: "Signed in",
  in_progress: "In progress",
  completed: "Completed",
  scored: "Scored",
};

export type SectionState = "not_started" | "in_progress" | "done";

export type FollowUpReason = "not_started" | "no_progress" | "deadline_near";

export const FOLLOW_UP_LABEL: Record<FollowUpReason, string> = {
  not_started: "Has not started",
  no_progress: "No progress recently",
  deadline_near: "Deadline is near",
};

export type PersonProgress = {
  key: string;
  rosterId: string | null;
  candidateId: string | null;
  name: string;
  email: string;
  grade: number | null;
  position: string | null;
  businessUnit: string | null;
  employeeId: string | null;
  isTester: boolean;
  onRoster: boolean;
  status: PersonStatus;
  /** First sign-in (candidate row created). */
  startedAt: string | null;
  consentAt: string | null;
  completedAt: string | null;
  scoredAt: string | null;
  lastActivityAt: string | null;
  sjt: { state: SectionState; answered: number; total: number } | null;
  logica: SectionState | null;
  /** Time taken and unanswered questions once the reasoning section is submitted. */
  reasoningCheck: ReasoningCheck | null;
  persona: SectionState | null;
  contacts: number;
  lastContactAt: string | null;
  followUp: FollowUpReason | null;
};

const DAY = 86_400_000;

export const latestIso = (...isos: Array<string | null | undefined>): string | null => {
  let best: string | null = null;
  for (const v of isos) if (v && (!best || v > best)) best = v;
  return best;
};

/** Whole days between an ISO time and now (floor, never negative). */
export function daysSince(iso: string | null, now: number = Date.now()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / DAY));
}

/**
 * Who needs chasing. Nobody while the assessment is on hold, and never a
 * tester or someone who has finished. Not started: the link has been open for
 * the threshold. Started: nothing new for the threshold. Anyone unfinished
 * within two days of the complete-by date is flagged too.
 */
export function followUpReason(
  p: { status: PersonStatus; isTester: boolean; lastActivityAt: string | null; lastContactAt: string | null },
  ctx: { held: boolean; openSince: string | null; followupDays: number; completeBy: string | null },
  now: number = Date.now(),
): FollowUpReason | null {
  if (ctx.held || p.isTester) return null;
  if (p.status === "completed" || p.status === "scored") return null;
  const threshold = ctx.followupDays * DAY;
  // A chase resets the clock: someone contacted yesterday is not due again yet.
  const contactedRecently = !!p.lastContactAt && now - new Date(p.lastContactAt).getTime() < threshold;
  if (ctx.completeBy) {
    const left = new Date(ctx.completeBy).getTime() - now;
    if (left >= 0 && left <= 2 * DAY && !contactedRecently) return "deadline_near";
  }
  if (contactedRecently) return null;
  if (p.status === "not_started") {
    if (!ctx.openSince) return null;
    return now - new Date(ctx.openSince).getTime() >= threshold ? "not_started" : null;
  }
  const last = p.lastActivityAt ? new Date(p.lastActivityAt).getTime() : null;
  return last != null && now - last >= threshold ? "no_progress" : null;
}

/** Plain-text reminder a VIFM or client contact can paste into an email or
 *  WhatsApp message. The link is the shared link: the person signs in with
 *  their work email and resumes where they stopped. */
/** First word of a full name ("Sarah" from "Sarah Abdullah Alfakeeh"). */
export function firstWord(fullName: string): string {
  return (fullName || "").trim().split(/\s+/).filter(Boolean)[0] ?? "";
}

export function reminderMessage(opts: {
  firstName: string;
  assessmentName: string;
  link: string;
  completeBy: string | null;
  started: boolean;
}): string {
  const by = opts.completeBy ? ` by ${opts.completeBy}` : "";
  const lines = [
    `Dear ${opts.firstName || "colleague"},`,
    "",
    opts.started
      ? `This is a friendly reminder to complete the ${opts.assessmentName}${by}. Your answers so far are saved, so you will continue where you stopped.`
      : `This is a friendly reminder to complete the ${opts.assessmentName}${by}.`,
    "",
    `Open this link and sign in with your work email: ${opts.link}`,
    "",
    "If you have any difficulty signing in, reply to this message and we will help.",
    "",
    "Thank you.",
  ];
  return lines.join("\n");
}

/** Which sections a bundle's sittings contain. */
export function bundleStageFlags(serviceKeys: string[], settings: { sjtEnabled: boolean }): { sjt: boolean; logica: boolean; persona: boolean } {
  return { sjt: settings.sjtEnabled, logica: serviceKeys.includes("logica"), persona: serviceKeys.includes("persona") };
}

/** "13 Oct 2026, 15:27" in KSA time, for tables and exports. */
export function fmtKsa(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" });
}

export const SECTION_LABEL: Record<SectionState, string> = { not_started: "Not started", in_progress: "In progress", done: "Done" };
