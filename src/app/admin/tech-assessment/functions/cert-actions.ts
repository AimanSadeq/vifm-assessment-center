"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError, type AraCaller } from "@/lib/ara/auth-guards";
import { draftFunctionSkillItems, calibrateFunctionBank } from "@/lib/competencies/technical-function-bank";
import type { BankItemStatus } from "@/lib/competencies/technical-item-bank";
import { setTimerMinutes } from "@/lib/assessment-timers";

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

/** One-click: AI-draft items for EVERY skill in the function that is still short
 *  of `perSkill` existing items (draft/in_review/approved). The simple path —
 *  the reviewer just approves afterwards instead of clicking skill-by-skill. */
export async function draftAllFunctionSkillItemsAction(input: {
  ref: string;
  skills: string[];
  context?: string;
  perSkill?: number;
}): Promise<Result<{ inserted: number; skillsDrafted: number; skipped: number; failures: number }>> {
  const g = await guard();
  if ("error" in g) return g;
  const skills = (input.skills ?? []).map((s) => s.trim()).filter(Boolean);
  if (skills.length === 0) return { error: "no skills" };
  const target = Math.max(1, Math.min(20, Math.round(input.perSkill ?? 4)));

  // Count existing items per skill so re-runs only fill gaps (idempotent).
  const counts: Record<string, number> = {};
  for (const s of skills) counts[s] = 0;
  try {
    const sb = createServiceClient();
    const { data, error } = await sb
      .from("tech_assessment_items")
      .select("skill")
      .is("domain_key", null)
      .in("status", ["draft", "in_review", "approved"])
      .in("skill", skills);
    if (error) return { error: error.message };
    for (const r of (data as { skill: string }[] | null) ?? []) {
      if (r.skill in counts) counts[r.skill] += 1;
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "count failed" };
  }

  let inserted = 0;
  let skillsDrafted = 0;
  let skipped = 0;
  let failures = 0;
  for (const skill of skills) {
    const need = target - (counts[skill] ?? 0);
    if (need <= 0) {
      skipped++;
      continue;
    }
    const res = await draftFunctionSkillItems(skill, need, input.context);
    if (res.error === "no_api_key") return { error: "Set ANTHROPIC_API_KEY to draft items with AI." };
    if (res.error) {
      failures++;
      continue;
    }
    inserted += res.inserted;
    skillsDrafted++;
  }

  revalidatePath(`/admin/tech-assessment/functions/${input.ref}`);
  return { ok: true, inserted, skillsDrafted, skipped, failures };
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

/** Calibrate the function's per-skill bank — write each item's Rasch difficulty
 *  (CAT groundwork). Uses the p-value substrate or the difficulty prior. */
export async function calibrateFunctionBankAction(input: {
  ref: string;
  skills: string[];
}): Promise<Result<{ calibrated: number }>> {
  const g = await guard();
  if ("error" in g) return g;
  const res = await calibrateFunctionBank(input.skills);
  if (res.error) return { error: `Calibration failed (${res.error}).` };
  revalidatePath(`/admin/tech-assessment/functions/${input.ref}`);
  return { ok: true, calibrated: res.calibrated };
}

/** Set/refresh the documented passing standard (cut-score) for a function. */
export async function setFunctionCutScoreAction(input: {
  ref: string;
  functionId: string;
  passPct: number;
  minItemsPerSkill: number;
  method?: string | null;
  rationale?: string | null;
  /** Per-instance time limit (minutes); null/0 = no limit. */
  timeLimitMinutes?: number | null;
}): Promise<Result> {
  const g = await guard();
  if ("error" in g) return g;
  if (!UUID_RE.test(input.functionId)) return { error: "invalid function" };

  const passPct = Math.max(1, Math.min(100, Math.round(Number(input.passPct))));
  const minItemsPerSkill = Math.max(1, Math.min(20, Math.round(Number(input.minItemsPerSkill))));

  // Per-instance time limit, keyed by the function ref (the run scope the API reads).
  if (input.timeLimitMinutes !== undefined) {
    const m = input.timeLimitMinutes && input.timeLimitMinutes > 0 ? Math.round(input.timeLimitMinutes) : null;
    await setTimerMinutes(`tech_function:${input.ref}`, m);
  }

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
