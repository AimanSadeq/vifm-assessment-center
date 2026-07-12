import { notFound } from "next/navigation";
import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/ara/paginate";
import { BackLink } from "@/components/shared/back-link";
import { InviteClient } from "./_components/invite-client";
import { CandidatesCollapsible, type Cand } from "./_components/candidates-collapsible";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bespoke programme · VIFM" };

export default async function PortalBespokeProductPage({
  params,
  searchParams,
}: {
  params: { roleConfigId: string };
  searchParams?: { org?: string };
}) {
  const access = await resolvePortalAccess(searchParams?.org);
  if (!access.ok || !access.orgId) notFound();
  const orgId = access.orgId;
  const orgSuffix = access.viewingAsAdmin ? `?org=${orgId}` : "";

  const sb = createServiceClient();
  // The programme must be assigned to THIS org (org-isolation).
  const { data: assigned } = await sb
    .from("bespoke_services")
    .select("id, name_en, name_ar, description")
    .eq("kind", "role_readiness")
    .eq("role_config_id", params.roleConfigId)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (!assigned) notFound();

  // The client's own org name - shown read-only as the voucher client (no registry
  // dropdown on the client-facing portal, to avoid leaking other clients' names).
  // orgId is the AC organizations.id (getClientOrgId), so read the name from
  // `organizations` - reading ara_organizations by an AC id yielded a blank name.
  const { data: orgRow } = await sb.from("organizations").select("name").eq("id", orgId).maybeSingle();
  const orgName = (orgRow?.name as string | undefined) ?? "";

  // Page the roster (deterministic .order('id')) so invited/completed counts + the
  // table are exact past the 1000-row cap; re-sort newest-first for DISPLAY (id is
  // a random uuid, so it's only a paging key, not a display order).
  const candidates = (
    await fetchAllPages<Cand & { created_at: string }>((from, to) =>
      sb
        .from("rr_candidates")
        .select("id, full_name, email, status, verdict, access_token, completed_at, created_at")
        .eq("role_config_id", params.roleConfigId)
        .eq("organization_id", orgId)
        .order("id")
        .range(from, to),
    ).catch(() => [] as (Cand & { created_at: string })[])
  ).sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  const completed = candidates.filter((c) => c.completed_at).length;

  return (
    <div className="space-y-6">
      <BackLink href={`/portal${orgSuffix}`} label="Portal" history />
      <div>
        <h1 className="text-2xl font-bold">{assigned.name_en as string}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Role Readiness programme (Persona + technical). Invite your people, then track each verdict and download
          their report. {candidates.length} invited · {completed} completed.
        </p>
      </div>

      <InviteClient roleConfigId={params.roleConfigId} orgParam={access.viewingAsAdmin ? orgId : undefined} orgName={orgName} />

      <CandidatesCollapsible candidates={candidates} completed={completed} />
    </div>
  );
}
