// Platform-wide client registry. The portal keeps two organization stores —
// `organizations` (Assessment Center + Pre-Hire) and `ara_organizations`
// (AI Readiness + Reflect 360). A "client" should be usable in EVERY service, so
// creating one writes to both stores (deduped by case-insensitive name) and the
// Platform Clients page reads a union of the two. Service-role throughout
// (bypasses RLS — this is the admin-only registry surface).

import { createServiceClient } from "@/lib/supabase/server";

export type AraRegion = "uae" | "saudi";
export type AraSector = "government" | "banking" | "general";

const norm = (s: string) => s.trim().toLowerCase();

/** Region is required by ara_organizations (only uae/saudi exist). Best-effort
 *  from the free-text country; the consultant can refine it in the ARA editor. */
export function deriveRegion(country?: string | null): AraRegion {
  const c = (country ?? "").toLowerCase();
  if (/saud|ksa|\briyadh\b|jeddah|jedda|dammam|mecca|medina|\bsa\b/.test(c)) return "saudi";
  return "uae";
}

/** Sector is required by ara_organizations. Best-effort from the industry text. */
export function deriveSector(industry?: string | null): AraSector {
  const i = (industry ?? "").toLowerCase();
  if (/bank|financ|invest|capital|treasur|insur|wealth|fintech/.test(i)) return "banking";
  if (/govern|ministr|public|authority|municipal|federal|regulator/.test(i)) return "government";
  return "general";
}

export type CreateClientInput = {
  name: string;
  industry?: string | null;
  country?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  region?: AraRegion;
  sector?: AraSector;
  nameAr?: string | null;
  /** Stamp the ara_organizations row's creator so consultant RLS scoping works
   *  when a client is registered from within a service (e.g. ARC). Null/omitted
   *  leaves it unset (the prior behaviour for the global Platform Clients page). */
  createdBy?: string | null;
};

export type CreateClientResult =
  | { ok: true; organizationId: string; araOrganizationId: string; createdAc: boolean; createdAra: boolean }
  | { ok: false; error: string };

/**
 * Create (or reuse) a client in BOTH org stores so it is selectable across the
 * Assessment Center, Pre-Hire, AI Readiness, and Reflect 360. Dedupes by
 * case-insensitive name per store, so calling it for an existing name simply
 * back-fills the missing store and returns the existing ids.
 */
export async function createClientOrganization(input: CreateClientInput): Promise<CreateClientResult> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "A client name is required." };
  const sb = createServiceClient();
  const region = input.region ?? deriveRegion(input.country);
  const sector = input.sector ?? deriveSector(input.industry);

  // ── organizations (Assessment Center + Pre-Hire) ──
  let organizationId = "";
  let createdAc = false;
  {
    const { data: rows, error } = await sb.from("organizations").select("id, name");
    if (error) return { ok: false, error: error.message };
    const hit = (rows ?? []).find((o: { id: string; name: string }) => norm(o.name) === norm(name));
    if (hit) organizationId = hit.id;
    else {
      const ins = await sb.from("organizations").insert({
        name,
        industry: input.industry || null,
        country: input.country || null,
        contact_name: input.contactName || null,
        contact_email: input.contactEmail || null,
      }).select("id").single();
      if (ins.error || !ins.data) return { ok: false, error: ins.error?.message ?? "Could not create the client (AC store)." };
      organizationId = (ins.data as { id: string }).id;
      createdAc = true;
    }
  }

  // ── ara_organizations (AI Readiness + Reflect 360) ──
  let araOrganizationId = "";
  let createdAra = false;
  {
    const { data: rows, error } = await sb.from("ara_organizations").select("id, name");
    if (error) return { ok: false, error: error.message };
    const hit = (rows ?? []).find((o: { id: string; name: string }) => norm(o.name) === norm(name));
    if (hit) araOrganizationId = hit.id;
    else {
      const ins = await sb.from("ara_organizations").insert({
        name,
        name_ar: input.nameAr || null,
        sector,
        region,
        ...(input.createdBy ? { created_by: input.createdBy } : {}),
      }).select("id").single();
      if (ins.error || !ins.data) return { ok: false, error: ins.error?.message ?? "Could not create the client (AR Compass store)." };
      araOrganizationId = (ins.data as { id: string }).id;
      createdAra = true;
    }
  }

  return { ok: true, organizationId, araOrganizationId, createdAc, createdAra };
}

export type PlatformClient = {
  key: string;
  name: string;
  industry: string | null;
  country: string | null;
  region: AraRegion | null;
  sector: AraSector | null;
  acId: string | null;   // organizations.id (AC + Pre-Hire)
  araId: string | null;  // ara_organizations.id (ARA + Reflect)
  engagementCount: number;
};

/** Union of both org stores, keyed by case-insensitive name, for the Platform
 *  Clients page. A client present in both stores is a single merged row whose
 *  `acId`/`araId` show which services it's wired into. */
export async function loadPlatformClients(): Promise<PlatformClient[]> {
  const sb = createServiceClient();
  const [acRes, araRes, engRes] = await Promise.all([
    sb.from("organizations").select("id, name, industry, country"),
    sb.from("ara_organizations").select("id, name, region, sector"),
    sb.from("engagements").select("organization_id"),
  ]);

  const engCount = new Map<string, number>();
  for (const e of (engRes.data ?? []) as { organization_id: string | null }[]) {
    if (e.organization_id) engCount.set(e.organization_id, (engCount.get(e.organization_id) ?? 0) + 1);
  }

  const byKey = new Map<string, PlatformClient>();
  for (const o of (acRes.data ?? []) as { id: string; name: string; industry: string | null; country: string | null }[]) {
    const key = norm(o.name);
    byKey.set(key, { key, name: o.name, industry: o.industry, country: o.country, region: null, sector: null, acId: o.id, araId: null, engagementCount: engCount.get(o.id) ?? 0 });
  }
  for (const o of (araRes.data ?? []) as { id: string; name: string; region: AraRegion; sector: AraSector }[]) {
    const key = norm(o.name);
    const existing = byKey.get(key);
    if (existing) {
      existing.araId = o.id;
      existing.region = o.region;
      existing.sector = o.sector;
    } else {
      byKey.set(key, { key, name: o.name, industry: null, country: null, region: o.region, sector: o.sector, acId: null, araId: o.id, engagementCount: 0 });
    }
  }

  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name));
}
