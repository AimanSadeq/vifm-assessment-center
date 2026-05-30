"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError, type AraCaller } from "@/lib/ara/auth-guards";
import { draftAiItemsToBank } from "@/lib/competencies/technical-item-bank";
import { techDomainByKey, type TechDomainKey } from "@/lib/competencies/technical-framework";
import type { BankItemStatus } from "@/lib/competencies/technical-item-bank";

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
  revalidatePath("/admin/tech-assessment");
  return { ok: true, inserted: res.inserted };
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
  revalidatePath("/admin/tech-assessment");
  return { ok: true };
}

export type EditItemFields = {
  skill?: string;
  question_en?: string;
  question_ar?: string | null;
  options_en?: string[];
  options_ar?: string[] | null;
  correct_index?: number;
  difficulty?: "easy" | "medium" | "hard";
  explanation_en?: string | null;
};

/** Edit an item's content (a human refining an AI draft). */
export async function updateItemAction(itemId: string, fields: EditItemFields) {
  const g = await guard();
  if ("error" in g) return g;

  // Validate the option/correct shape if those fields are present.
  if (fields.options_en) {
    if (!Array.isArray(fields.options_en) || fields.options_en.length !== 4) {
      return { error: "exactly 4 options required" };
    }
  }
  if (fields.correct_index != null && (fields.correct_index < 0 || fields.correct_index > 3)) {
    return { error: "correct_index must be 0–3" };
  }

  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) patch[k] = v;
  }
  if (Object.keys(patch).length === 0) return { ok: true };

  try {
    const sb = createServiceClient();
    const { error } = await sb.from("tech_assessment_items").update(patch).eq("id", itemId);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "update failed" };
  }
  revalidatePath("/admin/tech-assessment");
  return { ok: true };
}

/** Set/refresh the documented passing standard (cut-score) for a domain. */
export async function setCutScoreAction(input: {
  domainKey: string;
  passPct: number;
  minItems: number;
  method?: string | null;
  rationale?: string | null;
}) {
  const g = await guard();
  if ("error" in g) return g;
  if (!techDomainByKey(input.domainKey)) return { error: "unknown domain" };

  const passPct = Math.max(1, Math.min(100, Math.round(Number(input.passPct))));
  const minItems = Math.max(1, Math.min(50, Math.round(Number(input.minItems))));

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
  revalidatePath("/admin/tech-assessment");
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
  revalidatePath("/admin/tech-assessment");
  return { ok: true };
}

/** Map a behavioural competency to a domain (the domain ENABLES it). Idempotent
 *  on (domain_key, competency_id) — re-adding just updates the weight. */
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
  revalidatePath("/admin/tech-assessment");
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
  revalidatePath("/admin/tech-assessment");
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
  revalidatePath("/admin/tech-assessment");
  return { ok: true };
}
