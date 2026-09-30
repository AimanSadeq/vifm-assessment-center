"use server";

/**
 * Validity evidence actions (BPS 3.20, 9.6-9.10): the evaluation plan agreed
 * with the client, the outcome follow-ups that make a validation study
 * possible, and the evaluation record. Admin only; service client after the
 * role check, like the rest of the engagement actions.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { followupDueDates } from "@/lib/ac/validity";

async function admin(): Promise<{ uid: string | null } | { error: string }> {
  try {
    const caller = await requireRole(["admin"]);
    return { uid: caller.isDev ? null : caller.uid };
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}

const text = (v?: string | null) => (v ?? "").trim() || null;

/** What was agreed with the client for after the centre (3.20). */
export async function saveEvaluationPlanAction(values: {
  engagementId: string;
  validation: boolean;
  reaction: boolean;
  utility: boolean;
  trigger: "participants" | "date";
  triggerParticipants?: number | null;
  triggerDate?: string | null;
  criterion?: string;
  note?: string;
}) {
  const who = await admin();
  if ("error" in who) return who;
  const byCount = values.trigger !== "date";
  const plan = {
    validation: Boolean(values.validation),
    reaction: Boolean(values.reaction),
    utility: Boolean(values.utility),
    trigger: byCount ? "participants" : "date",
    trigger_participants: byCount ? Math.max(1, Math.round(Number(values.triggerParticipants) || 0)) || null : null,
    trigger_date: byCount ? null : values.triggerDate || null,
    criterion: text(values.criterion),
    note: text(values.note),
  };
  const sb = createServiceClient();
  const { error } = await sb.from("engagements").update({ evaluation_plan: plan }).eq("id", values.engagementId);
  if (error) {
    if (/evaluation_plan/.test(error.message)) return { error: "Apply migration 00230 first." };
    return { error: error.message };
  }
  return { ok: true };
}

/**
 * Create the 6- and 12-month follow-up rows for every participant who has a
 * finalised overall rating. Idempotent: rows that already exist are kept, so
 * this can be run again after late ratings.
 */
export async function scheduleFollowupsAction(engagementId: string) {
  const who = await admin();
  if ("error" in who) return who;
  const sb = createServiceClient();
  const { data: eng } = await sb.from("engagements").select("end_date, start_date").eq("id", engagementId).maybeSingle();
  if (!eng) return { error: "Engagement not found." };
  const endDate = (eng.end_date as string | null) ?? (eng.start_date as string | null);
  if (!endDate) return { error: "Set the centre's dates first: follow-ups are counted from the last day of the centre." };

  const { data: oars } = await sb.from("overall_assessment_ratings").select("candidate_id").eq("engagement_id", engagementId);
  const rated = Array.from(new Set(((oars ?? []) as { candidate_id: string }[]).map((o) => o.candidate_id)));
  if (rated.length === 0) return { error: "Nobody has a finalised overall rating yet, so there is nothing to follow up." };

  const rows = rated.flatMap((candidateId) =>
    followupDueDates(endDate).map((d) => ({ engagement_id: engagementId, candidate_id: candidateId, wave: d.wave, due_on: d.dueOn }))
  );
  const { error } = await sb.from("ac_outcome_followups").upsert(rows, { onConflict: "candidate_id,wave", ignoreDuplicates: true });
  if (error) {
    if (/ac_outcome_followups/.test(error.message)) return { error: "Apply migration 00230 first." };
    return { error: error.message };
  }
  return { ok: true, scheduled: rows.length };
}

/** Record what the client reported for one follow-up. */
export async function recordFollowupAction(values: {
  followupId: string;
  status: "collected" | "not_available";
  inRole?: boolean | null;
  performanceRating?: number | null;
  ratingBasis?: string;
  raterName?: string;
  raterRole?: string;
  note?: string;
}) {
  const who = await admin();
  if ("error" in who) return who;
  const rating = values.performanceRating == null || values.performanceRating === 0 ? null : Math.round(Number(values.performanceRating));
  if (rating !== null && (rating < 1 || rating > 5)) {
    return { error: "The performance rating is on the same 1 to 5 scale as the centre." };
  }
  if (values.status === "collected" && values.inRole === true && rating === null) {
    return { error: "Someone who went into the role needs a performance rating, or the follow-up is not evidence of anything." };
  }
  if (values.status === "collected" && rating !== null && !text(values.raterName)) {
    return { error: "Record who gave the rating. A rating with no rater cannot be defended later." };
  }
  const sb = createServiceClient();
  const { error } = await sb
    .from("ac_outcome_followups")
    .update({
      status: values.status,
      in_role: values.inRole ?? null,
      performance_rating: values.status === "collected" ? rating : null,
      rating_basis: text(values.ratingBasis),
      rater_name: text(values.raterName),
      rater_role: text(values.raterRole),
      note: text(values.note),
      collected_at: new Date().toISOString(),
      collected_by: who.uid,
    })
    .eq("id", values.followupId);
  if (error) return { error: error.message };
  return { ok: true };
}

/** The evaluation record (9.6, 9.8, 9.9): findings under the five headings. */
export async function addEvaluationAction(values: {
  engagementId: string;
  seriesName?: string | null;
  kind: "annual" | "major" | "ad_hoc";
  periodStart?: string | null;
  periodEnd?: string | null;
  participants?: number | null;
  reliability?: string;
  validity?: string;
  diversity?: string;
  participantImpact?: string;
  utility?: string;
  recommendations?: string;
  conductedByName: string;
  conductedAt: string;
  nextDueOn?: string | null;
}) {
  const who = await admin();
  if ("error" in who) return who;
  if (!text(values.conductedByName)) {
    return { error: "Name who conducted the evaluation. The standard asks for someone with the skills for it (9.11)." };
  }
  if (!values.conductedAt) return { error: "Give the date of the evaluation." };
  // 9.9 says the evaluation SHALL address all five headings. An evaluation
  // that skipped some is still recorded, but the gaps are named to the caller.
  const headings: Record<string, string | undefined> = {
    reliability: values.reliability,
    validity: values.validity,
    diversity: values.diversity,
    "participant impact": values.participantImpact,
    utility: values.utility,
  };
  const missing = Object.entries(headings).filter(([, v]) => !text(v)).map(([k]) => k);
  if (missing.length === 5) return { error: "Write a finding under at least one of the five headings." };

  const sb = createServiceClient();
  const { error } = await sb.from("ac_evaluations").insert({
    engagement_id: values.engagementId,
    series_name: text(values.seriesName),
    kind: values.kind,
    period_start: values.periodStart || null,
    period_end: values.periodEnd || null,
    participants: values.participants == null ? null : Math.round(Number(values.participants)),
    reliability: text(values.reliability),
    validity: text(values.validity),
    diversity: text(values.diversity),
    participant_impact: text(values.participantImpact),
    utility: text(values.utility),
    recommendations: text(values.recommendations),
    conducted_by_name: text(values.conductedByName),
    conducted_at: values.conductedAt,
    next_due_on: values.nextDueOn || null,
    created_by: who.uid,
  });
  if (error) {
    if (/ac_evaluations/.test(error.message)) return { error: "Apply migration 00230 first." };
    return { error: error.message };
  }
  return { ok: true, missing };
}
