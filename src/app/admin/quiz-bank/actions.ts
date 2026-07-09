"use server";

// SME actions for the competency quiz bank console. All admin-gated + service-role
// (the table is admin-RLS). Approving is the human SME sign-off that activates a
// competency's pool in the Pre-Hire screen; a bulk action approves a whole
// competency at once. Two-person review is enforced on the per-item approve.

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError, type AraCaller } from "@/lib/ara/auth-guards";
import type { QuizBankStatus } from "@/lib/quiz-bank/admin";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
type Gate = { ok: true; caller: AraCaller } | { ok: false; error: string };

const STATUSES: QuizBankStatus[] = ["draft", "in_review", "approved", "rejected", "retired"];

async function ensureAdmin(): Promise<Gate> {
  try {
    return { ok: true, caller: await requireRole(["admin"]) };
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false, error: "Not authorized." };
    throw e;
  }
}

/** Move one item through the review lifecycle. Approving enforces two-person
 *  review (approver != drafter, dev-bypassed) and stamps reviewer identity. */
export async function setQuizItemStatusAction(input: { itemId: string; status: QuizBankStatus; reason?: string }): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  if (!STATUSES.includes(input.status)) return { ok: false, error: "Invalid status." };
  const svc = createServiceClient();

  if (input.status === "approved" || input.status === "rejected") {
    const { data: item } = await svc
      .from("competency_quiz_items").select("drafted_by").eq("id", input.itemId).maybeSingle<{ drafted_by: string | null }>();
    if (!item) return { ok: false, error: "Item not found." };
    if (input.status === "approved" && !gate.caller.isDev && item.drafted_by && item.drafted_by === gate.caller.uid) {
      return { ok: false, error: "Two-person review: approve an item drafted by someone else." };
    }
    const patch: Record<string, unknown> = { status: input.status, reviewed_by: gate.caller.uid, reviewed_at: new Date().toISOString() };
    if (input.status === "rejected") patch.rejected_reason = input.reason?.trim() || null;
    const { error } = await svc.from("competency_quiz_items").update(patch).eq("id", input.itemId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/quiz-bank");
    return { ok: true };
  }

  const { error } = await svc.from("competency_quiz_items").update({ status: input.status }).eq("id", input.itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/quiz-bank");
  return { ok: true };
}

/** Approve every in_review item for a competency in one action - the SME's
 *  batch sign-off that activates that competency's pool in the Pre-Hire screen. */
export async function bulkApproveCompetencyAction(input: { competencyId: string }): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  const svc = createServiceClient();
  const { data, error } = await svc
    .from("competency_quiz_items")
    .update({ status: "approved", reviewed_by: gate.caller.uid, reviewed_at: new Date().toISOString() })
    .eq("competency_id", input.competencyId)
    .eq("status", "in_review")
    .select("id");
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/quiz-bank");
  return { ok: true, message: `Approved ${data?.length ?? 0} item(s).` };
}

/** Edit an item's wording/key. Editing an APPROVED item returns it to in_review. */
export async function updateQuizItemAction(input: {
  itemId: string;
  prompt_en?: string;
  prompt_ar?: string;
  correct_index?: number;
  difficulty?: "easy" | "medium" | "hard";
}): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  const patch: Record<string, unknown> = {};
  if (typeof input.prompt_en === "string" && input.prompt_en.trim()) patch.prompt_en = input.prompt_en.trim();
  if (typeof input.prompt_ar === "string") patch.prompt_ar = input.prompt_ar.trim() || null;
  if (typeof input.correct_index === "number") patch.correct_index = input.correct_index;
  if (input.difficulty && ["easy", "medium", "hard"].includes(input.difficulty)) patch.difficulty = input.difficulty;
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update." };

  const svc = createServiceClient();
  const { data: cur } = await svc.from("competency_quiz_items").select("status").eq("id", input.itemId).maybeSingle<{ status: string }>();
  if (cur?.status === "approved") {
    patch.status = "in_review";
    patch.reviewed_by = null;
    patch.reviewed_at = null;
  }
  const { error } = await svc.from("competency_quiz_items").update(patch).eq("id", input.itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/quiz-bank");
  return { ok: true };
}

/** Toggle the Arabic-reviewed quality flag (human MSA sign-off) on an item. */
export async function setQuizItemArReviewedAction(input: { itemId: string; value: boolean }): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  const svc = createServiceClient();
  const { error } = await svc.from("competency_quiz_items").update({ ar_reviewed: !!input.value }).eq("id", input.itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/quiz-bank");
  return { ok: true };
}
