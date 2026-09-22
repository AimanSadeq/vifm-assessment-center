"use server";

import { createClient } from "@/lib/supabase/server";
import { publishToAllAdmins } from "@/lib/notifications/publish";

/**
 * The participant's answer to a request for their report (BPS 8.13).
 *
 * Through the ordinary client, so row level security is what decides whether
 * this caller owns the request. The database trigger keeps the question itself
 * unchanged and refuses to turn a refusal into a grant.
 */
export async function decideDisclosureAction(values: {
  disclosureId: string;
  status: "granted" | "refused" | "withdrawn";
  note?: string;
}) {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("ac_report_disclosures")
    .update({
      status: values.status,
      participant_note: (values.note ?? "").trim() || null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", values.disclosureId)
    .select("engagement_id, recipient_name, candidate_id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!row) return { error: "That request could not be found." };

  await publishToAllAdmins({
    kind: "disclosure_decided",
    title:
      values.status === "granted"
        ? `Report disclosure permitted: ${row.recipient_name as string}`
        : values.status === "withdrawn"
          ? `Report disclosure permission withdrawn: ${row.recipient_name as string}`
          : `Report disclosure refused: ${row.recipient_name as string}`,
    body: "Decided by the participant.",
    link: `/admin/engagements/${row.engagement_id as string}`,
  });
  return { ok: true };
}
