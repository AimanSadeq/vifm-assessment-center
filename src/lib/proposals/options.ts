// Server-only loaders that shape the client + bundle pickers for the proposal
// builder, plus the current rate map. Kept out of the client bundle (imported
// only by the admin server pages).

import { loadPlatformClients } from "@/lib/clients/registry";
import { loadBespokeServices } from "@/lib/bespoke/services";
import { rateMap } from "./service";
import type { ClientOption, BundleOption } from "@/app/admin/proposals/_components/proposal-builder";

/** Human scope note per service from a bundle's service_config (e.g. Logica subtests). */
function bundleScopeNotes(sc: Record<string, unknown>): Record<string, string> {
  const notes: Record<string, string> = {};
  const logica = sc.logica as { subtests?: string[] } | undefined;
  if (Array.isArray(logica?.subtests) && logica!.subtests!.length) notes.logica = logica!.subtests!.join(" + ");
  const persona = sc.persona as { competencyIds?: string[] } | undefined;
  if (Array.isArray(persona?.competencyIds) && persona!.competencyIds!.length)
    notes.persona = `${persona!.competencyIds!.length} competencies`;
  return notes;
}

export async function loadClientOptions(): Promise<ClientOption[]> {
  const clients = await loadPlatformClients().catch(() => []);
  return clients.map((c) => ({
    name: c.name,
    region: c.region ?? null,
    sector: c.sector ?? null,
    acId: c.acId ?? null,
    araId: c.araId ?? null,
  }));
}

export async function loadBundleOptions(): Promise<BundleOption[]> {
  const rows = await loadBespokeServices().catch(() => []);
  return rows
    .filter((r) => r.kind === "bundle")
    .map((r) => ({
      id: r.id,
      name: r.name_en,
      serviceKeys: r.service_keys ?? [],
      scopeNotes: bundleScopeNotes(r.service_config ?? {}),
    }));
}

export async function loadRateMap(): Promise<Record<string, number>> {
  return rateMap();
}
