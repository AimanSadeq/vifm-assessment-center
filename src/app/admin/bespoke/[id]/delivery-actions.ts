"use server";

// Delivery controls for one bundle (00233): roster gate, invitation hold,
// welcome message, demographic fields, reasoning time limit, roster import;
// and the scenario section switch and scoring settings (00234).
import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadBundleService } from "@/lib/bespoke/services";
import { saveBundleSettings, loadBundleSettings, sanitiseDemographicFields, type DemographicField } from "@/lib/bespoke/bundle-settings";
import { loadSjtItems, sanitiseSjtConfig } from "@/lib/bespoke/sjt";
import { parseRoster, upsertRoster, removeRosterEntry } from "@/lib/bespoke/roster";

async function guard(bundleId: string) {
  try {
    const caller = await requireRole(["admin"]);
    const bundle = await loadBundleService(bundleId);
    if (!bundle) return { ok: false as const, error: "Bundle not found." };
    return { ok: true as const, caller };
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
    throw e;
  }
}

const done = (bundleId: string) => revalidatePath(`/admin/bespoke/${bundleId}`);

export async function saveBundleDeliveryAction(
  bundleId: string,
  input: { rosterRequired: boolean; welcomeMessage: string; demographicFields: DemographicField[]; logicaMinutes: number | null },
): Promise<{ ok: true } | { error: string }> {
  const g = await guard(bundleId);
  if (!g.ok) return { error: g.error };
  const minutes = input.logicaMinutes == null || Number.isNaN(input.logicaMinutes) ? null : Math.round(input.logicaMinutes);
  if (minutes != null && (minutes < 1 || minutes > 600)) return { error: "Reasoning time limit must be between 1 and 600 minutes." };
  const res = await saveBundleSettings(
    bundleId,
    {
      rosterRequired: !!input.rosterRequired,
      welcomeMessage: input.welcomeMessage,
      demographicFields: sanitiseDemographicFields(input.demographicFields),
      logicaMinutes: minutes,
    },
    g.caller.uid,
  );
  if ("error" in res) return res;
  done(bundleId);
  return { ok: true };
}

export async function setBundleHoldAction(bundleId: string, held: boolean): Promise<{ ok: true } | { error: string }> {
  const g = await guard(bundleId);
  if (!g.ok) return { error: g.error };
  const res = await saveBundleSettings(bundleId, { held }, g.caller.uid);
  if ("error" in res) return res;
  done(bundleId);
  return { ok: true };
}

export async function importRosterAction(
  bundleId: string,
  text: string,
): Promise<{ ok: true; count: number; errors: string[] } | { error: string; errors?: string[] }> {
  const g = await guard(bundleId);
  if (!g.ok) return { error: g.error };
  const { rows, errors } = parseRoster(text);
  if (errors.length > 0) return { error: "Nothing was imported. Fix these rows and paste again.", errors: errors.slice(0, 30) };
  const res = await upsertRoster(bundleId, rows);
  if ("error" in res) return { error: res.error };
  done(bundleId);
  return { ok: true, count: res.count, errors: [] };
}

export async function removeRosterEntryAction(bundleId: string, rosterId: string): Promise<{ ok: true } | { error: string }> {
  const g = await guard(bundleId);
  if (!g.ok) return { error: g.error };
  const res = await removeRosterEntry(bundleId, rosterId);
  if ("error" in res) return res;
  done(bundleId);
  return { ok: true };
}

/** Scenario section (00234): switch, presentation order and level cut-offs.
 *  Submitted results keep the config they were scored with. */
export async function saveScenarioSettingsAction(
  bundleId: string,
  input: { enabled: boolean; order: "shuffled" | "grouped"; cuts: { advanced: number; proficient: number; basic: number } },
): Promise<{ ok: true } | { error: string }> {
  const g = await guard(bundleId);
  if (!g.ok) return { error: g.error };
  const { advanced, proficient, basic } = input.cuts;
  if (![advanced, proficient, basic].every((n) => Number.isFinite(n) && n >= 0 && n <= 12)) {
    return { error: "Cut-offs must be numbers between 0 and 12." };
  }
  if (!(basic <= proficient && proficient <= advanced)) return { error: "Cut-offs must rise: Basic, then Proficient, then Advanced." };
  if (input.enabled && (await loadSjtItems(bundleId)).length === 0) {
    return { error: "Load the scenarios before switching the section on." };
  }
  const current = await loadBundleSettings(bundleId);
  const res = await saveBundleSettings(
    bundleId,
    {
      sjtEnabled: !!input.enabled,
      sjtConfig: sanitiseSjtConfig({ ...current.sjtConfig, order: input.order, cuts: { advanced, proficient, basic } }),
    },
    g.caller.uid,
  );
  if ("error" in res) return res;
  done(bundleId);
  return { ok: true };
}
