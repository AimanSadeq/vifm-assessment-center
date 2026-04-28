"use server";

import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";

const startSchema = z.object({
  full_name: z.string().min(2).max(200),
  email: z.string().email().max(200),
  language: z.enum(["en", "ar"]).default("en"),
  region: z.enum(["uae", "saudi"]).default("uae"),
});

const PERSONAL_ORG_NAME_EN = "Personal AI Readiness";
const PERSONAL_ORG_NAME_AR = "الجاهزية الشخصية للذكاء الاصطناعي";

/**
 * Self-served entry point for the Personal AI Readiness Snapshot.
 * Anonymous (no auth required) — anyone with the URL can start one.
 *
 * Behaviour:
 *   1. Reuse a single shared "Personal AI Readiness" organisation
 *      so the personal-stage assessments don't pollute the
 *      consultant-side organisation list. Created lazily on the
 *      first run, found on every subsequent run.
 *   2. Pin the assessment to the active question bank version so
 *      it picks up the 16 individual-factor items from migration
 *      00026.
 *   3. Create a single respondent (the person themselves), generate
 *      a fresh access_token, and return the respondent URL so the
 *      client can router.push() into the respondent flow.
 *
 * Returns { ok: true, redirectTo } on success rather than calling
 * redirect() directly — calling redirect() inside a server action
 * that's invoked via useTransition() can silently swallow the
 * redirect because the transition wraps the throw. Returning the
 * URL and letting the client navigate sidesteps that whole class
 * of issue.
 *
 * The respondent loader (loadQuestionsForRespondent) detects
 * engagement_stage === 'individual' and serves only the four-factor
 * items, skipping the org-side pillar selection entirely.
 */
export async function startPersonalAssessmentAction(
  formData: FormData
): Promise<
  | { ok: false; error: string }
  | { ok: true; redirectTo: string }
> {
  const parsed = startSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    language: formData.get("language") ?? "en",
    region: formData.get("region") ?? "uae",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const sb = createServiceClient();

  // 1. Find or create the shared "Personal AI Readiness" org.
  const { data: existingOrg } = await sb
    .from("ara_organizations")
    .select("id")
    .eq("name", PERSONAL_ORG_NAME_EN)
    .maybeSingle<{ id: string }>();

  let orgId = existingOrg?.id;
  if (!orgId) {
    const { data: createdOrg, error: orgErr } = await sb
      .from("ara_organizations")
      .insert({
        name: PERSONAL_ORG_NAME_EN,
        name_ar: PERSONAL_ORG_NAME_AR,
        region: parsed.data.region,
        sector: "general",
      })
      .select("id")
      .single<{ id: string }>();
    if (orgErr || !createdOrg) {
      return {
        ok: false,
        error: orgErr?.message ?? "Could not provision the Personal organisation row",
      };
    }
    orgId = createdOrg.id;
  }

  // 2. Find the currently active question bank version.
  const { data: activeBank, error: bankErr } = await sb
    .from("ara_question_bank_versions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle<{ id: string }>();
  if (bankErr || !activeBank) {
    return {
      ok: false,
      error: "No active question bank — admin needs to publish one before personal assessments can run.",
    };
  }

  // 3. Insert assessment row in 'individual' stage. The Personal
  //    flow doesn't run a Phase 2 — it's Phase 1 only — so phase
  //    stays at default 'phase1'. consultant_id stays null because
  //    there's no consultant on a self-served flow.
  //    pillar_weights is omitted so the column's DEFAULT '{}' fires;
  //    individual-stage assessments don't use pillar weighting at all
  //    (they score against four factors, not eight pillars).
  const { data: assessment, error: assessErr } = await sb
    .from("ara_assessments")
    .insert({
      organization_id: orgId,
      consultant_id: null,
      region: parsed.data.region,
      sector: "general",
      default_language: parsed.data.language,
      is_sandbox: false,
      engagement_stage: "individual",
      scope_label: parsed.data.full_name,
      question_bank_version_id: activeBank.id,
      status: "active",
      phase: "phase1",
      // Explicit so future schema-default changes don't accidentally
      // up-tier the free flow into the paid 48-item bank.
      assessment_tier: "snapshot",
      include_individual_layer: false,
    })
    .select("id")
    .single<{ id: string }>();
  if (assessErr || !assessment) {
    return {
      ok: false,
      error: assessErr?.message ?? "Could not create the personal assessment row",
    };
  }

  // 4. Create the single respondent — themselves.
  const { data: respondent, error: respErr } = await sb
    .from("ara_respondents")
    .insert({
      assessment_id: assessment.id,
      name: parsed.data.full_name,
      email: parsed.data.email,
      language_preference: parsed.data.language,
    })
    .select("access_token")
    .single<{ access_token: string }>();
  if (respErr || !respondent) {
    // Clean up the orphan assessment so we don't leave drafts behind
    // on a failed start.
    await sb.from("ara_assessments").delete().eq("id", assessment.id);
    return {
      ok: false,
      error: respErr?.message ?? "Could not create the respondent row",
    };
  }

  return {
    ok: true,
    redirectTo: `/ara/respond/${respondent.access_token}`,
  };
}
