"use server";

import { requireRole } from "@/lib/ara/auth-guards";
import { createClientOrganization, type AraRegion, type AraSector } from "@/lib/clients/registry";

// Inline "+ Add a new client" used by the voucher wizards' shared client picker.
// Registers the client in the platform registry (dual-writes both org stores) so
// it becomes selectable in every service, exactly like ARC's add-client. Admin-only.
export async function addVoucherClientAction(input: {
  name: string;
  region?: AraRegion;
  sector?: AraSector;
}): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  await requireRole(["admin"]);
  const name = input.name.trim();
  if (!name) return { ok: false, error: "A client name is required." };
  const res = await createClientOrganization({ name, region: input.region, sector: input.sector });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, name };
}
