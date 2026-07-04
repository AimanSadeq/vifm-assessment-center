"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole, isAuthorizationError, type AraCaller } from "@/lib/ara/auth-guards";
import { sendAraRespondentInvitation } from "@/lib/ara/actions";
import { validateTalentLens } from "@/lib/constants/ara-individual-factors";

async function requireConsultant(): Promise<{ ok: false; error: string } | { ok: true; caller: AraCaller }> {
  try {
    const caller = await requireRole(["admin", "consultant"]);
    return { ok: true, caller };
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
  // Demo runs (from the Talent-Acquisition selection landing's "Demo mode")
  // are flagged sandbox so they show the Test badge, are purgeable, and unlock
  // the respondent-side "Simulate answers" shortcut. Defaults false - a real
  // consultant-issued deep-dive never sets it.
  is_sandbox: z.coerce.boolean().optional(),
  // When set, DON'T email the candidate their link - the issuer keeps it to
  // themselves (e.g. a hiring manager running it privately). Only ever set to
  // skip; absent means "email as normal", so the consultant deep-dive page
  // (which never sends it) keeps its existing send-on-issue behaviour.
  skip_email: z.coerce.boolean().optional(),
});

const PERSONAL_ORG_FALLBACK_NAME_EN = "Personal AI Readiness - Deep Dive";
const PERSONAL_ORG_FALLBACK_NAME_AR = "الجاهزية الشخصية للذكاء الاصطناعي - التحليل المعمّق";

/**
 * Consultant-issued 60-item Personal AI Readiness deep-dive.
 *
 * Used when a paying HR client wants research-grade individual reads
 * on a named employee (different from the free, anonymous snapshot at
 * /ara/personal/start).
 *
 * Behaviour:
 *   - Caller must be admin or consultant (enforced via requireRole).
 *   - Reuses an existing organisation if a UUID is passed; otherwise
 *     creates a "Personal AI Readiness - Deep Dive" org so deep-dives
 *     don't clutter the consultant-side org list. The consultant can
 *     supply organization_name to brand the row to a paying client.
 *   - Pins the assessment to assessment_tier='deep_dive' and the
 *     active question bank version; respondent answers the full 60
 *     individual-factor items (15 per factor: self-rating + scenario +
 *     knowledge-check).
 *   - Returns the access URL so the consultant can copy/paste or send
 *     it directly to the employee.
 */
export async function createDeepDivePersonalAssessment(
  formData: FormData
): Promise<
  | { ok: false; error: string }
  | { ok: true; respondentUrl: string; assessmentId: string; respondentId: string; emailed: boolean }
> {
  const auth = await requireConsultant();
  if (!auth.ok) return auth;
  const caller = auth.caller;

  const parsed = inputSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    language: formData.get("language") ?? "en",
    region: formData.get("region") ?? "uae",
    organization_id: formData.get("organization_id") || undefined,
    organization_name: formData.get("organization_name") || undefined,
    is_sandbox: formData.get("is_sandbox") || undefined,
    skip_email: formData.get("skip_email") || undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Talent lens (migration 00134), captured from the launching pillar via
  // ?lens=. Validated to 'acquisition' | 'development' | null.
  const talentLens = validateTalentLens(formData.get("lens"));

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

  const assessmentPayload: Record<string, unknown> = {
    organization_id: orgId,
    // Bind to the issuing consultant so they can open their own assessment under
    // requireAssessmentOwner (admins bypass ownership regardless). Was null,
    // which locked a consultant issuer out of their own Mode B deep-dive.
    consultant_id: caller.uid,
    region: parsed.data.region,
    sector: "general",
    default_language: parsed.data.language,
    is_sandbox: parsed.data.is_sandbox ?? false,
    engagement_stage: "individual",
    assessment_tier: "deep_dive",
    include_individual_layer: false,
    scope_label: parsed.data.full_name,
    question_bank_version_id: activeBank.id,
    status: "active",
    phase: "phase1",
    // Talent lens (migration 00134). Only included when set, so the insert
    // still works on a DB without the column (stripped on retry).
    ...(talentLens ? { talent_lens: talentLens } : {}),
  };
  let { data: assessment, error: assessErr } = await sb
    .from("ara_assessments")
    .insert(assessmentPayload)
    .select("id")
    .single<{ id: string }>();
  // Tolerant strip+retry when migration 00134 is not applied (42703 / PGRST204).
  if (assessErr) {
    const code = (assessErr as { code?: string }).code;
    if ((code === "42703" || code === "PGRST204") && talentLens) {
      const { talent_lens: _omit, ...withoutLens } = assessmentPayload;
      void _omit;
      ({ data: assessment, error: assessErr } = await sb
        .from("ara_assessments")
        .insert(withoutLens)
        .select("id")
        .single<{ id: string }>());
    }
  }
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
  // the URL back to share manually if the send fails. Skipped when skip_email
  // is set, so a hiring manager can issue a link and keep it to themselves
  // without notifying the candidate.
  let emailed = false;
  if (!parsed.data.skip_email) {
    try {
      const sent = await sendAraRespondentInvitation(respondent.id);
      emailed = !!sent && "ok" in sent && sent.ok === true;
    } catch {
      /* non-blocking: issuance succeeds even if email send fails */
    }
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
