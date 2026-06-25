import { notFound } from "next/navigation";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadPlatformClients } from "@/lib/clients/registry";
import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { AllReportsPanel, type BespokeReport } from "../_components/all-reports-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bespoke Reports · VIFM" };

// Central reports page for the Bespoke Services section: every completed Role
// Readiness candidate report, across all roles + clients, searchable. Reached
// from the "Reports" button on the Bespoke Services landing page.
export default async function BespokeReportsPage() {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) notFound();
    throw e;
  }

  // organization_id on a candidate is an AC organisations id == client acId.
  const clientNameByAcId = new Map<string, string>();
  for (const c of await loadPlatformClients()) {
    if (c.acId) clientNameByAcId.set(c.acId, c.name);
  }

  const sb = createServiceClient();
  type RrReportRow = {
    id: string;
    full_name: string | null;
    email: string | null;
    verdict: string;
    access_token: string;
    completed_at: string | null;
    role_config_id: string;
    organization_id: string | null;
  };
  let rrRows: RrReportRow[] = [];
  try {
    const { data } = await sb
      .from("rr_candidates")
      .select("id, full_name, email, verdict, access_token, completed_at, role_config_id, organization_id")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(200);
    rrRows = (data ?? []) as RrReportRow[];
  } catch {
    rrRows = [];
  }

  const roleNameById = new Map<string, string>();
  const configIds = Array.from(new Set(rrRows.map((r) => r.role_config_id)));
  if (configIds.length > 0) {
    try {
      const { data: cfgs } = await sb.from("rr_role_configs").select("id, name_en").in("id", configIds);
      for (const c of (cfgs ?? []) as { id: string; name_en: string }[]) roleNameById.set(c.id, c.name_en);
    } catch {
      /* tolerant - leave role names as a generic fallback */
    }
  }

  const reports: BespokeReport[] = rrRows.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    verdict: r.verdict,
    accessToken: r.access_token,
    completedAt: r.completed_at,
    roleName: roleNameById.get(r.role_config_id) ?? "Role Readiness",
    clientName: r.organization_id ? clientNameByAcId.get(r.organization_id) ?? "-" : "Direct / sample",
  }));

  return (
    <div className="space-y-6">
      <BackLink href="/admin/bespoke" label="Bespoke Services" history />
      <div>
        <h1 className="text-2xl font-bold">Bespoke Reports</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every completed Bespoke assessment, in one place. Open any candidate&apos;s report or search to find one.
        </p>
      </div>
      <AllReportsPanel reports={reports} />
    </div>
  );
}
