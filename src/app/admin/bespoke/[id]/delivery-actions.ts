"use server";

// Delivery controls for one bundle (00233): roster gate, invitation hold,
// welcome message, demographic fields, reasoning time limit, roster import.
import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadBundleService } from "@/lib/bespoke/services";
import { saveBundleSettings, sanitiseDemographicFields, type DemographicField } from "@/lib/bespoke/bundle-settings";
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
