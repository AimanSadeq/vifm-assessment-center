import { Layers } from "lucide-react";
import { BackLink } from "@/components/shared/back-link";
import { loadPlatformClients } from "@/lib/clients/registry";
import { createServiceClient } from "@/lib/supabase/server";
import { PORTAL_SERVICES } from "@/lib/clients/portal-services";
import { AllocationsClient, type AllocationRow } from "./_components/allocations-client";

export const dynamic = "force-dynamic";

export default async function ClientAllocationsPage() {
  const clients = await loadPlatformClients();
  const clientOptions = clients
    .filter((c) => c.acId)
    .map((c) => ({ id: c.acId as string, name: c.name }));

  // All allocations across orgs (admin view). Tolerant of an un-applied migration.
  let rows: AllocationRow[] = [];
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("client_service_allocations")
      .select("id, organization_id, service, seats_total, seats_used, expires_at, status, notes");
    const nameByAcId = new Map(clients.filter((c) => c.acId).map((c) => [c.acId as string, c.name]));
    rows = ((data ?? []) as Omit<AllocationRow, "seats_remaining" | "orgName">[]).map((a) => ({
      ...a,
      seats_remaining: Math.max(0, (a.seats_total ?? 0) - (a.seats_used ?? 0)),
      orgName: nameByAcId.get(a.organization_id) ?? "(unknown)",
    }));
  } catch {
    rows = [];
  }
  rows.sort((a, b) => a.orgName.localeCompare(b.orgName) || a.service.localeCompare(b.service));

  // Technical functions, so the admin can pin which one a Techno allocation assesses.
  let techFunctions: { id: string; name: string }[] = [];
  try {
    const sb = createServiceClient();
    const { data } = await sb.from("technical_functions").select("id, name_en").order("name_en");
    techFunctions = ((data ?? []) as { id: string; name_en: string }[]).map((f) => ({ id: f.id, name: f.name_en }));
  } catch {
    techFunctions = [];
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <BackLink href="/admin/clients" label="Back to Clients" history />
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
          <Layers className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-primary">Client allocations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Grant a client a voucher/seat quota + expiry per service, and provision their manager login.
            The manager distributes, monitors, and reports from their own portal.
          </p>
        </div>
      </div>
      <AllocationsClient clients={clientOptions} services={PORTAL_SERVICES} allocations={rows} techFunctions={techFunctions} />
    </div>
  );
}
