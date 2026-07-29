"use server";

import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { createServiceClient } from "@/lib/supabase/server";
import { drawAllocation, releaseAllocation } from "@/lib/clients/allocations";
import { RUNNABLE_BUNDLE_STAGES, type BundleStage } from "@/lib/bespoke/candidates";
import { portalService, type CaliberService } from "@/lib/clients/portal-services";
import { emailEngagementInvitation, appOrigin } from "@/lib/hipo/email";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-fA-F-]{36}$/;

/**
 * Invite a candidate to a composed bundle's one-sitting flow from the CLIENT
 * portal. Org is resolved server-side (client_manager => own org; admin =>
 * ?org), and the bundle must be assigned to that org. Commercially metered:
 * one seat is drawn from EACH bundled runnable service's allocation (a
 * Persona + Logica bundle invite consumes 1 Persona seat + 1 Logica seat),
 * atomically, with release on any downstream failure.
 */
export async function clientInviteBundleCandidateAction(input: {
  bundleId: string;
  fullName: string;
  email: string;
  orgParam?: string;
}): Promise<{ ok: true; url: string } | { error: string }> {
  const access = await resolvePortalAccess(input.orgParam);
  if (!access.ok || !access.orgId) return { error: "Not authorized." };
  const orgId = access.orgId;
  if (!UUID_RE.test(input.bundleId)) return { error: "Invalid programme." };

  const name = (input.fullName || "").trim();
  const email = (input.email || "").trim().toLowerCase();
  if (name.length < 2 || !EMAIL_RE.test(email)) return { error: "Enter a name and a valid email." };

  const sb = createServiceClient();
  const { data: bundle } = await sb
    .from("bespoke_services")
    .select("id, service_keys, status")
    .eq("id", input.bundleId)
    .eq("kind", "bundle")
    .eq("organization_id", orgId)
    .maybeSingle<{ id: string; service_keys: string[]; status: string }>();
  if (!bundle || bundle.status !== "active") return { error: "This programme is not assigned to your organisation." };

  const metered = (bundle.service_keys ?? []).filter((k): k is BundleStage =>
    (RUNNABLE_BUNDLE_STAGES as readonly string[]).includes(k)
  ) as CaliberService[];
  if (metered.length === 0) return { error: "This bundle has no runnable sections yet." };

  // Draw one seat per bundled service - all or nothing.
  const drawn: CaliberService[] = [];
  for (const svc of metered) {
    const res = await drawAllocation(orgId, svc, 1);
    if (!res.ok) {
      for (const d of drawn) await releaseAllocation(orgId, d, 1);
      const label = portalService(svc)?.label ?? svc;
      return {
        error:
          res.reason === "over_quota"
            ? `Not enough ${label} seats remaining - each invite uses one seat from every bundled service.`
            : `Could not reserve a ${label} seat. Please try again.`,
      };
    }
    drawn.push(svc);
  }

  const { data, error } = await sb
    .from("bundle_candidates")
    .insert({ bespoke_service_id: bundle.id, organization_id: orgId, full_name: name, email })
    .select("access_token")
    .single<{ access_token: string }>();
  if (error || !data) {
    for (const d of drawn) await releaseAllocation(orgId, d, 1);
    return { error: error?.message?.includes("bundle_candidates") ? "The one-sitting flow is not enabled yet - contact VIFM." : error?.message ?? "Could not create the invite." };
  }
  return { ok: true, url: `/bundle/apply/${data.access_token}` };
}

/**
 * Invite a candidate's LINE MANAGER to the HiPo engagement mini-survey
 * (docs/hipo-engagement-pillar-spec.md). Org-gated the same way as the
 * candidate invite: the caller must be an admin or the client_manager of the
 * org the bundle candidate belongs to. Creates one survey row (fresh token)
 * per invite and best-effort emails the manager; the absolute link is always
 * returned for the copy-link fallback.
 */
export async function inviteEngagementManagerAction(input: {
  candidateId: string;
  managerName: string;
  managerEmail: string;
  orgParam?: string;
}): Promise<{ ok: true; url: string; emailed: boolean } | { error: string }> {
  const access = await resolvePortalAccess(input.orgParam);
  if (!access.ok || !access.orgId) return { error: "Not authorized." };
  if (!UUID_RE.test(input.candidateId)) return { error: "Invalid candidate." };

  const name = (input.managerName || "").trim();
  const email = (input.managerEmail || "").trim().toLowerCase();
  if (name.length < 2 || !EMAIL_RE.test(email)) return { error: "Enter the manager's name and a valid email." };

  const sb = createServiceClient();
  const { data: cand } = await sb
    .from("bundle_candidates")
    .select("id, full_name, organization_id")
    .eq("id", input.candidateId)
    .eq("organization_id", access.orgId)
    .maybeSingle<{ id: string; full_name: string; organization_id: string | null }>();
  if (!cand) return { error: "Candidate not found in your organisation." };

  const { data: survey, error } = await sb
    .from("hipo_engagement_surveys")
    .insert({ bundle_candidate_id: cand.id, manager_name: name, manager_email: email })
    .select("access_token")
    .single<{ access_token: string }>();
  if (error || !survey) {
    return {
      error: error?.message?.includes("hipo_engagement_surveys")
        ? "The engagement survey is not enabled yet - contact VIFM."
        : error?.message ?? "Could not create the survey invite.",
    };
  }

  const url = `${appOrigin()}/hipo/engage/${survey.access_token}`;
  const sent = await emailEngagementInvitation({ to: email, managerName: name, candidateName: cand.full_name, url });
  if (sent.ok) {
    await sb.from("hipo_engagement_surveys").update({ invited_at: new Date().toISOString() }).eq("access_token", survey.access_token);
  }
  return { ok: true, url, emailed: sent.ok };
}
