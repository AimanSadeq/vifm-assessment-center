"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { createAraUseCaseSchema } from "@/lib/validations/ara";
import { requireAssessmentOwner, isAuthorizationError } from "@/lib/ara/auth-guards";
import type { AraRespondent } from "@/types/ara";

function authErr(e: unknown) {
  if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
  throw e;
}

// ─────────────────────────────────────────────────────────────
// Respondent-facing: add/remove their own use case via access token.
// ─────────────────────────────────────────────────────────────
async function requireRespondent(token: string): Promise<AraRespondent> {
  const sb = createServiceClient();
  const { data } = await sb
    .from("ara_respondents")
    .select("*")
    .eq("access_token", token)
    .maybeSingle<AraRespondent>();
  if (!data) throw new Error("Invalid access token");
  return data;
}

export async function addAraUseCaseAsRespondent(input: {
  token: string;
  name: string;
  description?: string;
  stage: "ideation" | "piloting" | "production" | "retired";
  pillar_id?: string | null;
  risk_level: "low" | "medium" | "high" | "critical";
  value_level: "low" | "medium" | "high";
  business_owner?: string;
  technical_owner?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const respondent = await requireRespondent(input.token);

  const parsed = createAraUseCaseSchema.safeParse({
    assessment_id: respondent.assessment_id,
    name: input.name,
    description: input.description ?? "",
    stage: input.stage,
    pillar_id: input.pillar_id ?? null,
    risk_level: input.risk_level,
    value_level: input.value_level,
    business_owner: input.business_owner ?? "",
    technical_owner: input.technical_owner ?? "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const sb = createServiceClient();
  const { error } = await sb.from("ara_use_cases").insert({
    assessment_id: respondent.assessment_id,
    respondent_id: respondent.id,
    name: parsed.data.name,
    description: parsed.data.description || null,
    stage: parsed.data.stage,
    pillar_id: parsed.data.pillar_id || null,
    risk_level: parsed.data.risk_level,
    value_level: parsed.data.value_level,
    business_owner: parsed.data.business_owner || null,
    technical_owner: parsed.data.technical_owner || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/ara/respond/${input.token}`);
  revalidatePath(`/ara/consultant/assessments/${respondent.assessment_id}`);
  return { ok: true };
}

export async function removeAraUseCaseAsRespondent(
  useCaseId: string,
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const respondent = await requireRespondent(token);
  const sb = createServiceClient();

  // Respondents can only remove their own use cases
  const { data: uc } = await sb
    .from("ara_use_cases")
    .select("id, assessment_id, respondent_id")
    .eq("id", useCaseId)
    .maybeSingle<{ id: string; assessment_id: string; respondent_id: string | null }>();

  if (!uc) return { ok: false, error: "Use case not found" };
  if (uc.respondent_id && uc.respondent_id !== respondent.id) {
    return { ok: false, error: "Not permitted" };
  }

  const { error } = await sb.from("ara_use_cases").delete().eq("id", useCaseId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/ara/respond/${token}`);
  revalidatePath(`/ara/consultant/assessments/${uc.assessment_id}`);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────
// Consultant-facing: add/remove use cases directly.
// ─────────────────────────────────────────────────────────────
export async function addAraUseCaseAsConsultant(formData: FormData) {
  const assessmentId = String(formData.get("assessment_id") ?? "");
  if (!assessmentId) return { ok: false, error: "Missing assessment id" };
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }
  const parsed = createAraUseCaseSchema.safeParse({
    assessment_id: formData.get("assessment_id"),
    name: formData.get("name"),
    description: formData.get("description") || "",
    stage: formData.get("stage"),
    pillar_id: formData.get("pillar_id") || null,
    risk_level: formData.get("risk_level"),
    value_level: formData.get("value_level"),
    business_owner: formData.get("business_owner") || "",
    technical_owner: formData.get("technical_owner") || "",
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const sb = createServiceClient();
  const { error } = await sb.from("ara_use_cases").insert({
    assessment_id: parsed.data.assessment_id,
    respondent_id: null,
    name: parsed.data.name,
    description: parsed.data.description || null,
    stage: parsed.data.stage,
    pillar_id: parsed.data.pillar_id || null,
    risk_level: parsed.data.risk_level,
    value_level: parsed.data.value_level,
    business_owner: parsed.data.business_owner || null,
    technical_owner: parsed.data.technical_owner || null,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/ara/consultant/assessments/${parsed.data.assessment_id}`);
  return { ok: true };
}

export async function removeAraUseCase(useCaseId: string, assessmentId: string) {
  try { await requireAssessmentOwner(assessmentId); } catch (e) { return authErr(e); }
  const sb = createServiceClient();
  // Verify the use case belongs to this assessment
  const { data: uc } = await sb
    .from("ara_use_cases")
    .select("id")
    .eq("id", useCaseId)
    .eq("assessment_id", assessmentId)
    .maybeSingle<{ id: string }>();
  if (!uc) return { ok: false, error: "Use case not found on this assessment" };
  const { error } = await sb.from("ara_use_cases").delete().eq("id", useCaseId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/ara/consultant/assessments/${assessmentId}`);
  return { ok: true };
}
