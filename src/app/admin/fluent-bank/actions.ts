"use server";

// SME actions for the Fluent receptive bank. Admin-gated + service-role. Promoting
// an item to 'live' is the human sign-off that activates bank-serving in the
// runner (the assembler draws from status='live' only).

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError, type AraCaller } from "@/lib/ara/auth-guards";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
type Gate = { ok: true; caller: AraCaller } | { ok: false; error: string };

const STATUSES = ["draft", "calibrating", "live", "in_review", "rejected", "retired"];

async function ensureAdmin(): Promise<Gate> {
  try {
    return { ok: true, caller: await requireRole(["admin"]) };
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false, error: "Not authorized." };
    throw e;
  }
}

/** Move one item's status (promote to live / reject / retire / restore). */
export async function setFluentItemStatusAction(input: { itemId: string; status: string; reason?: string }): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  if (!STATUSES.includes(input.status)) return { ok: false, error: "Invalid status." };
  const svc = createServiceClient();
  const patch: Record<string, unknown> = { status: input.status };
  if (input.status === "live" || input.status === "rejected") {
    patch.reviewed_by = gate.caller.uid;
    patch.reviewed_at = new Date().toISOString();
    if (input.status === "rejected") patch.rejected_reason = input.reason?.trim() || null;
  }
  const { error } = await svc.from("eng_fluent_items").update(patch).eq("id", input.itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/fluent-bank");
  return { ok: true };
}

/** Promote every in_review item for a skill to 'live' - the SME batch sign-off
 *  that activates bank-serving for that skill (once the live ramp is complete). */
export async function bulkPromoteSkillAction(input: { skill: "reading" | "listening" | "writing" | "speaking" }): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("eng_fluent_items")
    .update({ status: "live", reviewed_by: gate.caller.uid, reviewed_at: new Date().toISOString() })
    .eq("skill", input.skill)
    .eq("status", "in_review")
    .select("id");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/fluent-bank");
  return { ok: true, message: `Promoted ${data?.length ?? 0} ${input.skill} item(s) to live.` };
}
