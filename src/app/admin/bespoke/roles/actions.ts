"use server";

import { revalidatePath } from "next/cache";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { publishRoleReadinessService, unpublishRoleReadinessService } from "@/lib/bespoke/services";
import {
  extractCompetenciesFromJobDescription,
  extractCompetenciesFromJdPdf,
  type ExtractedCompetencyRecommendation,
} from "@/lib/ai/jd-competency-extractor";
import type { Competency } from "@/types/database";

type Res = { ok: true; id?: string } | { error: string };

async function requireAdmin() {
  try {
    return await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) return null;
    throw e;
  }
}

export async function createJobFamilyAction(input: { nameEn: string; nameAr?: string }): Promise<Res> {
  if (!(await requireAdmin())) return { error: "Not authorized." };
  const name = (input.nameEn || "").trim();
  if (name.length < 2) return { error: "Enter a job family name." };
  const sb = createServiceClient();
  const { error } = await sb.from("job_families").insert({ name_en: name, name_ar: input.nameAr?.trim() || null });
  if (error) return { error: error.message };
  revalidatePath("/admin/bespoke/roles");
  return { ok: true };
}

export async function createRoleAction(input: {
  jobFamilyId: string | null;
  nameEn: string;
  nameAr?: string;
  personaPassPct?: number;
  technicalPassPct?: number;
}): Promise<Res> {
  if (!(await requireAdmin())) return { error: "Not authorized." };
  const name = (input.nameEn || "").trim();
  if (name.length < 2) return { error: "Enter a role name." };
  const sb = createServiceClient();

  // 1:1 role_profile holds the behavioural competencies + per-competency targets.
  const { data: rp, error: rpErr } = await sb
    .from("role_profiles")
    .insert({ name_en: name, name_ar: input.nameAr?.trim() || null, default_target_proficiency: 3 })
    .select("id")
    .single();
  if (rpErr || !rp) return { error: rpErr?.message ?? "Could not create role profile." };

  const { data: rc, error: rcErr } = await sb
    .from("rr_role_configs")
    .insert({
      job_family_id: input.jobFamilyId,
      role_profile_id: rp.id,
      name_en: name,
      name_ar: input.nameAr?.trim() || null,
      persona_pass_pct: input.personaPassPct ?? 60,
      technical_pass_pct: input.technicalPassPct ?? 60,
      status: "draft",
    })
    .select("id")
    .single();
  if (rcErr || !rc) return { error: rcErr?.message ?? "Could not create role." };
  revalidatePath("/admin/bespoke/roles");
  return { ok: true, id: rc.id as string };
}

export async function updateRoleAction(input: {
  roleId: string;
  nameEn?: string;
  nameAr?: string;
  personaPassPct?: number;
  technicalPassPct?: number;
  status?: "draft" | "active" | "archived";
}): Promise<Res> {
  if (!(await requireAdmin())) return { error: "Not authorized." };
  const sb = createServiceClient();
  const patch: Record<string, unknown> = {};
  if (input.nameEn != null) patch.name_en = input.nameEn.trim();
  if (input.nameAr !== undefined) patch.name_ar = input.nameAr?.trim() || null;
  if (input.personaPassPct != null) patch.persona_pass_pct = Math.max(0, Math.min(100, input.personaPassPct));
  if (input.technicalPassPct != null) patch.technical_pass_pct = Math.max(0, Math.min(100, input.technicalPassPct));
  if (input.status) patch.status = input.status;
  const { error } = await sb.from("rr_role_configs").update(patch).eq("id", input.roleId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/bespoke/roles/${input.roleId}`);
  return { ok: true };
}

export async function setCompetenciesAction(input: {
  roleId: string;
  items: Array<{ competencyId: string; target: number }>;
}): Promise<Res> {
  if (!(await requireAdmin())) return { error: "Not authorized." };
  const sb = createServiceClient();
  const { data: rc } = await sb.from("rr_role_configs").select("role_profile_id").eq("id", input.roleId).maybeSingle();
  const rpId = rc?.role_profile_id as string | null;
  if (!rpId) return { error: "Role has no profile." };

  await sb.from("role_profile_competencies").delete().eq("role_profile_id", rpId);
  const rows = input.items
    .filter((i) => i.competencyId)
    .map((i) => ({
      role_profile_id: rpId,
      competency_id: i.competencyId,
      target_proficiency: Math.max(1, Math.min(5, i.target || 3)),
    }));
  if (rows.length > 0) {
    const { error } = await sb.from("role_profile_competencies").insert(rows);
    if (error) return { error: error.message };
  }
  revalidatePath(`/admin/bespoke/roles/${input.roleId}`);
  return { ok: true };
}

export async function addAreaAction(input: {
  roleId: string;
  nameEn: string;
  nameAr?: string;
  targetPct?: number;
  suggestionEn?: string;
}): Promise<Res> {
  if (!(await requireAdmin())) return { error: "Not authorized." };
  const name = (input.nameEn || "").trim();
  if (name.length < 2) return { error: "Enter an area name." };
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("rr_technical_areas")
    .insert({
      role_config_id: input.roleId,
      name_en: name,
      name_ar: input.nameAr?.trim() || null,
      target_pct: Math.max(0, Math.min(100, input.targetPct ?? 60)),
      suggestion_en: input.suggestionEn?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not add area." };
  revalidatePath(`/admin/bespoke/roles/${input.roleId}`);
  return { ok: true, id: data.id as string };
}

export async function removeAreaAction(input: { roleId: string; areaId: string }): Promise<Res> {
  if (!(await requireAdmin())) return { error: "Not authorized." };
  const sb = createServiceClient();
  const { error } = await sb.from("rr_technical_areas").delete().eq("id", input.areaId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/bespoke/roles/${input.roleId}`);
  return { ok: true };
}

export async function addItemAction(input: {
  roleId: string;
  areaId: string;
  stemEn: string;
  optionsEn: string[];
  correctIndex: number;
}): Promise<Res> {
  if (!(await requireAdmin())) return { error: "Not authorized." };
  const stem = (input.stemEn || "").trim();
  const opts = (input.optionsEn || []).map((o) => o.trim()).filter(Boolean);
  if (stem.length < 3) return { error: "Enter a question." };
  if (opts.length < 2) return { error: "Provide at least two options." };
  if (input.correctIndex < 0 || input.correctIndex >= opts.length) return { error: "Mark the correct option." };
  const sb = createServiceClient();
  const { error } = await sb.from("rr_technical_items").insert({
    area_id: input.areaId,
    stem_en: stem,
    options_en: opts,
    correct_index: input.correctIndex,
  });
  if (error) return { error: error.message };
  revalidatePath(`/admin/bespoke/roles/${input.roleId}`);
  return { ok: true };
}

export async function removeItemAction(input: { roleId: string; itemId: string }): Promise<Res> {
  if (!(await requireAdmin())) return { error: "Not authorized." };
  const sb = createServiceClient();
  const { error } = await sb.from("rr_technical_items").delete().eq("id", input.itemId);
  if (error) return { error: error.message };
  revalidatePath(`/admin/bespoke/roles/${input.roleId}`);
  return { ok: true };
}

export async function publishRoleAction(input: {
  roleId: string;
  nameEn: string;
  nameAr?: string;
  description?: string;
  organizationId?: string | null;
}): Promise<Res> {
  if (!(await requireAdmin())) return { error: "Not authorized." };
  const sb = createServiceClient();
  await sb.from("rr_role_configs").update({ status: "active" }).eq("id", input.roleId);
  const res = await publishRoleReadinessService({
    roleConfigId: input.roleId,
    nameEn: input.nameEn,
    nameAr: input.nameAr ?? null,
    description: input.description ?? null,
    organizationId: input.organizationId ?? null,
  });
  if ("error" in res) return { error: res.error };
  revalidatePath("/admin/bespoke/roles");
  revalidatePath(`/admin/bespoke/roles/${input.roleId}`);
  return { ok: true };
}

export async function unpublishRoleAction(input: { roleId: string }): Promise<Res> {
  if (!(await requireAdmin())) return { error: "Not authorized." };
  const sb = createServiceClient();
  await sb.from("rr_role_configs").update({ status: "draft" }).eq("id", input.roleId);
  await unpublishRoleReadinessService(input.roleId);
  revalidatePath("/admin/bespoke/roles");
  revalidatePath(`/admin/bespoke/roles/${input.roleId}`);
  return { ok: true };
}

/** Create an invite candidate for a role and return the apply link. */
export async function inviteRoleCandidateAction(input: {
  roleId: string;
  fullName: string;
  email: string;
  organizationId?: string | null;
}): Promise<{ ok: true; token: string } | { error: string }> {
  if (!(await requireAdmin())) return { error: "Not authorized." };
  const name = (input.fullName || "").trim();
  const email = (input.email || "").trim();
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Enter a name and a valid email." };
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("rr_candidates")
    .insert({
      role_config_id: input.roleId,
      organization_id: input.organizationId ?? null,
      full_name: name,
      email,
      invited_at: new Date().toISOString(),
    })
    .select("access_token")
    .single();
  if (error || !data) return { error: error?.message ?? "Could not create candidate." };
  return { ok: true, token: data.access_token as string };
}

// Match a job description to the VIFM 41-competency framework. Reuses the existing
// P0.1 extractor (Claude picks the 6-12 most relevant competencies, with priority
// + reasoning). Accepts pasted text OR an uploaded PDF (base64).
export async function matchCompetenciesFromJdAction(input: {
  jobDescription?: string;
  pdfBase64?: string;
  targetRole?: string;
}): Promise<{ ok: true; recommendations: ExtractedCompetencyRecommendation[] } | { error: string }> {
  if (!(await requireAdmin())) return { error: "Not authorized." };
  const sb = createServiceClient();
  const { data } = await sb.from("competencies").select("id, name, description").order("sort_order");
  const competencies = (data ?? []) as unknown as Competency[];
  if (competencies.length === 0) return { error: "No competency framework found." };

  let recs: ExtractedCompetencyRecommendation[] | null = null;
  if (input.pdfBase64) {
    recs = await extractCompetenciesFromJdPdf({ pdfBase64: input.pdfBase64, targetRole: input.targetRole, competencies });
  } else if (input.jobDescription?.trim()) {
    recs = await extractCompetenciesFromJobDescription({ jobDescription: input.jobDescription, targetRole: input.targetRole, competencies });
  } else {
    return { error: "Paste a job description or upload a file first." };
  }
  if (recs === null) return { error: "AI matching is unavailable right now - select competencies manually." };
  return { ok: true, recommendations: recs };
}
