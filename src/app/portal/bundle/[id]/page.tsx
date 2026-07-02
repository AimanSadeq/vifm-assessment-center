import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, Languages, BrainCircuit, Layers, BadgeCheck, UserSearch, Compass, Aperture, ArrowRight } from "lucide-react";
import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { loadBespokeServices } from "@/lib/bespoke/services";
import { getAllocationsForOrg } from "@/lib/clients/allocations";
import { PORTAL_SERVICES, type CaliberService } from "@/lib/clients/portal-services";
import { COGNITIVE_SUBTESTS, COGNITIVE_SUBTEST_KEYS } from "@/lib/psychometrics/framework";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bespoke bundle · VIFM" };

const SERVICE_ICON: Record<CaliberService, typeof Boxes> = {
  fluent: Languages,
  logica: BrainCircuit,
  persona: Layers,
  techno: BadgeCheck,
  prehire: UserSearch,
  arc: Compass,
  reflect: Aperture,
};

/**
 * Client-portal page for a composed bespoke bundle: the package's services as
 * cards routing into each service's portal page (allocation state shown), with
 * any per-service scope (e.g. Logica elements) called out. Org-isolated.
 */
export default async function PortalBundlePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { org?: string };
}) {
  const access = await resolvePortalAccess(searchParams?.org);
  if (!access.ok || !access.orgId) notFound();
  const orgId = access.orgId;
  const orgSuffix = access.viewingAsAdmin ? `?org=${orgId}` : "";

  // The bundle must be assigned to THIS org (org-isolation, mirrors /portal/bespoke).
  const bundle = (await loadBespokeServices({ organizationId: orgId })).find(
    (s) => s.id === params.id && s.kind === "bundle" && s.organization_id === orgId
  );
  if (!bundle) notFound();

  const allocations = await getAllocationsForOrg(orgId);
  const allocated = new Map(allocations.map((a) => [a.service, a]));

  const logicaScope = (bundle.service_config as { logica?: { subtests?: string[] } }).logica?.subtests ?? null;
  const logicaScoped = !!logicaScope && logicaScope.length > 0 && logicaScope.length < COGNITIVE_SUBTEST_KEYS.length;

  const services = bundle.service_keys
    .map((key) => PORTAL_SERVICES.find((s) => s.id === key))
    .filter((s): s is (typeof PORTAL_SERVICES)[number] => !!s);

  return (
    <div className="space-y-6">
      <BackLink href={`/portal${orgSuffix}`} label="Portal" history />
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#010131] text-white">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{bundle.name_en}</h1>
            {bundle.name_ar && <p className="text-sm text-muted-foreground" dir="rtl">{bundle.name_ar}</p>}
          </div>
        </div>
        {bundle.description && (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{bundle.description}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          A tailored VIFM package - {services.length} service{services.length === 1 ? "" : "s"} bundled for your organisation.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((svc) => {
          const Icon = SERVICE_ICON[svc.id];
          const alloc = allocated.get(svc.id);
          return (
            <div key={svc.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${svc.accent}1a`, color: svc.accent }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{svc.label}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {svc.kind === "voucher" ? "Self-issued voucher service" : "VIFM-managed seat service"}
                    </div>
                  </div>
                </div>
                {alloc ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    {alloc.seats_remaining}/{alloc.seats_total} left
                  </span>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    Not allocated yet
                  </span>
                )}
              </div>

              {/* Per-service scope callout (Logica elements) */}
              {svc.id === "logica" && logicaScoped && (
                <div className="mt-3 rounded-lg border p-2.5" style={{ borderColor: `${svc.accent}55`, backgroundColor: `${svc.accent}0a` }}>
                  <p className="text-[11px] font-semibold" style={{ color: svc.accent }}>Scoped elements</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {logicaScope!.map((k) => (
                      <span
                        key={k}
                        className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: svc.accent }}
                      >
                        {COGNITIVE_SUBTESTS.find((s) => s.key === k)?.name_en ?? k}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3">
                {alloc ? (
                  <Link
                    href={`/portal/services/${svc.id}${orgSuffix}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                    style={{ color: svc.accent }}
                  >
                    Open {svc.label} <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Ask your VIFM consultant to allocate seats for this service.
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
