import { notFound } from "next/navigation";
import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { getAllocationsForOrg } from "@/lib/clients/allocations";
import { portalService } from "@/lib/clients/portal-services";
import { isVoucherService } from "@/lib/clients/voucher-issue";
import { getServiceActivity } from "@/lib/clients/monitor";
import { getServerLocale, getServerDir } from "@/lib/i18n/server";
import { BackLink } from "@/components/shared/back-link";
import { VoucherServiceClient } from "./_components/voucher-service-client";

export const dynamic = "force-dynamic";

export default async function PortalServicePage({
  params,
  searchParams,
}: {
  params: { service: string };
  searchParams?: { org?: string };
}) {
  const svc = portalService(params.service);
  if (!svc) notFound();
  const access = await resolvePortalAccess(searchParams?.org);
  if (!access.ok) notFound();

  const locale = await getServerLocale();
  const dir = getServerDir(locale);
  const name = locale === "ar" ? svc.labelAr : svc.label;
  const orgId = access.orgId;
  const backHref = access.viewingAsAdmin && orgId ? `/portal?org=${orgId}` : "/portal";

  if (!orgId) {
    return (
      <div dir={dir}>
        <BackLink href="/portal" label="Portal" />
        <p className="mt-4 text-sm text-muted-foreground">Open this from the portal home (pick a client first).</p>
      </div>
    );
  }

  const allocs = await getAllocationsForOrg(orgId);
  const alloc = allocs.find((a) => a.service === svc.id) ?? null;
  const remaining = alloc?.seats_remaining ?? 0;
  const voucherSvc = isVoucherService(svc.id);
  const activity = voucherSvc ? await getServiceActivity(svc.id, orgId) : null;

  return (
    <div dir={dir} className="space-y-5">
      <BackLink href={backHref} label="Portal" />
      <header className="flex items-center gap-3">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: svc.accent }} />
        <div>
          <h1 className="text-2xl font-semibold text-primary">{name}</h1>
          {alloc ? (
            <p className="text-sm text-muted-foreground">
              {alloc.seats_total} granted · {alloc.seats_used} used · <span className="font-medium text-foreground">{remaining} remaining</span>
              {alloc.expires_at ? ` · expires ${new Date(alloc.expires_at).toLocaleDateString(locale === "ar" ? "ar" : "en-GB")}` : ""}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No seats allocated yet.</p>
          )}
        </div>
      </header>

      {voucherSvc ? (
        <VoucherServiceClient
          service={svc.id}
          orgParam={access.viewingAsAdmin ? orgId : undefined}
          hasAllocation={!!alloc}
          remaining={remaining}
        />
      ) : (
        <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
          {name} is a VIFM-set-up programme. Your VIFM consultant prepares the engagement; you will then invite your
          people and track results here. (Self-serve setup for this service is coming next.)
        </div>
      )}

      {activity && (
        <section className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Issued", value: activity.issued },
              { label: "Redeemed", value: activity.redeemed },
              { label: "Completed", value: activity.completed },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border bg-card p-4 text-center">
                <div className="text-2xl font-semibold tabular-nums text-foreground">{s.value}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">Completed - review &amp; download reports</h2>
            {activity.rows.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No completed assessments yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-3">Name</th>
                      <th className="py-1.5 pr-3">Result</th>
                      <th className="py-1.5 pr-3">Date</th>
                      <th className="py-1.5 pr-3">Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activity.rows.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-1.5 pr-3">{r.name}</td>
                        <td className="py-1.5 pr-3">{r.summary}</td>
                        <td className="py-1.5 pr-3">{new Date(r.date).toLocaleDateString(locale === "ar" ? "ar" : "en-GB")}</td>
                        <td className="py-1.5 pr-3">
                          <a href={r.reportPath} target="_blank" rel="noopener noreferrer" className="text-[#5391D5] underline">
                            PDF
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
