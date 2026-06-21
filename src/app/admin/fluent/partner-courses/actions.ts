"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";

// Server actions for the partner English-course catalogue (migration 00146).
// Every action is admin-gated; the table is the pluggable source the Fluent
// report's recommender reads. All writes go through the service client.

type ActionResult = { ok: true } | { ok: false; error: string };

async function gateAdmin(): Promise<ActionResult | null> {
  try {
    await requireRole(["admin"]);
    return null;
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false, error: "Not authorised." };
    throw e;
  }
}

const addSchema = z.object({
  provider: z.string().trim().min(1).max(40).default("se_academy"),
  provider_label: z.string().trim().max(120).optional().nullable(),
  code: z.string().trim().max(40).optional().nullable(),
  title_en: z.string().trim().min(1, "A course title is required.").max(300),
  title_ar: z.string().trim().max(300).optional().nullable(),
  description_en: z.string().trim().max(2000).optional().nullable(),
  cefr_levels: z.array(z.enum(["A1", "A2", "B1", "B2", "C1", "C2"])).default([]),
  focus_skill: z.enum(["reading", "listening", "writing", "speaking", "general"]).optional().nullable(),
  url: z.string().trim().max(500).optional().nullable(),
  sort_order: z.coerce.number().int().optional().default(0),
});

export async function addPartnerCourseAction(input: unknown): Promise<ActionResult> {
  const gate = await gateAdmin();
  if (gate) return gate;

  const parsed = addSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please complete the required fields." };
  }
  const d = parsed.data;
  const sb = createServiceClient();
  const { error } = await sb.from("partner_courses").insert({
    provider: d.provider || "se_academy",
    provider_label: d.provider_label || null,
    code: d.code || null,
    title_en: d.title_en,
    title_ar: d.title_ar || null,
    description_en: d.description_en || null,
    cefr_levels: d.cefr_levels ?? [],
    focus_skill: d.focus_skill || null,
    url: d.url || null,
    sort_order: d.sort_order ?? 0,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/fluent/partner-courses");
  return { ok: true };
}

export async function togglePartnerCourseAction(id: string, active: boolean): Promise<ActionResult> {
  const gate = await gateAdmin();
  if (gate) return gate;
  const sb = createServiceClient();
  const { error } = await sb.from("partner_courses").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/fluent/partner-courses");
  return { ok: true };
}

export async function deletePartnerCourseAction(id: string): Promise<ActionResult> {
  const gate = await gateAdmin();
  if (gate) return gate;
  const sb = createServiceClient();
  const { error } = await sb.from("partner_courses").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/fluent/partner-courses");
  return { ok: true };
}
