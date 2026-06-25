import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { loadPlatformClients } from "@/lib/clients/registry";
import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { BespokeBuilder } from "./_components/bespoke-builder";
import { AllReportsPanel, type BespokeReport } from "./_components/all-reports-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bespoke Services · VIFM",
  description: "Combine VIFM services into a tailored package and assign it to a client.",
};

export default async function BespokeServicesPage() {
  // Self-gate: this page reads the full client list via the service-role
  // registry, so an authenticated non-admin must not reach it (the IDOR rail).
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) notFound();
    throw e;
  }

  // One registry call feeds both the builder's client list AND the acId->name
  // map used to label each report's client (rr_candidates.organization_id is an
  // AC organisations id == client acId).
  const platformClients = await loadPlatformClients();
  const clients = platformClients.map((c) => ({ key: c.key, name: c.name }));
  const clientNameByAcId = new Map<string, string>();
  for (const c of platformClients) {
    if (c.acId) clientNameByAcId.set(c.acId, c.name);
  }

  // Central Reports list: every COMPLETED Role Readiness candidate across every
  // role, newest-completed first, so the admin retrieves any report from one
  // place. Tolerant of an un-applied 00153 (renders an empty state).
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
      <BackLink href="/admin" label="Back" history />
      <AllReportsPanel reports={reports} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Bespoke Services</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Combine any of VIFM&apos;s services into a single tailored package and assign it to a
            client - design exactly the engagement they need.
          </p>
        </div>
        <Link href="/admin/bespoke/roles">
          <Button variant="outline" className="gap-1.5">
            <Boxes className="h-4 w-4" /> Role Readiness roles
          </Button>
        </Link>
      </div>

      {/* Role Readiness: a configurable Persona + Techno bundle that produces a
          ready/not-ready verdict. Configured roles publish into the section. */}
      <div className="rounded-xl border bg-gradient-to-br from-[#010131] to-[#121140] p-5 text-white">
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5391D5]/20 text-[#5391D5]">
              <Boxes className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Role Readiness (Persona + Techno)</div>
              <p className="mt-0.5 max-w-xl text-xs text-white/70">
                Bundle behavioural + technical into one candidate sitting with a ready/not-ready verdict and an
                auto development plan. Configure a role once - it surfaces here and on the landing.
              </p>
            </div>
          </div>
          <Link href="/admin/bespoke/roles">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#5391D5] px-4 py-2 text-xs font-semibold text-white hover:bg-[#5391D5]/90">
              Configure roles
            </span>
          </Link>
        </div>
      </div>

      <BespokeBuilder clients={clients} />
    </div>
  );
}
