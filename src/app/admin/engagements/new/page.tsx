import { createClient } from "@/lib/supabase/server";
import type {
  CompetencyTree,
  Organization,
  Exercise,
} from "@/types/database";
import { BackLink } from "@/components/shared/back-link";
import { EngagementWizard } from "./_components/engagement-wizard";
import type { RoleProfileSummary } from "./_components/role-profile-picker";

async function fetchWizardData() {
  const supabase = await createClient();

  const [orgsResult, domainsResult, clustersResult, compsResult, exercisesResult, profilesResult] =
    await Promise.all([
      supabase.from("organizations").select("*").order("name"),
      supabase.from("competency_domains").select("*").order("sort_order"),
      supabase.from("competency_clusters").select("*").order("sort_order"),
      supabase.from("competencies").select("*").order("sort_order"),
      supabase.from("exercises").select("*").order("name"),
      supabase
        .from("role_profiles")
        .select(
          "id, name_en, name_ar, target_role, industry, region, role_profile_competencies(competency_id, weight, priority, reasoning)"
        )
        .order("name_en"),
    ]);

  const organizations: Organization[] = orgsResult.data ?? [];
  const exercises: Exercise[] = exercisesResult.data ?? [];

  // Build competency tree: domain → cluster → competencies
  const domains = domainsResult.data ?? [];
  const clusters = clustersResult.data ?? [];
  const competencies = compsResult.data ?? [];

  const competencyTree: CompetencyTree = domains.map((domain) => ({
    domain,
    clusters: clusters
      .filter((c) => c.domain_id === domain.id)
      .map((cluster) => ({
        cluster,
        competencies: competencies.filter((comp) => comp.cluster_id === cluster.id),
      })),
  }));

  // role_profiles is optional — table may not exist yet if migration not pushed.
  const roleProfiles: RoleProfileSummary[] = profilesResult.error
    ? []
    : ((profilesResult.data ?? []) as unknown as RoleProfileSummary[]);

  return { organizations, competencyTree, exercises, roleProfiles };
}

export default async function NewEngagementPage() {
  const { organizations, competencyTree, exercises, roleProfiles } = await fetchWizardData();

  return (
    <div>
      <BackLink href="/admin/engagements" label="Back to Engagements" />
      <h1 className="mt-2 text-2xl font-bold">New Engagement</h1>
      <p className="mt-1 text-muted-foreground">
        Create a new assessment center engagement in 5 steps.
      </p>
      <div className="mt-6">
        <EngagementWizard
          organizations={organizations}
          competencyTree={competencyTree}
          exercises={exercises}
          roleProfiles={roleProfiles}
        />
      </div>
    </div>
  );
}
