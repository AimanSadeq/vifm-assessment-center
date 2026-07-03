"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createClientOrganization } from "@/lib/clients/registry";
import { saveBundleService, archiveBundleService } from "@/lib/bespoke/services";
import { PORTAL_SERVICE_IDS, type CaliberService } from "@/lib/clients/portal-services";
import { COGNITIVE_SUBTEST_KEYS } from "@/lib/psychometrics/framework";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";

async function guard() {
  try {
    const caller = await requireRole(["admin"]);
    return { ok: true as const, caller };
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
    throw e;
  }
}

/**
 * Persist a composed bespoke bundle and assign it to a client. The client org
 * is resolved by name through the shared registry (dedupe by case-insensitive
 * name, dual-store create when new) so the bundle lands on the same
 * organizations.id the client portal resolves for its manager.
 */
export async function composeBundleAction(input: {
  nameEn: string;
  nameAr?: string;
  description?: string;
  services: string[];
  clientName: string;
  /** Logica element scope; a real subset stores config, full battery stores nothing. */
  logicaSubtests?: string[];
  /** Persona competency scope; a real subset stores config, all 41 stores nothing. */
  personaCompetencyIds?: string[];
}): Promise<{ ok: true; id: string } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };

  const nameEn = input.nameEn?.trim() ?? "";
  if (nameEn.length < 2) return { error: "Give the bespoke service a name." };
  const clientName = input.clientName?.trim() ?? "";
  if (!clientName) return { error: "Pick a client organisation." };

  const services = PORTAL_SERVICE_IDS.filter((id) => (input.services ?? []).includes(id)) as CaliberService[];
  if (services.length === 0) return { error: "Pick at least one service." };

  // Per-service options: only a real subset is worth storing.
  const serviceConfig: Record<string, unknown> = {};
  if (services.includes("logica")) {
    const picked = COGNITIVE_SUBTEST_KEYS.filter((k) => (input.logicaSubtests ?? []).includes(k));
    if (picked.length === 0) return { error: "Pick at least one Logica element." };
    if (picked.length < COGNITIVE_SUBTEST_KEYS.length) serviceConfig.logica = { subtests: picked };
  }
  if (services.includes("persona")) {
    const known = BEHAVIORAL_COMPETENCIES.map((c) => c.acCompetencyId);
    const picked = known.filter((id) => (input.personaCompetencyIds ?? known).includes(id));
    if (picked.length === 0) return { error: "Pick at least one Persona competency." };
    if (picked.length < known.length) serviceConfig.persona = { competencyIds: picked };
  }

  const reg = await createClientOrganization({ name: clientName, createdBy: g.caller.isDev ? null : g.caller.uid });
  if (!reg.ok) return { error: reg.error };

  const res = await saveBundleService({
    nameEn,
    nameAr: input.nameAr?.trim() || null,
    description: input.description?.trim() || null,
    organizationId: reg.organizationId,
    serviceKeys: services,
    serviceConfig,
    createdBy: g.caller.isDev ? null : g.caller.uid,
  });
  if ("error" in res) return { error: res.error };

  revalidatePath("/admin/bespoke");
  revalidatePath("/portal");
  revalidatePath("/");
  return { ok: true, id: res.id };
}

/** Archive a composed bundle (it disappears from the portal + composer list). */
export async function archiveBundleAction(id: string): Promise<{ ok: true } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };
  const res = await archiveBundleService(id);
  if ("error" in res) return { error: res.error };
  revalidatePath("/admin/bespoke");
  revalidatePath("/portal");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Invite a candidate to a bundle's one-sitting flow: creates the
 * bundle_candidates row (org inherited from the bundle) and returns the
 * token apply link for the admin to share.
 */
export async function inviteBundleCandidateAction(input: {
  bundleId: string;
  fullName: string;
  email: string;
}): Promise<{ ok: true; url: string } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };

  const fullName = input.fullName?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  if (fullName.length < 2) return { error: "Enter the candidate's name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };

  const { createServiceClient } = await import("@/lib/supabase/server");
  const svc = createServiceClient();
  const { data: bundle } = await svc
    .from("bespoke_services")
    .select("id, kind, status, organization_id")
    .eq("id", input.bundleId)
    .maybeSingle<{ id: string; kind: string; status: string; organization_id: string | null }>();
  if (!bundle || bundle.kind !== "bundle" || bundle.status !== "active") {
    return { error: "Bundle not found (it may have been archived)." };
  }

  const { data, error } = await svc
    .from("bundle_candidates")
    .insert({
      bespoke_service_id: bundle.id,
      organization_id: bundle.organization_id,
      full_name: fullName,
      email,
      created_by: g.caller.isDev ? null : g.caller.uid,
    })
    .select("access_token")
    .single<{ access_token: string }>();
  if (error || !data) {
    return { error: error?.message?.includes("bundle_candidates") ? "Apply migration 00172 (bundle_candidates) first." : error?.message ?? "Could not invite." };
  }
  return { ok: true, url: `/bundle/apply/${data.access_token}` };
}
