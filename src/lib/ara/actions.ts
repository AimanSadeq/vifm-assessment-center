"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import {
  createAraOrganizationSchema,
  createAraAssessmentSchema,
  createAraRespondentSchema,
  createAraVersionSchema,
  createAraQuestionSchema,
} from "@/lib/validations/ara";

// ─────────────────────────────────────────────────────────────
// Organizations
// ─────────────────────────────────────────────────────────────
export async function createAraOrganization(formData: FormData) {
  const parsed = createAraOrganizationSchema.safeParse({
    name: formData.get("name"),
    name_ar: formData.get("name_ar") || "",
    sector: formData.get("sector"),
    region: formData.get("region"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("ara_organizations")
    .insert({
      name: parsed.data.name,
      name_ar: parsed.data.name_ar || null,
      sector: parsed.data.sector,
      region: parsed.data.region,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ara/admin/organizations");
  redirect(`/ara/admin/organizations`);
  // unreachable — redirect throws
  return { ok: true, id: data.id };
}

export async function updateAraOrganization(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Missing organization id" };

  const parsed = createAraOrganizationSchema.safeParse({
    name: formData.get("name"),
    name_ar: formData.get("name_ar") || "",
    sector: formData.get("sector"),
    region: formData.get("region"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const sb = createServiceClient();
  const { error } = await sb
    .from("ara_organizations")
    .update({
      name: parsed.data.name,
      name_ar: parsed.data.name_ar || null,
      sector: parsed.data.sector,
      region: parsed.data.region,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/ara/admin/organizations");
  revalidatePath(`/ara/admin/organizations/${id}`);
  redirect("/ara/admin/organizations");
  return { ok: true };
}

export async function deleteAraOrganization(orgId: string) {
  const sb = createServiceClient();
  const { error } = await sb.from("ara_organizations").delete().eq("id", orgId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/ara/admin/organizations");
  redirect("/ara/admin/organizations");
  return { ok: true };
}

/**
 * Data-erasure operation required by UAE PDPL / Saudi PDPL / GDPR.
 * Replaces identifying fields on the organization AND all its
 * respondents with "[ANONYMIZED]", preserving structural data for
 * VIFM analytics. Writes an entry to the data management audit log.
 */
export async function anonymizeAraOrganization(orgId: string, reason: string) {
  const sb = createServiceClient();
  const now = new Date().toISOString();

  // 1. Anonymize organization name fields
  const { error: orgErr } = await sb
    .from("ara_organizations")
    .update({
      name: "[ANONYMIZED]",
      name_ar: "[ANONYMIZED]",
      data_anonymized: true,
      data_anonymized_at: now,
    })
    .eq("id", orgId);
  if (orgErr) return { ok: false, error: orgErr.message };

  // 2. Find all assessments for this org, then anonymize their respondents
  const { data: assessments } = await sb
    .from("ara_assessments")
    .select("id")
    .eq("organization_id", orgId);

  const assessmentIds = (assessments ?? []).map((a) => a.id);
  if (assessmentIds.length > 0) {
    await sb
      .from("ara_respondents")
      .update({
        name: "[ANONYMIZED]",
        name_ar: "[ANONYMIZED]",
        email: "anonymized@example.invalid",
      })
      .in("assessment_id", assessmentIds);
  }

  // 3. Audit log
  await sb.from("ara_data_management_log").insert({
    action: "anonymize_organization",
    target_table: "ara_organizations",
    target_id: orgId,
    reason,
    client_request: true,
    performed_at: now,
  });

  revalidatePath("/ara/admin/organizations");
  revalidatePath(`/ara/admin/organizations/${orgId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Assessments
// ─────────────────────────────────────────────────────────────
export async function createAraAssessment(formData: FormData) {
  const parsed = createAraAssessmentSchema.safeParse({
    organization_id: formData.get("organization_id"),
    region: formData.get("region"),
    sector: formData.get("sector"),
    default_language: formData.get("default_language"),
    is_sandbox: formData.get("is_sandbox") === "on",
    question_bank_version_id: formData.get("question_bank_version_id") || null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("ara_assessments")
    .insert({
      organization_id: parsed.data.organization_id,
      region: parsed.data.region,
      sector: parsed.data.sector,
      default_language: parsed.data.default_language,
      is_sandbox: parsed.data.is_sandbox,
      question_bank_version_id: parsed.data.question_bank_version_id || null,
      status: "draft",
      phase: "phase1",
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ara/consultant");
  redirect(`/ara/consultant/assessments/${data.id}`);
  return { ok: true, id: data.id };
}

// ─────────────────────────────────────────────────────────────
// Respondents
// ─────────────────────────────────────────────────────────────
export async function createAraRespondent(formData: FormData) {
  const pillars = formData.getAll("pillar_assignments") as string[];

  const parsed = createAraRespondentSchema.safeParse({
    assessment_id: formData.get("assessment_id"),
    name: formData.get("name"),
    name_ar: formData.get("name_ar") || "",
    email: formData.get("email"),
    role_key: formData.get("role_key") || "",
    role_label_en: formData.get("role_label_en") || "",
    role_label_ar: formData.get("role_label_ar") || "",
    language_preference: formData.get("language_preference"),
    pillar_assignments: pillars,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = createServiceClient();
  const { data: respondent, error } = await sb
    .from("ara_respondents")
    .insert({
      assessment_id: parsed.data.assessment_id,
      name: parsed.data.name,
      name_ar: parsed.data.name_ar || null,
      email: parsed.data.email,
      role_key: parsed.data.role_key || null,
      role_label_en: parsed.data.role_label_en || null,
      role_label_ar: parsed.data.role_label_ar || null,
      language_preference: parsed.data.language_preference,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  if (parsed.data.pillar_assignments.length > 0) {
    const { error: paError } = await sb
      .from("ara_respondent_pillar_assignments")
      .insert(
        parsed.data.pillar_assignments.map((pillar_id) => ({
          respondent_id: respondent.id,
          pillar_id,
        }))
      );
    if (paError) return { ok: false, error: paError.message };
  }

  revalidatePath(`/ara/consultant/assessments/${parsed.data.assessment_id}`);
  return { ok: true, id: respondent.id };
}

export async function deleteAraRespondent(respondentId: string, assessmentId: string) {
  const sb = createServiceClient();
  const { error } = await sb.from("ara_respondents").delete().eq("id", respondentId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/ara/consultant/assessments/${assessmentId}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Question bank versions
// ─────────────────────────────────────────────────────────────
export async function createAraVersion(formData: FormData) {
  const parsed = createAraVersionSchema.safeParse({
    version_number: formData.get("version_number"),
    version_label: formData.get("version_label") || "",
    release_notes: formData.get("release_notes") || "",
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("ara_question_bank_versions")
    .insert({
      version_number: parsed.data.version_number,
      version_label: parsed.data.version_label || null,
      release_notes: parsed.data.release_notes || null,
      is_active: false,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath("/ara/admin/questions");
  redirect(`/ara/admin/questions/${data.id}`);
  return { ok: true, id: data.id };
}

export async function publishAraVersion(versionId: string) {
  const sb = createServiceClient();
  // Deactivate all other versions first (the partial unique index enforces one active)
  const { error: deactErr } = await sb
    .from("ara_question_bank_versions")
    .update({ is_active: false })
    .neq("id", versionId);
  if (deactErr) return { ok: false, error: deactErr.message };

  const { error } = await sb
    .from("ara_question_bank_versions")
    .update({ is_active: true, published_at: new Date().toISOString() })
    .eq("id", versionId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/ara/admin/questions");
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Questions
// ─────────────────────────────────────────────────────────────
export async function createAraQuestion(formData: FormData) {
  // Options come in as JSON strings from the client form to keep the
  // FormData interface simple — no client-server array serialization dance.
  const optionsEnRaw = formData.get("options_en") as string | null;
  const optionsArRaw = formData.get("options_ar") as string | null;
  const scoreMapRaw = formData.get("score_map") as string | null;

  const parseJson = <T,>(raw: string | null): T | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  };

  const parsed = createAraQuestionSchema.safeParse({
    version_id: formData.get("version_id"),
    pillar_id: formData.get("pillar_id"),
    question_number: formData.get("question_number"),
    question_text_en: formData.get("question_text_en"),
    question_text_ar: formData.get("question_text_ar"),
    question_type: formData.get("question_type"),
    options_en: parseJson(optionsEnRaw),
    options_ar: parseJson(optionsArRaw),
    score_map: parseJson(scoreMapRaw),
    help_text_en: formData.get("help_text_en") || "",
    help_text_ar: formData.get("help_text_ar") || "",
    region: formData.get("region") || "both",
    sector: formData.get("sector") || "all",
    layer: Number(formData.get("layer") || 1) as 1 | 2,
    display_order: formData.get("display_order") || 0,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = createServiceClient();
  const { error } = await sb.from("ara_questions").insert({
    version_id: parsed.data.version_id,
    pillar_id: parsed.data.pillar_id,
    question_number: parsed.data.question_number,
    question_text_en: parsed.data.question_text_en,
    question_text_ar: parsed.data.question_text_ar,
    question_type: parsed.data.question_type,
    options_en: parsed.data.options_en,
    options_ar: parsed.data.options_ar,
    score_map: parsed.data.score_map,
    help_text_en: parsed.data.help_text_en || null,
    help_text_ar: parsed.data.help_text_ar || null,
    region: parsed.data.region,
    sector: parsed.data.sector,
    layer: parsed.data.layer,
    display_order: parsed.data.display_order,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/ara/admin/questions/${parsed.data.version_id}`);
  return { ok: true };
}
