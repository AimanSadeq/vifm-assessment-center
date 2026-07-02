import { notFound, redirect } from "next/navigation";
import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { getAllocationsForOrg } from "@/lib/clients/allocations";
import { portalService } from "@/lib/clients/portal-services";
import { isVoucherService } from "@/lib/clients/voucher-issue";
import { isSeatService, getSeatActivity } from "@/lib/clients/seat-issue";
import { getServiceActivity, getVoucherLedger } from "@/lib/clients/monitor";
import { getServerLocale } from "@/lib/i18n/server";
import { BackLink } from "@/components/shared/back-link";
import { VoucherServiceClient } from "./_components/voucher-service-client";
import { SeatDistributeClient } from "./_components/seat-distribute-client";
import { ArcIndividualVoucher } from "./_components/arc-individual-voucher";

const SEAT_KIND: Record<string, string> = { arc: "respondents", reflect: "participants", prehire: "candidates" };

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
  // This surface's body copy is English-only, so pin LTR rather than flip to RTL
  // from the locale cookie (which produced a mixed RTL-layout / English-text
  // screen). The service name still localizes below. Full AR localization TODO.
  const name = locale === "ar" ? svc.labelAr : svc.label;
  const orgId = access.orgId;
  const backHref = access.viewingAsAdmin && orgId ? `/portal?org=${orgId}` : "/portal";

  if (!orgId) {
    return (
      <div dir="ltr">
        <BackLink href="/portal" label="Portal" />
        <p className="mt-4 text-sm text-muted-foreground">Open this from the portal home (pick a client first).</p>
      </div>
    );
  }

  const allocs = await getAllocationsForOrg(orgId);
  const alloc = allocs.find((a) => a.service === svc.id) ?? null;
  // Block direct access to a service the org was not allocated (dim + block):
  // un-allocated services are not linked from the Home, and a hand-typed URL
  // bounces back to the portal grid.
  if (!alloc) {
    redirect(access.viewingAsAdmin && orgId ? `/portal?org=${orgId}` : "/portal");
  }
  const remaining = alloc?.seats_remaining ?? 0;
  const voucherSvc = isVoucherService(svc.id);
  const seatSvc = isSeatService(svc.id);
  const activity = voucherSvc ? await getServiceActivity(svc.id, orgId) : null;
  const ledger = voucherSvc ? await getVoucherLedger(svc.id, orgId) : [];
  const seatActivity = seatSvc && alloc ? await getSeatActivity(svc.id, orgId, alloc.ara_organization_id) : null;

  return (
    <div dir="ltr" className="space-y-5">
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
      ) : seatSvc ? (
        <div className="space-y-4">
          {/* ARC also measures an individual - offer it as a voucher (the other
              levels: Department / Division / Organization stay on the cohort invite). */}
          {svc.id === "arc" && (
            <ArcIndividualVoucher orgParam={access.viewingAsAdmin ? orgId : undefined} remaining={remaining} />
          )}
          <SeatDistributeClient
            service={svc.id}
            orgParam={access.viewingAsAdmin ? orgId : undefined}
            hasAllocation={!!alloc}
            remaining={remaining}
            kindLabel={SEAT_KIND[svc.id] ?? "people"}
          />
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">
          {name} is set up with your VIFM consultant.
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
          {/* Voucher ledger: every issued code, who it went to, who redeemed it.
              Collapsed by default - the funnel above gives the headline. */}
          {ledger.length > 0 && (
            <details className="rounded-xl border bg-card">
              <summary className="cursor-pointer select-none px-5 py-4 text-sm font-semibold text-foreground">
                Voucher ledger{" "}
                <span className="font-normal text-muted-foreground">
                  ({ledger.length} issued · {ledger.filter((v) => v.usedCount > 0).length} redeemed)
                </span>
              </summary>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-3">Code</th>
                      <th className="py-1.5 pr-3">Assigned to</th>
                      <th className="py-1.5 pr-3">Redeemed by</th>
                      <th className="py-1.5 pr-3">Uses</th>
                      <th className="py-1.5 pr-3">Status</th>
                      <th className="py-1.5 pr-3">Issued</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.map((v) => (
                      <tr key={v.code} className="border-b align-top last:border-0">
                        <td className="py-1.5 pr-3 font-mono text-[11px]">{v.code}</td>
                        <td className="py-1.5 pr-3">{v.assigned ?? <span className="text-slate-300">-</span>}</td>
                        <td className="py-1.5 pr-3">
                          {v.redeemers.length === 0 ? (
                            <span className="text-slate-400">Not redeemed yet</span>
                          ) : (
                            v.redeemers.map((r, i) => (
                              <div key={i}>
                                {r.name ?? "Anonymous"}
                                {r.email ? <span className="text-muted-foreground"> · {r.email}</span> : null}
                                {r.when ? (
                                  <span className="text-muted-foreground">
                                    {" "}· {new Date(r.when).toLocaleDateString(locale === "ar" ? "ar" : "en-GB")}
                                  </span>
                                ) : null}
                              </div>
                            ))
                          )}
                        </td>
                        <td className="py-1.5 pr-3 tabular-nums">{v.usedCount}/{v.maxUses}</td>
                        <td className="py-1.5 pr-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            v.status === "active"
                              ? v.usedCount >= v.maxUses ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}>
                            {v.status === "active" ? (v.usedCount >= v.maxUses ? "Fully used" : "Active") : v.status}
                          </span>
                        </td>
                        <td className="py-1.5 pr-3">{v.issuedAt ? new Date(v.issuedAt).toLocaleDateString(locale === "ar" ? "ar" : "en-GB") : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
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

      {seatActivity && (
        <section className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Invited", value: seatActivity.invited },
              { label: "Started", value: seatActivity.started },
              { label: "Completed", value: seatActivity.completed },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border bg-card p-4 text-center">
                <div className="text-2xl font-semibold tabular-nums text-foreground">{s.value}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground">People - review &amp; download reports</h2>
            {seatActivity.rows.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No one has been invited yet.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left uppercase tracking-wide text-muted-foreground">
                      <th className="py-1.5 pr-3">Name</th>
                      <th className="py-1.5 pr-3">Status</th>
                      <th className="py-1.5 pr-3">Date</th>
                      <th className="py-1.5 pr-3">Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seatActivity.rows.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-1.5 pr-3">{r.name}</td>
                        <td className="py-1.5 pr-3">{r.summary}</td>
                        <td className="py-1.5 pr-3">{r.date ? new Date(r.date).toLocaleDateString(locale === "ar" ? "ar" : "en-GB") : "-"}</td>
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
