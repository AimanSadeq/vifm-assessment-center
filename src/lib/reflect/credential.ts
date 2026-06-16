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
      .select("id, full_name, email, reflect_engagements(name)")
      .eq("id", participantId)
      .maybeSingle<{
        id: string;
        full_name: string;
        email: string | null;
        reflect_engagements: { name: string } | { name: string }[] | null;
      }>();
    if (!p) return null;

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

    const eng = Array.isArray(p.reflect_engagements) ? p.reflect_engagements[0] : p.reflect_engagements;
    const engName = eng?.name ?? null;

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
