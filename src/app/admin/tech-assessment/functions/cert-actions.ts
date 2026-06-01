"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError, type AraCaller } from "@/lib/ara/auth-guards";
import { draftFunctionSkillItems } from "@/lib/competencies/technical-function-bank";
import type { BankItemStatus } from "@/lib/competencies/technical-item-bank";

type Result<T = unknown> = ({ ok: true } & T) | { error: string };

async function guard(): Promise<{ caller: AraCaller } | { error: string }> {
  try {
    const caller = await requireRole(["admin"]);
    return { caller };
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}

const reviewerName = (caller: AraCaller): string => (caller.isDev ? "VIFM Admin" : caller.uid);
const UUID_RE = /^[0-9a-fA-F-]{36}$/;
const VALID_STATUS: BankItemStatus[] = ["draft", "in_review", "approved", "rejected", "retired"];

/** AI-author N candidate items for ONE function skill into the bank as 'draft'. */
export async function draftFunctionSkillItemsAction(input: {
  ref: string;
  skill: string;
  count: number;
  context?: string;
}): Promise<Result<{ inserted: number }>> {
  const g = await guard();
  if ("error" in g) return g;
  if (!input.skill?.trim()) return { error: "skill required" };

  const res = await draftFunctionSkillItems(input.skill, input.count, input.context);
  if (res.error === "no_api_key") return { error: "Set ANTHROPIC_API_KEY to draft items with AI." };
  if (res.error) return { error: `Could not draft items (${res.error}).` };
  revalidatePath(`/admin/tech-assessment/functions/${input.ref}`);
  return { ok: true, inserted: res.inserted };
}

/** Move a function-skill bank item through review (approve / reject / retire). */
export async function setFunctionItemStatusAction(input: {
  ref: string;
  itemId: string;
  status: string;
  reviewNotes?: string;
}): Promise<Result> {
  const g = await guard();
  if ("error" in g) return g;
  if (!VALID_STATUS.includes(input.status as BankItemStatus)) return { error: "invalid status" };

  try {
    const sb = createServiceClient();
    const stamp = input.status === "approved" || input.status === "rejected";
    const { error } = await sb
      .from("tech_assessment_items")
      .update({
        status: input.status,
        review_notes: input.reviewNotes ?? null,
        reviewer_name: stamp ? reviewerName(g.caller) : null,
        reviewed_at: stamp ? new Date().toISOString() : null,
      })
      .eq("id", input.itemId);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "update failed" };
  }
  revalidatePath(`/admin/tech-assessment/functions/${input.ref}`);
  return { ok: true };
}

/** Set/refresh the documented passing standard (cut-score) for a function. */
export async function setFunctionCutScoreAction(input: {
  ref: string;
  functionId: string;
  passPct: number;
  minItemsPerSkill: number;
  method?: string | null;
  rationale?: string | null;
}): Promise<Result> {
  const g = await guard();
  if ("error" in g) return g;
  if (!UUID_RE.test(input.functionId)) return { error: "invalid function" };

  const passPct = Math.max(1, Math.min(100, Math.round(Number(input.passPct))));
  const minItemsPerSkill = Math.max(1, Math.min(20, Math.round(Number(input.minItemsPerSkill))));

  try {
    const sb = createServiceClient();
    const { error } = await sb.from("technical_function_cut_scores").upsert(
      {
        function_id: input.functionId,
        pass_pct: passPct,
        min_items_per_skill: minItemsPerSkill,
        method: input.method ?? null,
        rationale: input.rationale ?? null,
        set_by_name: reviewerName(g.caller),
        set_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "function_id" }
    );
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "save failed" };
  }
  revalidatePath(`/admin/tech-assessment/functions/${input.ref}`);
  return { ok: true };
}
