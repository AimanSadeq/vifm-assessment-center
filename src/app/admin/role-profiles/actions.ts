"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const roleProfileFormSchema = z.object({
  name_en: z.string().min(2, "Name is required").max(120),
  name_ar: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  target_role: z.string().max(120).optional(),
  industry: z.string().max(60).optional(),
  region: z.enum(["uae", "saudi", "gcc", "global"]).optional(),
  default_target_proficiency: z.coerce.number().min(1).max(5).optional(),
  source_jd: z.string().max(20000).optional(),
  organization_id: z.string().uuid().optional(),
});

const competencySchema = z.object({
  competency_id: z.string().uuid(),
  weight: z.coerce.number().min(0.5).max(10).optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  reasoning: z.string().max(500).optional(),
});

export async function createRoleProfileAction(input: {
  profile: unknown;
  competencies: unknown[];
}) {
  const profileParsed = roleProfileFormSchema.safeParse(input.profile);
  if (!profileParsed.success) {
    return { error: profileParsed.error.flatten().formErrors.join("; ") || "Invalid profile" };
  }
  const compsParsed = z.array(competencySchema).min(1, "Pick at least one competency").safeParse(input.competencies);
  if (!compsParsed.success) {
    return { error: compsParsed.error.flatten().formErrors.join("; ") || "Invalid competency list" };
  }

  const supabase = await createClient();

  const { data: profile, error: pErr } = await supabase
    .from("role_profiles")
    .insert({
      ...profileParsed.data,
      organization_id: profileParsed.data.organization_id ?? null,
    })
    .select("id")
    .single();

  if (pErr || !profile) return { error: pErr?.message ?? "Could not create profile" };

  const rows = compsParsed.data.map((c) => ({
    role_profile_id: profile.id,
    competency_id: c.competency_id,
    weight: c.weight ?? null,
    priority: c.priority ?? null,
    reasoning: c.reasoning ?? null,
  }));

  const { error: cErr } = await supabase.from("role_profile_competencies").insert(rows);
  if (cErr) {
    await supabase.from("role_profiles").delete().eq("id", profile.id);
    return { error: `Competencies: ${cErr.message}` };
  }

  revalidatePath("/admin/role-profiles");
  return { data: { id: profile.id } };
}

export async function updateRoleProfileAction(
  id: string,
  input: { profile: unknown; competencies: unknown[] }
) {
  const profileParsed = roleProfileFormSchema.safeParse(input.profile);
  if (!profileParsed.success) {
    return { error: profileParsed.error.flatten().formErrors.join("; ") || "Invalid profile" };
  }
  const compsParsed = z.array(competencySchema).min(1, "Pick at least one competency").safeParse(input.competencies);
  if (!compsParsed.success) {
    return { error: compsParsed.error.flatten().formErrors.join("; ") || "Invalid competency list" };
  }

  const supabase = await createClient();

  const { error: pErr } = await supabase
    .from("role_profiles")
    .update({
      ...profileParsed.data,
      organization_id: profileParsed.data.organization_id ?? null,
    })
    .eq("id", id);
  if (pErr) return { error: pErr.message };

  await supabase.from("role_profile_competencies").delete().eq("role_profile_id", id);

  const rows = compsParsed.data.map((c) => ({
    role_profile_id: id,
    competency_id: c.competency_id,
    weight: c.weight ?? null,
    priority: c.priority ?? null,
    reasoning: c.reasoning ?? null,
  }));
  const { error: cErr } = await supabase.from("role_profile_competencies").insert(rows);
  if (cErr) return { error: `Competencies: ${cErr.message}` };

  revalidatePath("/admin/role-profiles");
  revalidatePath(`/admin/role-profiles/${id}`);
  return { data: { id } };
}

export async function deleteRoleProfileAction(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("role_profiles").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/role-profiles");
  return { ok: true };
}
