import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * G6 — JSON export of a role profile + its linked competencies.
 *
 * Output shape mirrors what an admin needs to review the profile offline
 * or re-import it into another VIFM environment. Adds a metadata wrapper
 * so the file is self-describing (export schema version, exported_at).
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();

  const [profileResult, compsResult] = await Promise.all([
    supabase
      .from("role_profiles")
      .select(
        "id, name_en, name_ar, description, target_role, industry, region, default_target_proficiency, source_jd, organization_id, created_at, updated_at, organizations(name)"
      )
      .eq("id", params.id)
      .single(),
    supabase
      .from("role_profile_competencies")
      .select(
        "competency_id, weight, priority, reasoning, competencies(name, cluster_id, competency_clusters(name, competency_domains(name)))"
      )
      .eq("role_profile_id", params.id),
  ]);

  if (profileResult.error || !profileResult.data) {
    return NextResponse.json(
      { error: "Role profile not found." },
      { status: 404 }
    );
  }

  const p = profileResult.data;
  const compRows = compsResult.data ?? [];

  const competencies = compRows.map((row) => {
    const c = row.competencies as unknown as
      | {
          name: string;
          cluster_id: string;
          competency_clusters: {
            name: string;
            competency_domains: { name: string } | null;
          } | null;
        }
      | null;
    return {
      competency_id: row.competency_id,
      competency_name: c?.name ?? null,
      cluster: c?.competency_clusters?.name ?? null,
      domain: c?.competency_clusters?.competency_domains?.name ?? null,
      weight: row.weight,
      priority: row.priority,
      reasoning: row.reasoning,
    };
  });

  const payload = {
    schema: "vifm-role-profile-export@v1",
    exported_at: new Date().toISOString(),
    profile: {
      id: p.id,
      name_en: p.name_en,
      name_ar: p.name_ar,
      description: p.description,
      target_role: p.target_role,
      industry: p.industry,
      region: p.region,
      default_target_proficiency: p.default_target_proficiency,
      source_jd: p.source_jd,
      organization_id: p.organization_id,
      organization_name:
        (p.organizations as unknown as { name?: string } | null)?.name ?? null,
      created_at: p.created_at,
      updated_at: p.updated_at,
    },
    competencies,
  };

  const filename =
    `vifm-role-profile-${(p.name_en ?? "profile")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
