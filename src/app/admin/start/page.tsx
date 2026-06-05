import { createClient, createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { GuidedStart } from "./_components/guided-start";

export const dynamic = "force-dynamic";

/**
 * Guided Start — the additive "front door". It does NOT replace any module's own
 * create flow; it offers a choice at the top (guided wizard vs. set it up myself)
 * and, in the wizard branch, diagnoses the requirement and either creates inline
 * (reusing the module's server action) or hands off to that module's create page.
 */
export default async function StartPage() {
  const supabase = await createClient();
  const svc = createServiceClient();
  // Loaded for the inline create paths (Pre-Hire orgs/profiles; ARA orgs + the
  // active question-bank version). Each is best-effort so a missing module/table
  // can't break the wizard — that path just falls back to a handoff.
  const [orgsRes, profilesRes, araOrgsRes, araVersionRes, reflectTplRes] = await Promise.all([
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("role_profiles").select("id, name_en").order("name_en"),
    svc.from("ara_organizations").select("id, name, region, sector").order("name"),
    svc.from("ara_question_bank_versions").select("id").eq("is_active", true).maybeSingle(),
    svc.from("reflect_frameworks").select("id, name_en").is("engagement_id", null).eq("is_template", true).order("name_en"),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <BackLink href="/admin" label="Back to dashboard" />
      <GuidedStart
        organizations={(orgsRes.data ?? []) as { id: string; name: string }[]}
        roleProfiles={(profilesRes.data ?? []) as { id: string; name_en: string }[]}
        araOrgs={(araOrgsRes.data ?? []) as { id: string; name: string; region: string; sector: string }[]}
        araVersionId={(araVersionRes.data?.id as string | undefined) ?? null}
        reflectTemplates={(reflectTplRes.data ?? []) as { id: string; name_en: string }[]}
      />
    </div>
  );
}
