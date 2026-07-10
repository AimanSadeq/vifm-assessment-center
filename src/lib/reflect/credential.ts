/**
 * Reflect 360 completion credential.
 *
 * Issued to a participant once their 360 deliverable is produced (the consultant
 * generates the participant report). A verifiable, development-grade record that
 * the leader completed a VIFM Reflect 360 feedback cycle - checkable at
 * /verify/[code], parallel to ARC's AI Readiness credential.
 *
 * Best-effort: never throws, idempotent on the participant (source_id), and
 * no-ops cleanly until migration 00107 widens the credential_type whitelist.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { issueCredential } from "@/lib/credentials/issue";

export async function issueReflect360Credential(
  participantId: string,
): Promise<{ verificationCode: string } | null> {
  try {
    const sb = createServiceClient();
    const { data: p } = await sb
      .from("reflect_participants")
      .select("id, full_name, email, engagement_id, reflect_engagements(name, status)")
      .eq("id", participantId)
      .maybeSingle<{
        id: string;
        full_name: string;
        email: string | null;
        engagement_id: string | null;
        reflect_engagements: { name: string; status: string } | { name: string; status: string }[] | null;
      }>();
    if (!p) return null;

    // COMPLETION GATE: the credential asserts the leader "completed" a 360, so
    // it must only issue once the engagement itself has finished AND at least
    // one rater actually submitted feedback. Previously it fired on ANY
    // participant-report PDF download - which the consultant can trigger while
    // status is still 'live' and collection is running, minting a verifiable
    // "Completed" credential for a cycle that had zero responses.
    const engRel = Array.isArray(p.reflect_engagements) ? p.reflect_engagements[0] : p.reflect_engagements;
    const engStatus = engRel?.status ?? "";
    if (!["complete", "archived"].includes(engStatus)) {
      return null; // engagement not finished - no credential yet
    }
    const { count: completedRaters } = await sb
      .from("reflect_raters")
      .select("id", { count: "exact", head: true })
      .eq("participant_id", participantId)
      .eq("status", "completed");
    if ((completedRaters ?? 0) === 0) {
      return null; // no feedback collected - nothing to certify
    }

    // Idempotent: one credential per participant.
    const { data: existing } = await sb
      .from("vifm_credentials")
      .select("verification_code")
      .eq("source_id", participantId)
      .eq("credential_type", "reflect_360")
      .maybeSingle();
    if (existing?.verification_code) {
      return { verificationCode: existing.verification_code as string };
    }

    const engName = engRel?.name ?? null;

    return await issueCredential({
      candidateId: null,
      issuedToName: p.full_name,
      issuedToEmail: p.email ?? null,
      type: "reflect_360",
      titleEn: "Reflect 360 - Leadership Feedback",
      titleAr: "ريفلكت 360 - تغذية راجعة قيادية",
      subtitleEn: engName ? `Completed - ${engName}` : "Leadership 360 feedback completed",
      subtitleAr: engName ? `مكتمل - ${engName}` : "اكتملت التغذية الراجعة القيادية 360",
      sourceId: participantId,
      metadata: { participant_id: participantId },
    });
  } catch (e) {
    console.error("[reflect] 360 credential issue error:", e);
    return null;
  }
}
