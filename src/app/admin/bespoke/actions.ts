"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createClientOrganization } from "@/lib/clients/registry";
import { saveBundleService, archiveBundleService } from "@/lib/bespoke/services";
import { PORTAL_SERVICE_IDS, type CaliberService } from "@/lib/clients/portal-services";
import { COGNITIVE_SUBTEST_KEYS } from "@/lib/psychometrics/framework";

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
}): Promise<{ ok: true; id: string } | { error: string }> {
  const g = await guard();
  if (!g.ok) return { error: g.error };

  const nameEn = input.nameEn?.trim() ?? "";
  if (nameEn.length < 2) return { error: "Give the bespoke service a name." };
  const clientName = input.clientName?.trim() ?? "";
  if (!clientName) return { error: "Pick a client organisation." };

  const services = PORTAL_SERVICE_IDS.filter((id) => (input.services ?? []).includes(id)) as CaliberService[];
  if (services.length === 0) return { error: "Pick at least one service." };

  // Per-service options: only a real Logica subset is worth storing.
  const serviceConfig: Record<string, unknown> = {};
  if (services.includes("logica")) {
    const picked = COGNITIVE_SUBTEST_KEYS.filter((k) => (input.logicaSubtests ?? []).includes(k));
    if (picked.length === 0) return { error: "Pick at least one Logica element." };
    if (picked.length < COGNITIVE_SUBTEST_KEYS.length) serviceConfig.logica = { subtests: picked };
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
