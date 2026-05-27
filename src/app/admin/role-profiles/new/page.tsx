import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import type { CompetencyTree } from "@/types/database";
import { BackLink } from "@/components/shared/back-link";
import {
  RoleProfileEditor,
  EMPTY_PROFILE_INITIAL,
} from "../_components/role-profile-editor";

async function loadCompetencyTree(): Promise<CompetencyTree> {
  const supabase = await createClient();
  const [domains, clusters, comps] = await Promise.all([
    supabase.from("competency_domains").select("*").order("sort_order"),
    supabase.from("competency_clusters").select("*").order("sort_order"),
    supabase.from("competencies").select("*").order("sort_order"),
  ]);
  const domainRows = domains.data ?? [];
  const clusterRows = clusters.data ?? [];
  const compRows = comps.data ?? [];
  return domainRows.map((domain) => ({
    domain,
    clusters: clusterRows
      .filter((c) => c.domain_id === domain.id)
      .map((cluster) => ({
        cluster,
        competencies: compRows.filter((cp) => cp.cluster_id === cluster.id),
      })),
  }));
}

export const dynamic = "force-dynamic";

export default async function NewRoleProfilePage() {
  const tree = await loadCompetencyTree();
  const t = await getServerT();

  return (
    <div className="space-y-4">
      <BackLink href="/admin/role-profiles" label={t("adminRoleProfiles.backToList")} />
      <div>
        <h1 className="text-2xl font-bold">{t("adminRoleProfiles.new.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {t("adminRoleProfiles.new.subtitle")}
        </p>
      </div>
      <RoleProfileEditor initial={EMPTY_PROFILE_INITIAL} competencyTree={tree} mode="create" />
    </div>
  );
}
