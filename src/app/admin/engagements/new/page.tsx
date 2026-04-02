import { createServiceClient } from "@/lib/supabase/server";
import type {
  CompetencyTree,
  Organization,
  Exercise,
} from "@/types/database";
import { EngagementWizard } from "./_components/engagement-wizard";

async function fetchWizardData() {
  const supabase = createServiceClient();

  const [orgsResult, domainsResult, clustersResult, compsResult, exercisesResult] =
    await Promise.all([
      supabase.from("organizations").select("*").order("name"),
      supabase.from("competency_domains").select("*").order("sort_order"),
      supabase.from("competency_clusters").select("*").order("sort_order"),
      supabase.from("competencies").select("*").order("sort_order"),
      supabase.from("exercises").select("*").order("name"),
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

  return { organizations, competencyTree, exercises };
}

export default async function NewEngagementPage() {
  const { organizations, competencyTree, exercises } = await fetchWizardData();

  return (
    <div>
      <h1 className="text-2xl font-bold">New Engagement</h1>
      <p className="mt-1 text-muted-foreground">
        Create a new assessment center engagement in 5 steps.
      </p>
      <div className="mt-6">
        <EngagementWizard
          organizations={organizations}
          competencyTree={competencyTree}
          exercises={exercises}
        />
      </div>
    </div>
  );
}
