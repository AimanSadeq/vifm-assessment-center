// Persistence for Bespoke Services - configured products that surface inside the
// landing "Bespoke Services" section. A 'role_readiness' row points at an
// rr_role_configs config; a 'bundle' row (generic composer) carries service_keys
// + per-service options in service_config (00171, e.g. a Logica subtest scope).
// Service-role reads/writes (admin + landing surfacing).

import { createServiceClient } from "@/lib/supabase/server";

export type BespokeServiceRow = {
  id: string;
  kind: "role_readiness" | "bundle";
  name_en: string;
  name_ar: string | null;
  description: string | null;
  organization_id: string | null;
  role_config_id: string | null;
  service_keys: string[];
  /** Per-service options keyed by service id (00171); {} when unset/pre-migration. */
  service_config: Record<string, unknown>;
  status: string;
  is_sample: boolean;
};

/** Undefined column - migration 00171 (service_config) not applied yet. */
function isMissingColumnError(err: { code?: string } | null): boolean {
  return err?.code === "42703" || err?.code === "PGRST204";
}

/**
 * Active bespoke products to surface in the landing section. With no org →
 * everything active (admin view). With an org → that org's products plus global
 * templates (organization_id IS NULL). Tolerant: returns [] if the table isn't
 * present yet (pre-migration).
 */
export async function loadBespokeServices(opts?: {
  organizationId?: string | null;
}): Promise<BespokeServiceRow[]> {
  const svc = createServiceClient();
  // service_config first (00171); peel it off if the column isn't there yet.
  const cols = "id, kind, name_en, name_ar, description, organization_id, role_config_id, service_keys, status, is_sample";
  const run = async (withConfig: boolean) => {
    let query = svc
      .from("bespoke_services")
      .select(withConfig ? `${cols}, service_config` : cols)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    const orgId = opts?.organizationId;
    if (orgId) {
      // org's own products + global templates
      query = query.or(`organization_id.eq.${orgId},organization_id.is.null`);
    }
    return query;
  };

  let { data, error } = await run(true);
  if (error && isMissingColumnError(error)) ({ data, error } = await run(false));
  if (error || !data) return [];
  return (data as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    kind: (r.kind as "role_readiness" | "bundle") ?? "role_readiness",
    name_en: r.name_en as string,
    name_ar: (r.name_ar as string | null) ?? null,
    description: (r.description as string | null) ?? null,
    organization_id: (r.organization_id as string | null) ?? null,
    role_config_id: (r.role_config_id as string | null) ?? null,
    service_keys: Array.isArray(r.service_keys) ? (r.service_keys as string[]) : [],
    service_config:
      r.service_config && typeof r.service_config === "object" && !Array.isArray(r.service_config)
        ? (r.service_config as Record<string, unknown>)
        : {},
    status: r.status as string,
    is_sample: !!r.is_sample,
  }));
}

/**
 * Persist a composed bundle (the generic composer). One row per composition -
 * no upsert key; an admin composes as many as needed and archives mistakes.
 * Tolerant of 00171 (service_config) not applied: retries without the column.
 */
export async function saveBundleService(input: {
  nameEn: string;
  nameAr?: string | null;
  description?: string | null;
  organizationId: string;
  serviceKeys: string[];
  serviceConfig?: Record<string, unknown>;
  createdBy?: string | null;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const svc = createServiceClient();
  const base = {
    kind: "bundle" as const,
    name_en: input.nameEn,
    name_ar: input.nameAr ?? null,
    description: input.description ?? null,
    organization_id: input.organizationId,
    role_config_id: null,
    service_keys: input.serviceKeys,
    status: "active",
    created_by: input.createdBy ?? null,
  };
  const config = input.serviceConfig && Object.keys(input.serviceConfig).length > 0 ? input.serviceConfig : null;

  let { data, error } = await svc
    .from("bespoke_services")
    .insert(config ? { ...base, service_config: config } : base)
    .select("id")
    .single();
  if (error && config && isMissingColumnError(error)) {
    ({ data, error } = await svc.from("bespoke_services").insert(base).select("id").single());
  }
  if (error || !data) return { error: error?.message ?? "Could not save the bundle." };
  return { ok: true, id: data.id as string };
}

/** Archive a composed bundle (kind-guarded so a role-readiness row can't be hit). */
export async function archiveBundleService(id: string): Promise<{ ok: true } | { error: string }> {
  const svc = createServiceClient();
  const { error } = await svc
    .from("bespoke_services")
    .update({ status: "archived" })
    .eq("id", id)
    .eq("kind", "bundle");
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Publish (upsert) a role-readiness config as a bespoke service so it surfaces in
 * the section. One bespoke_services row per (role_config_id). Re-publishing
 * refreshes name/description/assignment.
 */
export async function publishRoleReadinessService(input: {
  roleConfigId: string;
  nameEn: string;
  nameAr?: string | null;
  description?: string | null;
  organizationId?: string | null;
  isSample?: boolean;
  createdBy?: string | null;
}): Promise<{ ok: true; id: string } | { error: string }> {
  const svc = createServiceClient();

  const { data: existing } = await svc
    .from("bespoke_services")
    .select("id")
    .eq("kind", "role_readiness")
    .eq("role_config_id", input.roleConfigId)
    .maybeSingle();

  const row = {
    kind: "role_readiness" as const,
    name_en: input.nameEn,
    name_ar: input.nameAr ?? null,
    description: input.description ?? null,
    organization_id: input.organizationId ?? null,
    role_config_id: input.roleConfigId,
    status: "active",
    is_sample: input.isSample ?? false,
  };

  if (existing) {
    const { error } = await svc.from("bespoke_services").update(row).eq("id", existing.id as string);
    if (error) return { error: error.message };
    return { ok: true, id: existing.id as string };
  }

  const { data: ins, error } = await svc
    .from("bespoke_services")
    .insert({ ...row, created_by: input.createdBy ?? null })
    .select("id")
    .single();
  if (error || !ins) return { error: error?.message ?? "Could not publish bespoke service." };
  return { ok: true, id: ins.id as string };
}

/** Unpublish (archive) the bespoke service for a role config. */
export async function unpublishRoleReadinessService(roleConfigId: string): Promise<void> {
  const svc = createServiceClient();
  await svc
    .from("bespoke_services")
    .update({ status: "archived" })
    .eq("kind", "role_readiness")
    .eq("role_config_id", roleConfigId);
}
