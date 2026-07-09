"use server";

// SME actions for the Persona item bank (migration 00185). Admin-gated +
// service-role. Approving an item clears the "provisional" flag on Persona
// results once its whole competency is approved.

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
const STATUSES = ["pending", "approved", "rejected", "retired"];

async function ensureAdmin() {
  try {
    return { ok: true as const, caller: await requireRole(["admin"]) };
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false as const, error: "Not authorized." };
    throw e;
  }
}

/** Set status on Persona items, scoped by explicit ids, by competency, or all. */
export async function setPersonaItemsStatusAction(input: {
  status: string;
  acCompetencyId?: string;
  itemIds?: string[];
  all?: boolean;
}): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  if (!STATUSES.includes(input.status)) return { ok: false, error: "Invalid status." };

  const svc = createServiceClient();
  const patch: Record<string, unknown> = { status: input.status, updated_at: new Date().toISOString() };
  if (input.status === "approved" || input.status === "rejected") {
    patch.sme_reviewed_by = gate.caller.isDev ? null : gate.caller.uid;
    patch.sme_reviewed_at = new Date().toISOString();
  }

  let q = svc.from("persona_items").update(patch);
  if (input.itemIds && input.itemIds.length > 0) q = q.in("id", input.itemIds);
  else if (input.acCompetencyId) q = q.eq("ac_competency_id", input.acCompetencyId);
  else if (input.all) q = q.not("id", "is", null);
  else return { ok: false, error: "No scope specified." };

  const { data, error } = await q.select("id");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/persona-bank");
  return { ok: true, message: `Updated ${data?.length ?? 0} item(s).` };
}
