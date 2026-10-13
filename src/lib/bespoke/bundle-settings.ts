// Per-bundle delivery settings (00233): roster gate, invitation hold, welcome
// message, demographic fields, reasoning timer; client logo (00236). A bundle with no row keeps the
// original behaviour (open, no roster, default copy, global Logica timer), and
// every reader tolerates the table not being migrated yet.

import { createServiceClient } from "@/lib/supabase/server";
import { DEFAULT_SJT_CONFIG, sanitiseSjtConfig, type SjtConfig } from "./sjt-shared";

export type DemographicField = {
  key: string;
  label: string;
  type: "select" | "text";
  options?: string[];
  required?: boolean;
};

export type BundleSettings = {
  rosterRequired: boolean;
  held: boolean;
  releasedAt: string | null;
  welcomeMessage: string | null;
  /** Client logo shown on the sign-in and welcome screens (00236): a file
   *  shipped under /client-logos/, never an outside URL. */
  clientLogoUrl: string | null;
  demographicFields: DemographicField[];
  logicaMinutes: number | null;
  /** Scenario-question stage (00234) runs first when enabled. */
  sjtEnabled: boolean;
  sjtConfig: SjtConfig;
};

export const DEFAULT_BUNDLE_SETTINGS: BundleSettings = {
  rosterRequired: false,
  held: false,
  releasedAt: null,
  welcomeMessage: null,
  clientLogoUrl: null,
  demographicFields: [],
  logicaMinutes: null,
  sjtEnabled: false,
  sjtConfig: DEFAULT_SJT_CONFIG,
};

const KEY_RE = /^[a-z][a-z0-9_]{0,39}$/;
// Mirrors the 00236 CHECK: same-origin logo files only.
const LOGO_RE = /^\/client-logos\/[A-Za-z0-9._-]+\.(png|svg|jpg|jpeg|webp)$/;

/** A valid client logo path, or null (empty or anything else). */
export function sanitiseClientLogoUrl(raw: unknown): string | null {
  const v = String(raw ?? "").trim();
  return LOGO_RE.test(v) ? v : null;
}

/** First word of a full name, for the greeting ("Welcome, Sarah"). */
export function firstNameOf(fullName: string): string {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean);
  return parts[0] ?? "";
}

/** Keep only well-formed field definitions (the admin form and SQL both feed this). */
export function sanitiseDemographicFields(raw: unknown): DemographicField[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: DemographicField[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const f = r as Record<string, unknown>;
    const key = String(f.key ?? "").trim();
    const label = String(f.label ?? "").trim().slice(0, 120);
    const type = f.type === "text" ? "text" : "select";
    if (!KEY_RE.test(key) || !label || seen.has(key)) continue;
    const options = Array.isArray(f.options)
      ? Array.from(new Set(f.options.map((o) => String(o ?? "").trim().slice(0, 120)).filter(Boolean))).slice(0, 50)
      : [];
    if (type === "select" && options.length < 2) continue;
    seen.add(key);
    out.push({ key, label, type, ...(type === "select" ? { options } : {}), required: f.required !== false });
    if (out.length >= 12) break;
  }
  return out;
}

type Row = {
  roster_required: boolean;
  held: boolean;
  released_at: string | null;
  welcome_message: string | null;
  client_logo_url?: string | null;
  demographic_fields: unknown;
  logica_minutes: number | null;
  sjt_enabled?: boolean;
  sjt_config?: unknown;
};

export async function loadBundleSettings(bundleId: string): Promise<BundleSettings> {
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("bundle_settings")
      .select("*")
      .eq("bespoke_service_id", bundleId)
      .maybeSingle<Row>();
    if (error || !data) return DEFAULT_BUNDLE_SETTINGS;
    return {
      rosterRequired: !!data.roster_required,
      held: !!data.held,
      releasedAt: data.released_at,
      welcomeMessage: data.welcome_message?.trim() || null,
      clientLogoUrl: sanitiseClientLogoUrl(data.client_logo_url),
      demographicFields: sanitiseDemographicFields(data.demographic_fields),
      logicaMinutes: data.logica_minutes ?? null,
      sjtEnabled: !!data.sjt_enabled,
      sjtConfig: sanitiseSjtConfig(data.sjt_config),
    };
  } catch {
    return DEFAULT_BUNDLE_SETTINGS;
  }
}

export async function saveBundleSettings(
  bundleId: string,
  patch: Partial<Omit<BundleSettings, "releasedAt">>,
  actorId: string | null,
): Promise<{ ok: true } | { error: string }> {
  const sb = createServiceClient();
  const current = await loadBundleSettings(bundleId);
  const next = { ...current, ...patch };
  const row: Record<string, unknown> = {
    bespoke_service_id: bundleId,
    roster_required: next.rosterRequired,
    held: next.held,
    welcome_message: next.welcomeMessage?.trim() ? next.welcomeMessage.trim().slice(0, 4000) : null,
    demographic_fields: sanitiseDemographicFields(next.demographicFields),
    logica_minutes: next.logicaMinutes && next.logicaMinutes > 0 ? Math.min(600, Math.round(next.logicaMinutes)) : null,
    sjt_enabled: next.sjtEnabled,
    sjt_config: sanitiseSjtConfig(next.sjtConfig),
  };
  // Written only when the caller sets it, so saving other settings keeps the
  // logo and still works before 00236 is applied.
  if ("clientLogoUrl" in patch) row.client_logo_url = sanitiseClientLogoUrl(patch.clientLogoUrl);
  // Releasing (held true -> false) stamps who and when; holding again clears it.
  if (patch.held === false && current.held) {
    row.released_at = new Date().toISOString();
    row.released_by = actorId;
  } else if (patch.held === true) {
    row.released_at = null;
    row.released_by = null;
  }
  const { error } = await sb.from("bundle_settings").upsert(row, { onConflict: "bespoke_service_id" });
  if (error) return { error: error.message };
  return { ok: true };
}
