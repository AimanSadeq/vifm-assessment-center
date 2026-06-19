import { createClient, createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { GuidedStart } from "./_components/guided-start";

export const dynamic = "force-dynamic";

/**
 * Guided Start - the additive "front door". It does NOT replace any module's own
 * create flow; it offers a choice at the top (guided wizard vs. set it up myself)
 * and, in the wizard branch, diagnoses the requirement and creates inline
 * (reusing the module's server action) or hands off to that module's create page.
 */
export default async function StartPage() {
  const supabase = await createClient();
  const svc = createServiceClient();
  // Loaded for the inline create paths. Each is best-effort so a missing
  // module/table can't break the wizard - that path just degrades to a handoff.
  const [
    orgsRes, profilesRes, araOrgsRes, araVersionRes, reflectTplRes,
    domainsRes, clustersRes, compsRes, exercisesRes,
  ] = await Promise.all([
    supabase.from("organizations").select("id, name").order("name"),
    supabase.from("role_profiles").select("id, name_en, role_profile_competencies(competency_id)").order("name_en"),
    svc.from("ara_organizations").select("id, name, region, sector").order("name"),
    svc.from("ara_question_bank_versions").select("id").eq("is_active", true).maybeSingle(),
    svc.from("reflect_frameworks").select("id, name_en").is("engagement_id", null).eq("is_template", true).order("name_en"),
    supabase.from("competency_domains").select("id, name, sort_order"),
    supabase.from("competency_clusters").select("id, domain_id"),
    supabase.from("competencies").select("id, name, cluster_id, sort_order").order("sort_order"),
    supabase.from("exercises").select("id, name, exercise_type").order("name"),
  ]);

  // Flatten competencies → { id, name, domain } for the inline AC builder.
  const domainById = new Map((domainsRes.data ?? []).map((d) => [d.id as string, d as { name: string; sort_order: number }]));
  const clusterDomain = new Map((clustersRes.data ?? []).map((c) => [c.id as string, c.domain_id as string]));
  const acCompetencies = ((compsRes.data ?? []) as { id: string; name: string; cluster_id: string }[]).map((c) => {
    const d = domainById.get(clusterDomain.get(c.cluster_id) ?? "");
    return { id: c.id, name: c.name, domain: d?.name ?? "OTHER", domainSort: d?.sort_order ?? 99 };
  });

  const acRoleProfiles = ((profilesRes.data ?? []) as unknown as {
    id: string; name_en: string; role_profile_competencies: { competency_id: string }[] | null;
  }[]).map((p) => ({
    id: p.id,
    name_en: p.name_en,
    competencyIds: (p.role_profile_competencies ?? []).map((rc) => rc.competency_id),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <BackLink href="/admin" label="Back to dashboard" />
      <GuidedStart
        organizations={(orgsRes.data ?? []) as { id: string; name: string }[]}
        roleProfiles={(profilesRes.data ?? []) as { id: string; name_en: string }[]}
        araOrgs={(araOrgsRes.data ?? []) as { id: string; name: string; region: string; sector: string }[]}
        araVersionId={(araVersionRes.data?.id as string | undefined) ?? null}
        reflectTemplates={(reflectTplRes.data ?? []) as { id: string; name_en: string }[]}
        acCompetencies={acCompetencies}
        acExercises={(exercisesRes.data ?? []) as { id: string; name: string; exercise_type: string }[]}
        acRoleProfiles={acRoleProfiles}
      />
    </div>
  );
}
