"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createClientOrganization } from "@/lib/clients/registry";
import { saveBundleService, archiveBundleService, updateBundleService, loadBundleService, loadBundleUsage } from "@/lib/bespoke/services";
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

  const design = deriveDesign(input);
  if ("error" in design) return { error: design.error };
  const { services, serviceConfig } = design;

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


type DesignInput = { services: string[]; logicaSubtests?: string[]; personaCompetencyIds?: string[] };

/**
 * Turn the composer's picks into what is stored: the ordered service keys and
 * the per-service scope, where only a real SUBSET is worth storing. Shared by
 * compose and update so an edited bundle is derived exactly like a new one.
 */
function deriveDesign(input: DesignInput): { services: CaliberService[]; serviceConfig: Record<string, unknown> } | { error: string } {
  const services = PORTAL_SERVICE_IDS.filter((id) => (input.services ?? []).includes(id)) as CaliberService[];
  if (services.length === 0) return { error: "Pick at least one service." };
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
  return { services, serviceConfig };
}

/** Stable text form of a design, for "did the design change" comparisons. */
function designKey(services: string[], config: Record<string, unknown>): string {
  return JSON.stringify({ services: [...services].sort(), config });
}

/**
 * Edit a composed bundle. Name, description and client can always change.
 * The DESIGN (service mix + scope) is locked once anyone has been invited or
 * a voucher has been issued against it: those people were promised the
 * sitting as designed, and a changed mix would give them a different one.
 * The honest path for a different design is Clone.
 */
export async function updateBundleAction(input: {
  id: string;
  nameEn: string;
  nameAr?: string;
  description?: string;
  services: string[];
  clientName: string;
  logicaSubtests?: string[];
  personaCompetencyIds?: string[];
}): Promise<{ ok: true } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };

  const nameEn = input.nameEn?.trim() ?? "";
  if (nameEn.length < 2) return { error: "Give the bespoke service a name." };
  const clientName = input.clientName?.trim() ?? "";
  if (!clientName) return { error: "Pick a client organisation." };

  const current = await loadBundleService(input.id);
  if (!current) return { error: "This bundle no longer exists." };

  const design = deriveDesign(input);
  if ("error" in design) return { error: design.error };

  const designChanged = designKey(design.services, design.serviceConfig) !== designKey(current.service_keys, current.service_config);
  if (designChanged) {
    const usage = await loadBundleUsage(input.id);
    if (usage.candidates > 0 || usage.vouchers > 0) {
      const parts = [
        usage.candidates > 0 ? `${usage.candidates} candidate${usage.candidates === 1 ? "" : "s"} invited` : null,
        usage.vouchers > 0 ? `${usage.vouchers} voucher${usage.vouchers === 1 ? "" : "s"} issued` : null,
      ].filter(Boolean).join(" and ");
      return { error: `The design is locked: ${parts} against it. Name, description and client can still change; to change the services or their scope, clone the bundle instead.` };
    }
  }

  const reg = await createClientOrganization({ name: clientName, createdBy: g.caller.isDev ? null : g.caller.uid });
  if (!reg.ok) return { error: reg.error };

  const res = await updateBundleService({
    id: input.id,
    nameEn,
    nameAr: input.nameAr?.trim() || null,
    description: input.description?.trim() || null,
    organizationId: reg.organizationId,
    serviceKeys: design.services,
    serviceConfig: design.serviceConfig,
  });
  if ("error" in res) return { error: res.error };

  revalidatePath("/admin/bespoke");
  revalidatePath(`/admin/bespoke/${input.id}`);
  revalidatePath("/portal");
  revalidatePath("/");
  return { ok: true };
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

/**
 * Create a multi-seat voucher (shared redeemable link) for a bundle, mirroring
 * the other services' voucher model. Returns the code so the admin can copy the
 * redeem link. Admin-gated; org is inherited from the bundle.
 */
export async function createBundleVoucherAction(input: {
  bundleId: string;
  seats: number;
  label?: string;
  expiresAt?: string | null;
}): Promise<{ ok: true; code: string } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };

  const { createBundleVoucher } = await import("@/lib/bespoke/bundle-vouchers");
  const res = await createBundleVoucher({
    bundleId: input.bundleId,
    mode: "pool",
    seats: input.seats,
    label: input.label ?? null,
    expiresAt: input.expiresAt ?? null,
    createdBy: g.caller.isDev ? null : g.caller.uid,
  });
  if ("error" in res) return { error: res.error };
  return { ok: true, code: res.codes[0] };
}

/** List a bundle's issued vouchers (admin) so codes + remaining seats are
 *  retrievable after the create panel closes. */
export async function listBundleVouchersAction(bundleId: string): Promise<{
  ok: true;
  vouchers: { code: string; used: number; max: number; label: string | null; expiresAt: string | null }[];
} | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };
  const { loadBundleVouchers } = await import("@/lib/bespoke/bundle-vouchers");
  const rows = await loadBundleVouchers(bundleId);
  return {
    ok: true,
    vouchers: rows.map((v) => ({ code: v.code, used: v.uses, max: v.max_uses, label: v.label, expiresAt: v.expires_at })),
  };
}
