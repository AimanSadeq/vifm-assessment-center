import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CompetencyTree } from "@/types/database";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import {
  RoleProfileEditor,
  type RoleProfileEditorInitial,
} from "../_components/role-profile-editor";
import { DeleteRoleProfileButton } from "./_components/delete-button";

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

type Props = { params: { id: string } };

export default async function RoleProfileDetailPage({ params }: Props) {
  const supabase = await createClient();
  const [profileResult, compsResult, treeData] = await Promise.all([
    supabase.from("role_profiles").select("*").eq("id", params.id).maybeSingle(),
    supabase
      .from("role_profile_competencies")
      .select("*")
      .eq("role_profile_id", params.id),
    loadCompetencyTree(),
  ]);

  if (profileResult.error || !profileResult.data) return notFound();
  const p = profileResult.data;
  const compRows = compsResult.data ?? [];

  const initial: RoleProfileEditorInitial = {
    id: p.id,
    profile: {
      name_en: p.name_en ?? "",
      name_ar: p.name_ar ?? "",
      description: p.description ?? "",
      target_role: p.target_role ?? "",
      industry: p.industry ?? "",
      region: (p.region ?? "") as RoleProfileEditorInitial["profile"]["region"],
      default_target_proficiency: p.default_target_proficiency ?? 3,
      source_jd: p.source_jd ?? "",
    },
    competencies: compRows.map((c) => ({
      competency_id: c.competency_id,
      weight: c.weight,
      priority: c.priority,
      reasoning: c.reasoning ?? "",
    })),
  };

  return (
    <div className="space-y-4">
      <BackLink href="/admin/role-profiles" label="Back to Role Profiles" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{p.name_en}</h1>
          {p.name_ar && (
            <p className="text-sm text-muted-foreground mt-1" dir="rtl">
              {p.name_ar}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/api/role-profiles/${p.id}/export`}
            download
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </Button>
          </a>
          <DeleteRoleProfileButton id={p.id} name={p.name_en} />
        </div>
      </div>
      <RoleProfileEditor initial={initial} competencyTree={treeData} mode="edit" />
    </div>
  );
}
