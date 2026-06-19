import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { BackLink } from "@/components/shared/back-link";
import { resolvePlanOrgId } from "@/lib/start/resolve-plan-org";
import { RequisitionForm } from "./_components/requisition-form";

export const dynamic = "force-dynamic";

export default async function NewRequisitionPage({
  searchParams,
}: {
  searchParams?: { org?: string; orgName?: string };
}) {
  const supabase = await createClient();
  const t = await getServerT();
  const [profilesRes, orgsRes, compsRes] = await Promise.all([
    // CAL-PRE-502: also pull each profile's competencies so the form can pre-fill
    // the quiz competency picker when the role profile changes.
    supabase
      .from("role_profiles")
      .select("id, name_en, role_profile_competencies(competency_id, weight, priority)")
      .order("name_en"),
    supabase.from("organizations").select("id, name").order("name"),
    // Full behavioural-41 catalogue, grouped by domain in the picker.
    supabase
      .from("competencies")
      .select(
        "id, name, sort_order, competency_clusters(domain_id, competency_domains(id, name, sort_order))"
      )
      .order("sort_order"),
  ]);
  const organizations = (orgsRes.data ?? []) as { id: string; name: string }[];
  const defaultOrgId = resolvePlanOrgId(organizations, searchParams);

  // Flatten the competency catalogue into { id, name, domainName, domainSort } so
  // the client picker can render domain-grouped options without re-querying.
  type CompRow = {
    id: string;
    name: string;
    sort_order: number | null;
    competency_clusters: {
      competency_domains: { name: string | null; sort_order: number | null } | null;
    } | null;
  };
  const competencies = ((compsRes.data ?? []) as unknown as CompRow[]).map((c) => {
    const domain = c.competency_clusters?.competency_domains ?? null;
    return {
      id: c.id,
      name: c.name,
      domainName: domain?.name ?? "Other",
      domainSort: domain?.sort_order ?? 99,
      sortOrder: c.sort_order ?? 0,
    };
  });

  type ProfileRow = {
    id: string;
    name_en: string;
    role_profile_competencies:
      | { competency_id: string; weight: number | null; priority: string | null }[]
      | null;
  };
  const roleProfiles = ((profilesRes.data ?? []) as unknown as ProfileRow[]).map((p) => ({
    id: p.id,
    name_en: p.name_en,
    competencies: (p.role_profile_competencies ?? []).map((rc) => ({
      competencyId: rc.competency_id,
      weight: rc.weight,
      priority: rc.priority,
    })),
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-6 py-8">
      <BackLink href="/admin/prehire" label={t("prehire.backToReqs")} />
      <div>
        <h1 className="text-2xl font-bold">{t("prehire.newReq")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("prehire.newReqIntro")}
        </p>
      </div>
      <RequisitionForm
        roleProfiles={roleProfiles}
        organizations={organizations}
        defaultOrgId={defaultOrgId}
        competencies={competencies}
      />
    </div>
  );
}
