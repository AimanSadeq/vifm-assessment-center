"use server";

import { createClient } from "@/lib/supabase/server";
import { publishToAllAdmins } from "@/lib/notifications/publish";

/**
 * "I have read this" (BPS 3.17, 5.39).
 *
 * Recorded separately from consent so the two can be told apart later: consent
 * given without the pack having been read is the failure the clause is about,
 * and a single combined tick would hide it.
 *
 * Written through the ordinary client so row level security decides whether
 * this caller may write against this candidate.
 */
export async function acknowledgePackAction(candidateId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("candidates")
    .update({ pack_ack_at: new Date().toISOString() })
    .eq("id", candidateId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * The adjustments question, asked of everyone (BPS 5.46) rather than waiting
 * for a participant to volunteer it. "No adjustments needed" is a recorded
 * answer, not an absence of one, which is why not_asked is a distinct state.
 */
export async function setAdjustmentNeedAction(values: {
  candidateId: string;
  needs: boolean;
  request?: string;
}) {
  const request = (values.request ?? "").trim();
  if (values.needs && request.length < 5) {
    return { error: "Tell us what would help, so we can arrange it." };
  }

  const supabase = await createClient();
  const { data: candidate } = await supabase
    .from("candidates")
    .select("full_name, engagement_id")
    .eq("id", values.candidateId)
    .maybeSingle();

  const { error } = await supabase
    .from("candidates")
    .update({
      adjustment_status: values.needs ? "requested" : "none_needed",
      adjustment_request: values.needs ? request : null,
      adjustment_requested_at: new Date().toISOString(),
    })
    .eq("id", values.candidateId);
  if (error) return { error: error.message };

  if (values.needs && candidate) {
    await publishToAllAdmins({
      kind: "adjustment_requested",
      title: `Adjustment requested by ${candidate.full_name as string}`,
      body: request.slice(0, 180),
      link: `/admin/engagements/${candidate.engagement_id as string}`,
    });
  }
  return { ok: true };
}

/**
 * Voluntary self-identification for fairness monitoring (BPS 3.19).
 *
 * The timestamp is stamped even when every answer is "prefer not to say":
 * "asked and declined" and "never asked" are different facts, and only the
 * second one is a gap in our monitoring.
 */
export async function setVoluntaryDemographicsAction(values: {
  candidateId: string;
  gender: string | null;
  ageBand: string | null;
  nationalityGroup: string | null;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("candidates")
    .update({
      gender: values.gender,
      age_band: values.ageBand,
      nationality_group: values.nationalityGroup,
      demographics_submitted_at: new Date().toISOString(),
    })
    .eq("id", values.candidateId);
  if (error) return { error: error.message };
  return { ok: true };
}
