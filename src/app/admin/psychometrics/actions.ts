"use server";

// SME item-bank actions for the Psychometrics Tier-2 console. All admin-gated and
// service-role (the bank tables are admin-RLS). Under AUTH_ENABLED=false
// requireRole returns a synthetic admin so dev work continues.

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError, type AraCaller } from "@/lib/ara/auth-guards";
import { resolveScaleId, type PsyKind, type PsyItemStatus } from "@/lib/psychometrics/bank";
import { COGNITIVE_FACET_KEYS, COGNITIVE_SUBTEST_KEYS, subtestForFacet } from "@/lib/psychometrics/framework";
import { COGNITIVE_SEED_V1 } from "@/lib/psychometrics/cognitive-seed";
import { draftScaleItems } from "@/lib/psychometrics/item-drafter";
import { computePilotNorms, clearNorms } from "@/lib/psychometrics/norms";
import { PSY_TIER } from "@/lib/psychometrics/calibration";
import { IPIP_50 } from "@/lib/psychometrics/ipip50";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
type AdminGate = { ok: true; caller: AraCaller } | { ok: false; error: string };

async function ensureAdmin(): Promise<AdminGate> {
  try {
    const caller = await requireRole(["admin"]);
    return { ok: true, caller };
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false, error: "Not authorized." };
    throw e;
  }
}

const STATUSES: PsyItemStatus[] = ["draft", "in_review", "approved", "retired", "rejected"];

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
    drafted_by: gate.caller.uid,
  }));
  const svc = createServiceClient();
  const { error } = await svc.from("psy_items").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/psychometrics");
  return { ok: true, message: `Drafted ${rows.length} item(s) for review.` };
}

/**
 * Move an item through the review lifecycle. APPROVING enforces the two-person
 * gate (the approver must differ from the drafter - bypassed only for the dev
 * synthetic admin) and requires a cognitive item to carry a blueprint facet, and
 * stamps reviewer identity. REJECTING records an optional reason + reviewer.
 */
export async function setItemStatusAction(input: { itemId: string; status: PsyItemStatus; reason?: string }): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  if (!STATUSES.includes(input.status)) return { ok: false, error: "Invalid status." };
  const svc = createServiceClient();

  if (input.status === "approved" || input.status === "rejected") {
    const { data: item } = await svc
      .from("psy_items")
      .select("drafted_by, facet, kind")
      .eq("id", input.itemId)
      .maybeSingle<{ drafted_by: string | null; facet: string | null; kind: string }>();
    if (!item) return { ok: false, error: "Item not found." };

    if (input.status === "approved") {
      // Cognitive (mcq) items must be slotted to a blueprint facet before they can
      // serve - otherwise the assembler can never draw them.
      if (item.kind === "mcq" && !item.facet) {
        return { ok: false, error: "Set a blueprint facet on this item before approving it." };
      }
      // Two-person review: the approver must not be the drafter (dev bypass only).
      if (!gate.caller.isDev && item.drafted_by && item.drafted_by === gate.caller.uid) {
        return { ok: false, error: "Two-person review: this item must be approved by someone other than its drafter." };
      }
    }

    const patch: Record<string, unknown> = {
      status: input.status,
      reviewed_by: gate.caller.uid,
      reviewed_at: new Date().toISOString(),
    };
    if (input.status === "rejected") patch.rejected_reason = input.reason?.trim() || null;
    const { error } = await svc.from("psy_items").update(patch).eq("id", input.itemId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/admin/psychometrics");
    return { ok: true };
  }

  const { error } = await svc.from("psy_items").update({ status: input.status }).eq("id", input.itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/psychometrics");
  return { ok: true };
}

/** Manually author an item. Lands in 'in_review' (drafted_by = author) so a
 *  second reviewer approves it - single-admin self-approval is not allowed. */
export async function addItemAction(input: {
  kind: PsyKind;
  scaleKey: string;
  facet?: string | null;
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

  // Cognitive items must be slotted to a valid blueprint facet whose subtest
  // matches the scale, so the assembler can compose them.
  let facet: string | null = null;
  if (input.kind === "cognitive") {
    facet = (input.facet ?? "").trim() || null;
    if (!facet || !COGNITIVE_FACET_KEYS.has(facet)) return { ok: false, error: "Choose a valid blueprint facet." };
    if (subtestForFacet(facet) !== input.scaleKey) return { ok: false, error: "That facet does not belong to this subtest." };
  }

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
    facet,
    stem_en,
    stem_ar: input.stem_ar.trim() || stem_en,
    options_en,
    options_ar,
    correct_index,
    reverse_keyed: itemKind === "likert" ? !!input.reverse_keyed : false,
    difficulty: itemKind === "mcq" ? (input.difficulty ?? "medium") : null,
    status: "in_review",
    source: "manual",
    drafted_by: gate.caller.uid,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/psychometrics");
  return { ok: true, message: "Item added for review." };
}

/** Edit an item's wording/key/facet. Editing an APPROVED item sends it back to
 *  'in_review' (its prior approval no longer covers the new wording). */
export async function updateItemAction(input: {
  itemId: string;
  stem_en?: string;
  stem_ar?: string;
  facet?: string | null;
  correct_index?: number | null;
  reverse_keyed?: boolean;
  difficulty?: "easy" | "medium" | "hard" | null;
}): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  const patch: Record<string, unknown> = {};
  if (typeof input.stem_en === "string" && input.stem_en.trim()) patch.stem_en = input.stem_en.trim();
  if (typeof input.stem_ar === "string") patch.stem_ar = input.stem_ar.trim() || null;
  if (typeof input.facet === "string" && input.facet.trim()) {
    const f = input.facet.trim();
    if (!COGNITIVE_FACET_KEYS.has(f)) return { ok: false, error: "Invalid facet." };
    patch.facet = f;
  }
  if (typeof input.correct_index === "number") patch.correct_index = input.correct_index;
  if (typeof input.reverse_keyed === "boolean") patch.reverse_keyed = input.reverse_keyed;
  if (input.difficulty === null || ["easy", "medium", "hard"].includes(input.difficulty ?? "")) patch.difficulty = input.difficulty ?? null;
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update." };

  const svc = createServiceClient();
  const { data: cur } = await svc.from("psy_items").select("status").eq("id", input.itemId).maybeSingle<{ status: string }>();
  // A wording/key edit invalidates a prior approval - send it back to review.
  if (cur?.status === "approved") {
    patch.status = "in_review";
    patch.reviewed_by = null;
    patch.reviewed_at = null;
  }
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
 *  as APPROVED items - the longer validated form. Idempotent (skips if present). */
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

/** Seed the vetted VIFM cognitive bank (120 items, 4 subtests x 3 facets, EN+AR)
 *  as APPROVED items - the readiness seed that lets Logica serve the reviewed
 *  bank immediately instead of live-AI. Idempotent (keyed on source='seed_v1').
 *  Arabic lands ar_reviewed=false (machine-drafted MSA pending a human pass). */
export async function seedCognitiveBankAction(): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  const svc = createServiceClient();

  const { count } = await svc.from("psy_items").select("id", { count: "exact", head: true }).eq("source", "seed_v1");
  if ((count ?? 0) > 0) return { ok: true, message: `Cognitive seed already loaded (${count} items).` };

  const scaleIds: Record<string, string> = {};
  for (const key of COGNITIVE_SUBTEST_KEYS) {
    const id = await resolveScaleId("cognitive", key);
    if (!id) return { ok: false, error: "Could not resolve cognitive subtests. Apply migration 00065 (psychometrics)." };
    scaleIds[key] = id;
  }

  const rows = COGNITIVE_SEED_V1.map((it) => ({
    scale_id: scaleIds[it.subtest],
    kind: "mcq",
    facet: it.facet,
    stem_en: it.stem_en,
    stem_ar: it.stem_ar,
    options_en: it.options_en,
    options_ar: it.options_ar,
    correct_index: it.correct_index,
    reverse_keyed: false,
    difficulty: it.difficulty,
    rationale: it.rationale_en ?? null,
    ar_reviewed: false,
    status: "approved",
    source: "seed_v1",
  }));
  const { error } = await svc.from("psy_items").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/psychometrics");
  return { ok: true, message: `Seeded ${rows.length} vetted cognitive items (approved). Arabic is pending a human MSA review.` };
}

/** Toggle the Arabic-reviewed quality flag on an item (human MSA sign-off). */
export async function setItemArReviewedAction(input: { itemId: string; value: boolean }): Promise<ActionResult> {
  const gate = await ensureAdmin();
  if (!gate.ok) return gate;
  const svc = createServiceClient();
  const { error } = await svc.from("psy_items").update({ ar_reviewed: !!input.value }).eq("id", input.itemId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/psychometrics");
  return { ok: true };
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
