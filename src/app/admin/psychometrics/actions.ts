"use server";

// SME item-bank actions for the Psychometrics Tier-2 console. All admin-gated and
// service-role (the bank tables are admin-RLS). Under AUTH_ENABLED=false
// requireRole returns a synthetic admin so dev work continues.

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { resolveScaleId, type PsyKind, type PsyItemStatus } from "@/lib/psychometrics/bank";
import { draftScaleItems } from "@/lib/psychometrics/item-drafter";
import { computePilotNorms, clearNorms } from "@/lib/psychometrics/norms";
import { PSY_TIER } from "@/lib/psychometrics/calibration";
import { IPIP_50 } from "@/lib/psychometrics/ipip50";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function ensureAdmin(): Promise<ActionResult> {
  try {
    await requireRole(["admin"]);
    return { ok: true };
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false, error: "Not authorized." };
    throw e;
  }
}

const STATUSES: PsyItemStatus[] = ["draft", "in_review", "approved", "retired"];

/** AI-draft `count` items for one scale into the bank as status='draft'. */
export async function draftItemsIntoBankAction(input: {
  kind: PsyKind;
  scaleKey: string;
  scaleNameEn: string;
  count: number;
}): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;

  const drafted = await draftScaleItems({
    instrumentKind: input.kind,
    scaleKey: input.scaleKey,
    scaleNameEn: input.scaleNameEn,
    count: input.count,
  });
  if (!drafted.length) {
    return { ok: false, error: "No items drafted. Set ANTHROPIC_API_KEY to enable AI drafting, or add items manually." };
  }
  const scaleId = await resolveScaleId(input.kind, input.scaleKey);
  if (!scaleId) return { ok: false, error: "Could not resolve the scale. Apply migration 00065 (psychometrics)." };

  const rows = drafted.map((d) => ({
    scale_id: scaleId,
    kind: d.kind,
    stem_en: d.stem_en,
    stem_ar: d.stem_ar,
    options_en: d.options_en,
    options_ar: d.options_ar,
    correct_index: d.correct_index,
    reverse_keyed: d.reverse_keyed,
    difficulty: d.difficulty,
    status: "draft",
    source: "ai_draft",
  }));
  const svc = createServiceClient();
  const { error } = await svc.from("psy_items").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/psychometrics");
  return { ok: true, message: `Drafted ${rows.length} item(s) for review.` };
}

/** Move an item through the review lifecycle (draft → approved / retired / …). */
export async function setItemStatusAction(input: { itemId: string; status: PsyItemStatus }): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  if (!STATUSES.includes(input.status)) return { ok: false, error: "Invalid status." };
  const svc = createServiceClient();
  const { error } = await svc.from("psy_items").update({ status: input.status }).eq("id", input.itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/psychometrics");
  return { ok: true };
}

/** Manually author an item (SME-reviewed by definition → status='approved'). */
export async function addItemAction(input: {
  kind: PsyKind;
  scaleKey: string;
  stem_en: string;
  stem_ar: string;
  options_en?: string[];
  options_ar?: string[];
  correct_index?: number | null;
  reverse_keyed?: boolean;
  difficulty?: "easy" | "medium" | "hard" | null;
}): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;

  const stem_en = input.stem_en.trim();
  if (!stem_en) return { ok: false, error: "An English stem is required." };
  const itemKind = input.kind === "cognitive" ? "mcq" : "likert";

  let options_en: string[] | null = null;
  let options_ar: string[] | null = null;
  let correct_index: number | null = null;
  if (itemKind === "mcq") {
    options_en = (input.options_en ?? []).map((s) => s.trim()).filter(Boolean);
    options_ar = (input.options_ar ?? []).map((s) => s.trim()).filter(Boolean);
    if (options_en.length < 2) return { ok: false, error: "Provide at least two options." };
    if (options_ar.length !== options_en.length) options_ar = options_en;
    correct_index = typeof input.correct_index === "number" ? input.correct_index : 0;
    if (correct_index < 0 || correct_index >= options_en.length) return { ok: false, error: "Correct-option index is out of range." };
  }

  const scaleId = await resolveScaleId(input.kind, input.scaleKey);
  if (!scaleId) return { ok: false, error: "Could not resolve the scale. Apply migration 00065 (psychometrics)." };

  const svc = createServiceClient();
  const { error } = await svc.from("psy_items").insert({
    scale_id: scaleId,
    kind: itemKind,
    stem_en,
    stem_ar: input.stem_ar.trim() || stem_en,
    options_en,
    options_ar,
    correct_index,
    reverse_keyed: itemKind === "likert" ? !!input.reverse_keyed : false,
    difficulty: itemKind === "mcq" ? (input.difficulty ?? "medium") : null,
    status: "approved",
    source: "manual",
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/psychometrics");
  return { ok: true, message: "Item added." };
}

/** Edit a drafted/approved item's wording before approval (stems + key fields). */
export async function updateItemAction(input: {
  itemId: string;
  stem_en?: string;
  stem_ar?: string;
  correct_index?: number | null;
  reverse_keyed?: boolean;
  difficulty?: "easy" | "medium" | "hard" | null;
}): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  const patch: Record<string, unknown> = {};
  if (typeof input.stem_en === "string" && input.stem_en.trim()) patch.stem_en = input.stem_en.trim();
  if (typeof input.stem_ar === "string") patch.stem_ar = input.stem_ar.trim() || null;
  if (typeof input.correct_index === "number") patch.correct_index = input.correct_index;
  if (typeof input.reverse_keyed === "boolean") patch.reverse_keyed = input.reverse_keyed;
  if (input.difficulty === null || ["easy", "medium", "hard"].includes(input.difficulty ?? "")) patch.difficulty = input.difficulty ?? null;
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update." };
  const svc = createServiceClient();
  const { error } = await svc.from("psy_items").update(patch).eq("id", input.itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/psychometrics");
  return { ok: true };
}

/** Hard-delete an item (use for junk drafts; retire is preferred for used items). */
export async function deleteItemAction(input: { itemId: string }): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  const svc = createServiceClient();
  const { error } = await svc.from("psy_items").delete().eq("id", input.itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/psychometrics");
  return { ok: true };
}

/** Compute provisional pilot norms for an instrument from its collected results. */
export async function computePilotNormsAction(input: { kind: PsyKind }): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  const res = await computePilotNorms(input.kind);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/admin/psychometrics");
  const maxN = res.norms.reduce((m, n) => Math.max(m, n.n), 0);
  return { ok: true, message: `Pilot norms computed for ${res.norms.length} scale(s) (n up to ${maxN}). Norm-referencing activates per scale at n ≥ ${PSY_TIER.minNormN}.` };
}

/** Seed the public-domain IPIP-50 (10 items × 5 traits) into the personality bank
 *  as APPROVED items — the longer validated form. Idempotent (skips if present). */
export async function seedIpip50IntoBankAction(): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  const svc = createServiceClient();

  const { count } = await svc.from("psy_items").select("id", { count: "exact", head: true }).eq("source", "ipip50");
  if ((count ?? 0) > 0) return { ok: true, message: `IPIP-50 already seeded (${count} items).` };

  const scaleIds: Record<string, string> = {};
  for (const key of ["O", "C", "E", "A", "S"]) {
    const id = await resolveScaleId("personality", key);
    if (!id) return { ok: false, error: "Could not resolve personality scales. Apply migration 00065 (psychometrics)." };
    scaleIds[key] = id;
  }

  const rows = IPIP_50.map((it) => ({
    scale_id: scaleIds[it.scale],
    kind: "likert",
    stem_en: it.text_en,
    stem_ar: it.text_ar,
    options_en: null,
    options_ar: null,
    correct_index: null,
    reverse_keyed: it.reverse,
    difficulty: null,
    status: "approved",
    source: "ipip50",
  }));
  const { error } = await svc.from("psy_items").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/psychometrics");
  return { ok: true, message: `Seeded the IPIP-50 (${rows.length} items) into the personality bank as approved.` };
}

/** Remove all norm rows for an instrument (reverts it to Tier-1 indicative). */
export async function clearNormsAction(input: { kind: PsyKind }): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  const res = await clearNorms(input.kind);
  if (!res.ok) return { ok: false, error: res.error ?? "Could not clear norms." };
  revalidatePath("/admin/psychometrics");
  return { ok: true, message: "Norm group cleared." };
}
