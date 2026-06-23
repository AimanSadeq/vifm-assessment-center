import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { getAllocationsForOrg } from "@/lib/clients/allocations";
import { loadPlatformClients } from "@/lib/clients/registry";
import { loadBespokeServices } from "@/lib/bespoke/services";
import type { CaliberService } from "@/lib/clients/portal-services";
import { PlatformLanding, type ClientPortalMode, type ServiceKey } from "@/app/_components/platform-landing";

export const dynamic = "force-dynamic";

// Client portal service -> the landing's service tile key.
const KEY_FOR: Record<CaliberService, ServiceKey> = {
  fluent: "fluent",
  logica: "cognitive",
  persona: "persona",
  techno: "technical",
  prehire: "prehire",
  arc: "ara",
  reflect: "reflect",
};

export default async function PortalHomePage({ searchParams }: { searchParams?: { org?: string } }) {
  const access = await resolvePortalAccess(searchParams?.org);
  const orgId = access.ok ? access.orgId : null;
  const viewingAsAdmin = access.ok ? access.viewingAsAdmin : false;

  if (!orgId) {
    if (access.ok && access.viewingAsAdmin) {
      const clients = (await loadPlatformClients()).filter((c) => c.acId);
      return (
        <div>
          <h1 className="text-2xl font-semibold text-primary">Client portal</h1>
          <p className="mt-2 text-sm text-muted-foreground">Admin preview - pick a client to view their portal:</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {clients.map((c) => (
              <Link key={c.acId} href={`/portal?org=${c.acId}`} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      );
    }
    return (
      <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        No programme has been allocated to your organisation yet. Please contact your VIFM consultant.
      </p>
    );
  }

  const sb = createServiceClient();
  const { data: org } = await sb.from("organizations").select("name").eq("id", orgId).maybeSingle<{ name: string }>();
  const allocations = await getAllocationsForOrg(orgId);
  const orgSuffix = viewingAsAdmin ? `?org=${orgId}` : "";

  // Allocated services become active tiles routing into the portal; everything
  // else on the landing renders dimmed ("Not assigned").
  const allowed: ClientPortalMode["allowed"] = {};
  for (const a of allocations) {
    allowed[KEY_FOR[a.service]] = {
      href: `/portal/services/${a.service}${orgSuffix}`,
      summaryEn: `${a.seats_remaining}/${a.seats_total} left`,
      summaryAr: `${a.seats_remaining}/${a.seats_total} متبقٍ`,
    };
  }

  // The org's assigned bespoke programmes (Role Readiness) surface as portal
  // tiles - org-assigned only (organization_id === this org), not global templates.
  const bespokeProducts = (await loadBespokeServices({ organizationId: orgId }))
    .filter((s) => s.kind === "role_readiness" && s.organization_id === orgId && s.role_config_id)
    .map((s) => ({
      id: s.id,
      nameEn: s.name_en,
      nameAr: s.name_ar,
      roleConfigId: s.role_config_id,
      href: `/portal/bespoke/${s.role_config_id}${orgSuffix}`,
    }));

  return (
    <PlatformLanding
      clientMode={{ orgName: org?.name ?? "Client portal", allowed }}
      bespokeProducts={bespokeProducts}
    />
  );
}
