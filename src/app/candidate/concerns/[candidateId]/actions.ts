"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { publishToAllAdmins } from "@/lib/notifications/publish";

/**
 * A participant raising a concern about how the centre was run, or appealing
 * against a result (BPS 5.44, 5.48).
 *
 * Deliberately written through the ordinary client, not the service role: row
 * level security is what decides whether this caller may write against this
 * candidate, and it is the same rule that governs reading them back. A
 * service-role insert here would have to re-implement that check by hand, which
 * is how the portal's IDOR problems have started before.
 */
export async function raiseConcernAction(values: {
  candidateId: string;
  kind: "concern" | "appeal";
  stage: "before" | "during" | "after";
  body: string;
}) {
  const body = (values.body ?? "").trim();
  if (body.length < 15) {
    return { error: "Please describe what happened in a little more detail so it can be looked into." };
  }

  const supabase = await createClient();
  const { data: candidate, error: candErr } = await supabase
    .from("candidates")
    .select("id, engagement_id, full_name")
    .eq("id", values.candidateId)
    .maybeSingle();
  if (candErr || !candidate) {
    return { error: "We could not find your assessment record." };
  }

  const { error } = await supabase.from("ac_participant_concerns").insert({
    engagement_id: candidate.engagement_id as string,
    candidate_id: candidate.id as string,
    kind: values.kind,
    stage: values.stage,
    body,
  });
  if (error) {
    return { error: error.message };
  }

  // Nobody watches a table. Raising something that sits unread is the failure
  // mode the clause exists to prevent, so the admin team is told immediately.
  await publishToAllAdmins({
    kind: values.kind === "appeal" ? "appeal_raised" : "concern_raised",
    title:
      values.kind === "appeal"
        ? `Appeal raised by ${candidate.full_name as string}`
        : `Concern raised by ${candidate.full_name as string}`,
    body: body.slice(0, 180),
    link: `/admin/engagements/${candidate.engagement_id as string}`,
  });

  return { ok: true };
}

/**
 * The contact a participant is given (BPS 5.43). Read with the service client
 * because it lives on the engagement, which a candidate cannot read directly -
 * scoped to the one candidate id the caller already proved they can see.
 */
export async function loadEngagementContact(engagementId: string) {
  const sb = createServiceClient();
  const { data } = await sb
    .from("engagements")
    .select("participant_contact_name, participant_contact_email, appeals_note")
    .eq("id", engagementId)
    .maybeSingle();
  return data ?? null;
}
