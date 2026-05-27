/**
 * AC "Ready Now" credential issuance.
 *
 * Issued when an engagement is marked completed: every candidate whose
 * finalised OAR recommendation is `ready_now` earns an `ac_ready_now`
 * credential. Engagement-completion is the deliberate "the assessment is
 * final" gate - the codebase has no separate report-release write, and the
 * OAR upsert in the wash-up is still in flux until the run is closed out,
 * so issuing per-OAR-save would be premature.
 *
 * Idempotent: source_id is the OAR row's uuid, so re-completing an
 * engagement (or completing it twice) never double-issues. Best-effort -
 * never throws, so a credential hiccup can't block the status change.
 * If an assessor later downgrades a recommendation, an admin revokes the
 * stale credential (vifm_credentials.revoked_at); we don't auto-revoke.
 *
 * Uses createServiceClient (untyped); no-ops gracefully if 00049 / the OAR
 * tables aren't present.
 */
import { createServiceClient } from "@/lib/supabase/server";
import { issueCredential } from "@/lib/credentials/issue";

type OarRow = {
  id: string;
  candidate_id: string;
  overall_score: number;
  recommendation: string;
};

/**
 * Issue ac_ready_now credentials for every ready_now candidate in an
 * engagement. Returns how many new credentials were created.
 */
export async function issueReadyNowForEngagement(
  engagementId: string
): Promise<{ issued: number }> {
  let issued = 0;
  try {
    const sb = createServiceClient();

    const { data: oars } = (await sb
      .from("overall_assessment_ratings")
      .select("id, candidate_id, overall_score, recommendation")
      .eq("engagement_id", engagementId)
      .eq("recommendation", "ready_now")) as { data: OarRow[] | null };

    if (!oars || oars.length === 0) return { issued: 0 };

    // Engagement context for the credential labels.
    const { data: eng } = (await sb
      .from("engagements")
      .select("name, target_role, organizations(name)")
      .eq("id", engagementId)
      .maybeSingle()) as {
      data: {
        name: string;
        target_role: string | null;
        organizations: { name: string } | { name: string }[] | null;
      } | null;
    };
    const org = eng?.organizations;
    const orgName = Array.isArray(org) ? org[0]?.name ?? null : org?.name ?? null;
    const targetRole = eng?.target_role ?? null;

    // Candidate names in one round-trip.
    const candidateIds = oars.map((o) => o.candidate_id);
    const { data: cands } = (await sb
      .from("candidates")
      .select("id, full_name, email")
      .in("id", candidateIds)) as {
      data: { id: string; full_name: string; email: string | null }[] | null;
    };
    const candById = new Map((cands ?? []).map((c) => [c.id, c]));

    // Already-issued ac_ready_now credentials for these OARs (idempotency).
    const oarIds = oars.map((o) => o.id);
    const { data: existing } = (await sb
      .from("vifm_credentials")
      .select("source_id")
      .eq("credential_type", "ac_ready_now")
      .in("source_id", oarIds)) as { data: { source_id: string }[] | null };
    const alreadyIssued = new Set((existing ?? []).map((r) => r.source_id));

    for (const oar of oars) {
      if (alreadyIssued.has(oar.id)) continue;
      const cand = candById.get(oar.candidate_id);
      const subtitleBits = ["Ready Now", orgName].filter(Boolean);
      const result = await issueCredential({
        candidateId: oar.candidate_id,
        issuedToName: cand?.full_name ?? "VIFM Candidate",
        issuedToEmail: cand?.email ?? null,
        type: "ac_ready_now",
        titleEn: targetRole
          ? `VIFM Assessment Center - ${targetRole}`
          : "VIFM Assessment Center",
        subtitleEn: subtitleBits.join(" · "),
        scorePct:
          typeof oar.overall_score === "number"
            ? Math.round((oar.overall_score / 5) * 100)
            : null,
        sourceId: oar.id,
        metadata: {
          engagement_id: engagementId,
          candidate_id: oar.candidate_id,
          overall_score: oar.overall_score,
          recommendation: oar.recommendation,
        },
      });
      if (result) issued += 1;
    }
  } catch (e) {
    console.error("[credentials] ready-now issuance error:", e);
  }
  return { issued };
}
