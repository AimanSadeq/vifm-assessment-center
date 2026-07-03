// ─────────────────────────────────────────────────────────────
// Org-level portal settings (migration 00173) - a jsonb bag on organizations.
//
// Read/written via the service-role client only; callers gate access (admin, or
// a client_manager whose getClientOrgId() matches). Tolerant of the migration
// not being applied: reads return {}, writes report a friendly error.
// ─────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/server";

export type OrgSettings = {
  /**
   * When true, every Fluent voucher sitting for this client runs with camera
   * proctoring regardless of the per-voucher proctor_enabled flag. Off by
   * default - monitoring is opt-in per the platform's privacy posture.
   */
  fluent_proctoring_required?: boolean;
};

/** Postgres undefined_column - the expected error until 00173 is applied. */
const MISSING_COLUMN = "42703";

export async function getOrgSettings(orgId: string | null | undefined): Promise<OrgSettings> {
  if (!orgId) return {};
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("organizations")
      .select("settings")
      .eq("id", orgId)
      .maybeSingle<{ settings: OrgSettings | null }>();
    if (error) {
      // Fail-open is deliberate (a transient DB error must not hard-block a
      // sitting), but only the un-applied-migration case is silent - anything
      // else is logged so a policy silently not applying is traceable.
      if (error.code !== MISSING_COLUMN) {
        console.error("[org-settings] settings read failed for", orgId, "-", error.message);
      }
      return {};
    }
    if (!data?.settings || typeof data.settings !== "object") return {};
    return data.settings;
  } catch (e) {
    console.error("[org-settings] settings read threw for", orgId, "-", e);
    return {};
  }
}

/** Shallow-merge patch into the org's settings bag. Caller must have gated access. */
export async function updateOrgSettings(
  orgId: string,
  patch: Partial<OrgSettings>
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const sb = createServiceClient();
    const current = await getOrgSettings(orgId);
    const { data, error } = await sb
      .from("organizations")
      .update({ settings: { ...current, ...patch } })
      .eq("id", orgId)
      .select("id");
    if (error) {
      return { ok: false, error: "Settings storage is not available yet (apply migration 00173)." };
    }
    // Zero rows = the org id doesn't exist in the AC organizations table (e.g.
    // an admin previewing with an ARC org id) - report it instead of a false
    // success toast while nothing was persisted.
    if (!data || data.length === 0) {
      return { ok: false, error: "Organisation not found - the setting was not saved." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Settings storage is not available yet (apply migration 00173)." };
  }
}
