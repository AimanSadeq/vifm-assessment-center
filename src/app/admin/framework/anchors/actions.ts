"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/ara/auth-guards";
import { draftScaleAnchors } from "@/lib/ai/scale-anchor-drafter";

// B19 (BPS 4.31) - admin maintenance of the scale-point anchors. Every write is
// admin-only. An edit makes the text VIFM's own ('manual') and returns it to
// 'pending', because a changed anchor is not the one an expert approved.

const PATH = "/admin/framework/anchors";
const uuid = z.string().regex(/^[0-9a-f-]{36}$/i);

async function reviewerName(uid: string): Promise<string> {
  const sb = createServiceClient();
  const { data } = await sb.from("profiles").select("full_name, email").eq("id", uid).maybeSingle<{ full_name: string | null; email: string | null }>();
  return data?.full_name?.trim() || data?.email || "VIFM admin";
}

export async function saveAnchorAction(input: { id: string; anchorEn: string; anchorAr: string }) {
  await requireRole(["admin"]);
  const p = z
    .object({ id: uuid, anchorEn: z.string().trim().min(10).max(600), anchorAr: z.string().trim().max(900) })
    .safeParse(input);
  if (!p.success) return { error: "An anchor needs 10-600 characters of English." };
  const sb = createServiceClient();
  const { error } = await sb
    .from("competency_scale_anchors")
    .update({
      anchor_en: p.data.anchorEn,
      anchor_ar: p.data.anchorAr || null,
      source: "manual",
      sme_status: "pending",
      sme_reviewer_name: null,
      sme_reviewed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", p.data.id);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: true as const };
}

export async function reviewAnchorsAction(input: { ids: string[]; status: "approved" | "rejected" | "pending" }) {
  const caller = await requireRole(["admin"]);
  const p = z.object({ ids: z.array(uuid).min(1).max(200), status: z.enum(["approved", "rejected", "pending"]) }).safeParse(input);
  if (!p.success) return { error: "Nothing to review." };
  const name = p.data.status === "pending" ? null : await reviewerName(caller.uid);
  const sb = createServiceClient();
  const { error } = await sb
    .from("competency_scale_anchors")
    .update({
      sme_status: p.data.status,
      sme_reviewer_name: name,
      sme_reviewed_at: p.data.status === "pending" ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("id", p.data.ids);
  if (error) return { error: error.message };
  revalidatePath(PATH);
  return { ok: true as const };
}

/** Redraft one competency's anchors with AI. Only anchors still PENDING are
 *  replaced - an approved anchor is never overwritten by a draft. */
export async function redraftAnchorsAction(input: { competencyId: string }) {
  await requireRole(["admin"]);
  const p = z.object({ competencyId: uuid }).safeParse(input);
  if (!p.success) return { error: "Unknown competency." };
  const sb = createServiceClient();
  const [{ data: comp }, { data: inds }, { data: existing }] = await Promise.all([
    sb.from("competencies").select("id, name, description").eq("id", p.data.competencyId).maybeSingle<{ id: string; name: string; description: string | null }>(),
    sb.from("behavioral_indicators").select("indicator_type, description").neq("sme_status", "rejected").eq("competency_id", p.data.competencyId),
    sb.from("competency_scale_anchors").select("id, scale_point, sme_status").eq("competency_id", p.data.competencyId),
  ]);
  if (!comp) return { error: "Unknown competency." };
  const real = (inds ?? []).filter((i) => !String(i.description).startsWith("[DEV TIP]"));
  const drafts = await draftScaleAnchors({
    name: comp.name,
    definition: comp.description,
    positives: real.filter((i) => i.indicator_type === "positive").map((i) => i.description as string),
    negatives: real.filter((i) => i.indicator_type === "negative").map((i) => i.description as string),
  });
  if (!drafts) return { error: "The AI draft did not come back complete. Try again, or edit the anchors by hand." };
  const byPoint = new Map((existing ?? []).map((a) => [a.scale_point as number, a]));
  let replaced = 0;
  for (const d of drafts) {
    const row = byPoint.get(d.scale_point);
    if (row && row.sme_status === "approved") continue;
    const values = { anchor_en: d.anchor_en, anchor_ar: d.anchor_ar, source: "ai_draft", sme_status: "pending", sme_reviewer_name: null, sme_reviewed_at: null, updated_at: new Date().toISOString() };
    const { error } = row
      ? await sb.from("competency_scale_anchors").update(values).eq("id", row.id)
      : await sb.from("competency_scale_anchors").insert({ ...values, competency_id: comp.id, scale_point: d.scale_point });
    if (error) return { error: error.message };
    replaced += 1;
  }
  revalidatePath(PATH);
  return { ok: true as const, replaced };
}
