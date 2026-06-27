import { notFound } from "next/navigation";
import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { InviteClient } from "./_components/invite-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bespoke programme · VIFM" };

type Cand = {
  id: string;
  full_name: string;
  email: string;
  status: string;
  verdict: string;
  access_token: string;
  completed_at: string | null;
};

const verdictPill = (v: string) => {
  if (v === "ready") return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Ready</span>;
  if (v === "not_ready") return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">Not ready</span>;
  return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">In progress</span>;
};

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

      <div className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Candidates</h2>
        {candidates.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No candidates invited yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3">Candidate</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Verdict</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">
                    <div className="font-medium text-foreground">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">{c.status}</td>
                  <td className="py-2 pr-3">{verdictPill(c.verdict)}</td>
                  <td className="py-2 pr-3 text-end">
                    {c.completed_at ? (
                      <a href={`/api/role-readiness/${c.access_token}/report`} target="_blank" rel="noreferrer"
                        className="text-xs font-semibold text-[#5391D5] hover:underline">Report (PDF)</a>
                    ) : (
                      <a href={`/role-readiness/apply/${c.access_token}`} target="_blank" rel="noreferrer"
                        className="text-xs font-semibold text-[#5391D5] hover:underline">Apply link</a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
