import { notFound } from "next/navigation";
import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { createServiceClient } from "@/lib/supabase/server";
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
  const { data: orgRow } = await sb.from("ara_organizations").select("name").eq("id", orgId).maybeSingle();
  const orgName = (orgRow?.name as string | undefined) ?? "";

  const { data: rows } = await sb
    .from("rr_candidates")
    .select("id, full_name, email, status, verdict, access_token, completed_at")
    .eq("role_config_id", params.roleConfigId)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });
  const candidates = (rows ?? []) as Cand[];

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
