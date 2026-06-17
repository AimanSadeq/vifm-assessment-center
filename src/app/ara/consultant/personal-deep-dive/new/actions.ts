"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { sendAraRespondentInvitation } from "@/lib/ara/actions";

async function requireConsultant() {
  try {
    await requireRole(["admin", "consultant"]);
    return null;
  } catch (e) {
    if (isAuthorizationError(e)) return { ok: false as const, error: e.message };
    throw e;
  }
}

const inputSchema = z.object({
  full_name: z.string().min(2).max(200),
  email: z.string().email().max(200),
  language: z.enum(["en", "ar"]).default("en"),
  region: z.enum(["uae", "saudi"]).default("uae"),
  organization_id: z.string().uuid().optional(),
  organization_name: z.string().min(2).max(300).optional(),
});

const PERSONAL_ORG_FALLBACK_NAME_EN = "Personal AI Readiness - Deep Dive";
const PERSONAL_ORG_FALLBACK_NAME_AR = "الجاهزية الشخصية للذكاء الاصطناعي - التحليل المعمّق";

/**
 * Consultant-issued 48-item Personal AI Readiness deep-dive.
 *
 * Used when a paying HR client wants research-grade individual reads
 * on a named employee (different from the free 24-item snapshot at
 * /ara/personal/start, which is anonymous).
 *
 * Behaviour:
 *   - Caller must be admin or consultant (enforced via requireRole).
 *   - Reuses an existing organisation if a UUID is passed; otherwise
 *     creates a "Personal AI Readiness - Deep Dive" org so deep-dives
 *     don't clutter the consultant-side org list. The consultant can
 *     supply organization_name to brand the row to a paying client.
 *   - Pins the assessment to assessment_tier='deep_dive' and the
 *     active question bank version; respondent answers the full 48
 *     individual-factor items.
 *   - Returns the access URL so the consultant can copy/paste or send
 *     it directly to the employee.
 */
export async function createDeepDivePersonalAssessment(
  formData: FormData
): Promise<
  | { ok: false; error: string }
  | { ok: true; respondentUrl: string; assessmentId: string; respondentId: string; emailed: boolean }
> {
  const denied = await requireConsultant();
  if (denied) return denied;

  const parsed = inputSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    language: formData.get("language") ?? "en",
    region: formData.get("region") ?? "uae",
    organization_id: formData.get("organization_id") || undefined,
    organization_name: formData.get("organization_name") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const sb = createServiceClient();

  // Org: explicit UUID → reuse; explicit name → create; neither →
  // fall back to the shared "Deep Dive" org so consultants without a
  // client context still have somewhere to land.
  let orgId: string | null = parsed.data.organization_id ?? null;
  if (!orgId) {
    const orgName = parsed.data.organization_name ?? PERSONAL_ORG_FALLBACK_NAME_EN;
    const { data: existing } = await sb
      .from("ara_organizations")
      .select("id")
      .eq("name", orgName)
      .maybeSingle<{ id: string }>();
    if (existing) {
      orgId = existing.id;
    } else {
      const { data: created, error: orgErr } = await sb
        .from("ara_organizations")
        .insert({
          name: orgName,
          name_ar: parsed.data.organization_name ? null : PERSONAL_ORG_FALLBACK_NAME_AR,
          region: parsed.data.region,
          sector: "general",
        })
        .select("id")
        .single<{ id: string }>();
      if (orgErr || !created) {
        return { ok: false, error: orgErr?.message ?? "Could not provision org" };
      }
      orgId = created.id;
    }
  }

  const { data: activeBank } = await sb
    .from("ara_question_bank_versions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle<{ id: string }>();
  if (!activeBank) {
    return { ok: false, error: "No active question bank - admin needs to publish one first." };
  }

  const { data: assessment, error: assessErr } = await sb
    .from("ara_assessments")
    .insert({
      organization_id: orgId,
      consultant_id: null, // Set explicitly to caller in a future hardening pass.
      region: parsed.data.region,
      sector: "general",
      default_language: parsed.data.language,
      is_sandbox: false,
      engagement_stage: "individual",
      assessment_tier: "deep_dive",
      include_individual_layer: false,
      scope_label: parsed.data.full_name,
      question_bank_version_id: activeBank.id,
      status: "active",
      phase: "phase1",
    })
    .select("id")
    .single<{ id: string }>();
  if (assessErr || !assessment) {
    return { ok: false, error: assessErr?.message ?? "Could not create deep-dive assessment" };
  }

  const { data: respondent, error: respErr } = await sb
    .from("ara_respondents")
    .insert({
      assessment_id: assessment.id,
      name: parsed.data.full_name,
      email: parsed.data.email,
      language_preference: parsed.data.language,
    })
    .select("id, access_token")
    .single<{ id: string; access_token: string }>();
  if (respErr || !respondent) {
    await sb.from("ara_assessments").delete().eq("id", assessment.id);
    return { ok: false, error: respErr?.message ?? "Could not create respondent" };
  }

  // M2.1: email the respondent their secure link (best-effort - the deep-dive
  // was issued to this person's email, so send the invitation automatically).
  // Sandbox redirect / console-mock protect non-prod; the consultant also gets
  // the URL back to share manually if the send fails.
  let emailed = false;
  try {
    const sent = await sendAraRespondentInvitation(respondent.id);
    emailed = !!sent && "ok" in sent && sent.ok === true;
  } catch {
    /* non-blocking: issuance succeeds even if email send fails */
  }

  revalidatePath("/ara/consultant");
  return {
    ok: true,
    respondentUrl: `/ara/respond/${respondent.access_token}`,
    assessmentId: assessment.id,
    respondentId: respondent.id,
    emailed,
  };
}
