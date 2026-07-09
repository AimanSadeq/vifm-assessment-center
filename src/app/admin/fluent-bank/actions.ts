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

/** Edit an item's content. Receptive (reading/listening) = passage/script +
 *  question + 4 options + correct index; productive (writing/speaking) = the
 *  prompts. Editing returns the item to 'in_review' for re-promotion. */
export async function updateFluentItemAction(input: {
  itemId: string;
  content?: string;
  question?: string;
  options?: string[];
  correct_index?: number;
  prompt_en?: string;
  prompt_ar?: string;
}): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  const svc = createServiceClient();
  const { data: row } = await svc
    .from("eng_fluent_items")
    .select("stem, skill")
    .eq("id", input.itemId)
    .maybeSingle<{ stem: Record<string, unknown>; skill: string }>();
  if (!row) return { ok: false, error: "Item not found." };

  const stem: Record<string, unknown> = { ...(row.stem ?? {}) };
  if (row.skill === "writing" || row.skill === "speaking") {
    if (typeof input.prompt_en === "string" && input.prompt_en.trim()) stem.prompt_en = input.prompt_en.trim();
    if (typeof input.prompt_ar === "string") stem.prompt_ar = input.prompt_ar.trim();
  } else {
    const contentKey = row.skill === "reading" ? "passage" : "script";
    if (typeof input.content === "string" && input.content.trim()) stem[contentKey] = input.content.trim();
    if (typeof input.question === "string" && input.question.trim()) stem.question = input.question.trim();
    if (Array.isArray(input.options) && input.options.length === 4) stem.options = input.options.map((o) => String(o));
    if (typeof input.correct_index === "number" && input.correct_index >= 0 && input.correct_index <= 3) stem.correct_index = input.correct_index;
  }

  const { error } = await svc
    .from("eng_fluent_items")
    .update({ stem, status: "in_review", reviewed_by: null, reviewed_at: null })
    .eq("id", input.itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/fluent-bank");
  return { ok: true, message: "Saved - returned to review for re-promotion." };
}
