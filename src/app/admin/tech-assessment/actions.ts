"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError, type AraCaller } from "@/lib/ara/auth-guards";
import { draftAiItemsToBank, backfillBankArabic } from "@/lib/competencies/technical-item-bank";
import { techDomainByKey, type TechDomainKey } from "@/lib/competencies/technical-framework";
import type { BankItemStatus, BankItemType } from "@/lib/competencies/technical-item-bank";
import { setTimerMinutes } from "@/lib/assessment-timers";

// Admin-only gate. Under AUTH_ENABLED=false requireRole returns a synthetic
// admin so dev works; under auth=on it throws for non-admins. Returns the
// caller (for the review audit name) or an error string.
async function guard(): Promise<{ caller: AraCaller } | { error: string }> {
  try {
    const caller = await requireRole(["admin"]);
    return { caller };
  } catch (e) {
    if (isAuthorizationError(e)) return { error: e.message };
    throw e;
  }
}

function reviewerName(caller: AraCaller): string {
  // The caller only carries a uid (+ dev flag). Record the uid for a real
  // signed-in SME; a stable label in dev (auth off).
  return caller.isDev ? "VIFM Admin" : caller.uid;
}

const VALID_STATUS: BankItemStatus[] = ["draft", "in_review", "approved", "rejected", "retired"];

/** AI-author N candidate items for a domain into the bank as 'draft'. */
export async function generateDraftItemsAction(domainKey: string, count: number) {
  const g = await guard();
  if ("error" in g) return g;
  if (!techDomainByKey(domainKey)) return { error: "unknown domain" };

  const res = await draftAiItemsToBank(domainKey as TechDomainKey, count);
  if (res.error === "no_api_key") {
    return { error: "Set ANTHROPIC_API_KEY to draft items with AI." };
  }
  if (res.error) return { error: `Could not draft items (${res.error}).` };
  revalidatePath("/admin/tech-assessment/items");
  return { ok: true, inserted: res.inserted };
}

/** Fill missing Arabic on bank items (translate question/options for any row
 *  lacking Arabic) so the certified path renders Arabic. Optionally per-domain. */
export async function backfillArabicAction(domainKey?: string) {
  const g = await guard();
  if ("error" in g) return g;
  if (domainKey && !techDomainByKey(domainKey)) return { error: "unknown domain" };

  const res = await backfillBankArabic(domainKey as TechDomainKey | undefined);
  if (res.error === "no_api_key") return { error: "Set ANTHROPIC_API_KEY to translate items." };
  if (res.error) return { error: `Could not translate (${res.error}).` };
  revalidatePath("/admin/tech-assessment/items");
  return { ok: true, updated: res.updated, missing: res.missing };
}

/** Move an item through the review workflow (approve / reject / retire / …). */
export async function setItemStatusAction(
  itemId: string,
  status: string,
  reviewNotes?: string
) {
  const g = await guard();
  if ("error" in g) return g;
  if (!VALID_STATUS.includes(status as BankItemStatus)) return { error: "invalid status" };

  try {
    const sb = createServiceClient();
    const stamp = status === "approved" || status === "rejected";
    const { error } = await sb
      .from("tech_assessment_items")
      .update({
        status,
        review_notes: reviewNotes ?? null,
        reviewer_name: stamp ? reviewerName(g.caller) : null,
        reviewed_at: stamp ? new Date().toISOString() : null,
      })
      .eq("id", itemId);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "update failed" };
  }
  revalidatePath("/admin/tech-assessment/items");
  return { ok: true };
}

export type EditItemFields = {
  skill?: string;
  question_type?: BankItemType;
  question_en?: string;
  question_ar?: string | null;
  scenario_en?: string | null;
  scenario_ar?: string | null;
  options_en?: string[];
  options_ar?: string[] | null;
  correct_index?: number;
  correct_indices?: number[] | null;
  difficulty?: "easy" | "medium" | "hard";
  explanation_en?: string | null;
};

/** Edit an item's content (a human refining an AI draft). Type-aware: single /
 *  scenario need 4 options + one correct; true_false 2 options + one correct;
 *  multi 4-6 options + 2+ correct (with a distractor). */
export async function updateItemAction(itemId: string, fields: EditItemFields) {
  const g = await guard();
  if ("error" in g) return g;

  // Validate the option / correct shape against the (effective) item type.
  if (fields.options_en) {
    const type = fields.question_type ?? "single";
    const opts = fields.options_en;
    if (!Array.isArray(opts) || opts.some((o) => typeof o !== "string" || !o.trim())) {
      return { error: "all options must be filled in" };
    }
    if (type === "true_false") {
      if (opts.length !== 2) return { error: "true/false needs exactly 2 options" };
    } else if (type === "multi") {
      if (opts.length < 4 || opts.length > 6) return { error: "select-all needs 4-6 options" };
      const ci = Array.isArray(fields.correct_indices) ? fields.correct_indices : [];
      if (ci.length < 2 || ci.length >= opts.length || ci.some((n) => n < 0 || n >= opts.length)) {
        return { error: "select-all needs 2+ correct options and at least one wrong" };
      }
    } else {
      if (opts.length !== 4) return { error: "exactly 4 options required" };
    }
    const maxIdx = type === "true_false" ? 1 : opts.length - 1;
    if (fields.correct_index != null && (fields.correct_index < 0 || fields.correct_index > maxIdx)) {
      return { error: `correct option out of range` };
    }
  }

  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) patch[k] = v;
  }
  // Non-multi items must not carry a stale multi answer key.
  if (fields.question_type && fields.question_type !== "multi") patch.correct_indices = null;
  // Non-scenario items must not carry a stale stem.
  if (fields.question_type && fields.question_type !== "scenario") {
    patch.scenario_en = null;
    patch.scenario_ar = null;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  try {
    const sb = createServiceClient();
    // Integrity: a CONTENT edit invalidates any prior SME approval. If the item was
    // already approved (or retired from the approved pool) AND a question/answer
    // field actually changed, send it back to in_review and clear the review stamp
    // so the new content must be re-approved - otherwise the approver's sign-off
    // would silently cover content they never saw, and buildCertifiedTest (which
    // draws status='approved') would ship it. The editor posts the FULL field set
    // on every Save, so we diff against the stored row: a no-op save (open + Save
    // with no change) must NOT demote, or it would silently drop the domain from
    // certifiable to indicative.
    const COMPARE_COLS = [
      "skill", "question_type", "question_en", "question_ar", "scenario_en",
      "scenario_ar", "options_en", "options_ar", "correct_index", "correct_indices",
      "difficulty", "explanation_en",
    ] as const;
    let current: (Record<string, unknown> & { status?: string }) | null = null;
    {
      const full = await sb
        .from("tech_assessment_items")
        .select(["status", ...COMPARE_COLS].join(", "))
        .eq("id", itemId)
        .maybeSingle();
      if (full.error) {
        // pre-00082: the new columns don't exist - read status only (we then
        // can't diff content, so demote to be safe below).
        const legacy = await sb.from("tech_assessment_items").select("status").eq("id", itemId).maybeSingle();
        current = (legacy.data as (Record<string, unknown> & { status?: string }) | null) ?? null;
      } else {
        current = (full.data as (Record<string, unknown> & { status?: string }) | null) ?? null;
      }
    }
    if (current && (current.status === "approved" || current.status === "retired")) {
      const cur = current;
      const eq = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
      // If the comparable columns weren't read (pre-00082), err safe: demote.
      const contentChanged =
        !("skill" in cur) || COMPARE_COLS.some((c) => c in patch && !eq(patch[c], cur[c]));
      if (contentChanged) {
        patch.status = "in_review";
        patch.reviewer_name = null;
        patch.reviewed_at = null;
      }
    }
    const { error } = await sb.from("tech_assessment_items").update(patch).eq("id", itemId);
    if (error) {
      // migration 00082 not applied - retry with only the legacy columns so
      // editing a classic single-answer item still works pre-migration.
      const NEW_COLS = ["question_type", "correct_indices", "scenario_en", "scenario_ar"];
      const legacy = Object.fromEntries(Object.entries(patch).filter(([k]) => !NEW_COLS.includes(k)));
      if (Object.keys(legacy).length === 0) return { ok: true };
      const retry = await sb.from("tech_assessment_items").update(legacy).eq("id", itemId);
      if (retry.error) return { error: retry.error.message };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "update failed" };
  }
  revalidatePath("/admin/tech-assessment/items");
  return { ok: true };
}

/** Set/refresh the documented passing standard (cut-score) for a domain. */
export async function setCutScoreAction(input: {
  domainKey: string;
  passPct: number;
  minItems: number;
  method?: string | null;
  rationale?: string | null;
  /** Per-instance time limit (minutes); null/0 = no limit. */
  timeLimitMinutes?: number | null;
}) {
  const g = await guard();
  if ("error" in g) return g;
  if (!techDomainByKey(input.domainKey)) return { error: "unknown domain" };

  const passPct = Math.max(1, Math.min(100, Math.round(Number(input.passPct))));
  const minItems = Math.max(1, Math.min(50, Math.round(Number(input.minItems))));

  // Per-instance time limit (best-effort; tolerant of 00083 absence).
  if (input.timeLimitMinutes !== undefined) {
    const m = input.timeLimitMinutes && input.timeLimitMinutes > 0 ? Math.round(input.timeLimitMinutes) : null;
    await setTimerMinutes(`tech_domain:${input.domainKey}`, m);
  }

  try {
    const sb = createServiceClient();
    const { error } = await sb.from("tech_assessment_cut_scores").upsert(
      {
        domain_key: input.domainKey,
        pass_pct: passPct,
        min_items: minItems,
        method: input.method ?? null,
        rationale: input.rationale ?? null,
        set_by_name: reviewerName(g.caller),
        set_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "domain_key" }
    );
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "save failed" };
  }
  revalidatePath("/admin/tech-assessment/items");
  return { ok: true };
}

// ════════════ Taxonomy + behavioural-bridge editor (migration 00054) ════════════

const UUID_RE = /^[0-9a-fA-F-]{36}$/;

/** Edit a domain's display names (the FK `key` is immutable). */
export async function updateDomainMetaAction(input: { domainKey: string; nameEn: string; nameAr?: string | null }) {
  const g = await guard();
  if ("error" in g) return g;
  if (!techDomainByKey(input.domainKey)) return { error: "unknown domain" };
  const nameEn = input.nameEn.trim();
  if (!nameEn) return { error: "name required" };

  try {
    const sb = createServiceClient();
    const { error } = await sb
      .from("technical_domains")
      .update({ name_en: nameEn, name_ar: input.nameAr?.trim() || null })
      .eq("key", input.domainKey);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "save failed" };
  }
  revalidatePath("/admin/tech-assessment/items");
  return { ok: true };
}

/** Map a behavioural competency to a domain (the domain ENABLES it). Idempotent
 *  on (domain_key, competency_id) - re-adding just updates the weight. */
export async function addBridgeAction(input: { domainKey: string; competencyId: string; weight: number }) {
  const g = await guard();
  if ("error" in g) return g;
  if (!techDomainByKey(input.domainKey)) return { error: "unknown domain" };
  if (!UUID_RE.test(input.competencyId)) return { error: "invalid competency" };
  const weight = Math.max(1, Math.min(3, Math.round(Number(input.weight)) || 1));

  try {
    const sb = createServiceClient();
    const { error } = await sb.from("technical_domain_competencies").upsert(
      { domain_key: input.domainKey, competency_id: input.competencyId, relation: "enables", weight },
      { onConflict: "domain_key,competency_id" }
    );
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "save failed" };
  }
  revalidatePath("/admin/tech-assessment/items");
  return { ok: true };
}

/** Change the contribution weight (1–3) of an existing bridge row. */
export async function setBridgeWeightAction(input: { id: string; weight: number }) {
  const g = await guard();
  if ("error" in g) return g;
  if (!UUID_RE.test(input.id)) return { error: "invalid id" };
  const weight = Math.max(1, Math.min(3, Math.round(Number(input.weight)) || 1));

  try {
    const sb = createServiceClient();
    const { error } = await sb.from("technical_domain_competencies").update({ weight }).eq("id", input.id);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "save failed" };
  }
  revalidatePath("/admin/tech-assessment/items");
  return { ok: true };
}

/** Remove a domain→competency mapping. */
export async function removeBridgeAction(input: { id: string }) {
  const g = await guard();
  if ("error" in g) return g;
  if (!UUID_RE.test(input.id)) return { error: "invalid id" };

  try {
    const sb = createServiceClient();
    const { error } = await sb.from("technical_domain_competencies").delete().eq("id", input.id);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "delete failed" };
  }
  revalidatePath("/admin/tech-assessment/items");
  return { ok: true };
}
