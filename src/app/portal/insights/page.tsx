import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, ArrowRight, Boxes } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { getAllocationsForOrg, type Allocation } from "@/lib/clients/allocations";
import { portalService } from "@/lib/clients/portal-services";
import { isVoucherService } from "@/lib/clients/voucher-issue";
import { isSeatService, getSeatActivity } from "@/lib/clients/seat-issue";
import { getServiceActivity, type ServiceActivity } from "@/lib/clients/monitor";
import { personaOrgIntel, type PersonaOrgIntel } from "@/lib/clients/portal-intel";
import { loadBespokeServices } from "@/lib/bespoke/services";
import { loadPlatformClients } from "@/lib/clients/registry";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";
export const metadata = { title: "Intelligence · VIFM Client Portal" };

type BundleCand = { id: string; full_name: string; status: string; completed_at: string | null; bespoke_service_id: string };

/** Count activity rows by their result label (CEFR level / band / status). */
function resultMix(rows: { summary: string }[]): { label: string; count: number }[] {
  const mix = new Map<string, number>();
  for (const r of rows) mix.set(r.summary, (mix.get(r.summary) ?? 0) + 1);
  return [...mix.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 6);
}

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

export default async function PortalInsightsPage({ searchParams }: { searchParams?: { org?: string } }) {
  const access = await resolvePortalAccess(searchParams?.org);
  if (!access.ok) notFound();
  if (!access.orgId) {
    // Admin preview without a client chosen yet - offer the picker (mirrors /portal).
    if (!access.viewingAsAdmin) notFound();
    const clients = (await loadPlatformClients()).filter((c) => c.acId);
    return (
      <div dir="ltr">
        <BackLink href="/portal" label="Portal" />
        <h1 className="mt-4 text-2xl font-semibold text-primary">Intelligence</h1>
        <p className="mt-2 text-sm text-muted-foreground">Admin preview - pick a client to view their intelligence sheet:</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {clients.map((c) => (
            <Link key={c.acId} href={`/portal/insights?org=${c.acId}`} className="rounded-lg border px-3 py-2 text-sm hover:bg-muted">
              {c.name}
            </Link>
          ))}
        </div>
      </div>
    );
  }
  const orgId = access.orgId;
  const orgSuffix = access.viewingAsAdmin ? `?org=${orgId}` : "";

  const allocations = await getAllocationsForOrg(orgId);
  const active = allocations.filter((a) => a.status === "active");

  // Per-service funnels (voucher + seat), in allocation order.
  const panels: Array<{
    alloc: Allocation;
    label: string;
    accent: string;
    kind: "voucher" | "seat";
    funnel: { a: number; b: number; c: number };
    funnelLabels: [string, string, string];
    mix: { label: string; count: number }[];
    recent: { id: string; name: string; date: string; summary: string; reportPath: string }[];
  }> = [];
  let personaIntel: PersonaOrgIntel | null = null;

  for (const alloc of active) {
    const meta = portalService(alloc.service);
    if (!meta) continue;
    if (isVoucherService(alloc.service)) {
      const act: ServiceActivity = await getServiceActivity(alloc.service, orgId);
      panels.push({
        alloc,
        label: meta.label,
        accent: meta.accent,
        kind: "voucher",
        funnel: { a: act.issued, b: act.redeemed, c: act.completed },
        funnelLabels: ["Issued", "Redeemed", "Completed"],
        mix: alloc.service === "persona" ? [] : resultMix(act.rows),
        recent: act.rows.slice(0, 5),
      });
      if (alloc.service === "persona") personaIntel = await personaOrgIntel(orgId);
    } else if (isSeatService(alloc.service)) {
      const act = await getSeatActivity(alloc.service, orgId, alloc.ara_organization_id);
      if (!act) continue;
      panels.push({
        alloc,
        label: meta.label,
        accent: meta.accent,
        kind: "seat",
        funnel: { a: act.invited, b: act.started, c: act.completed },
        funnelLabels: ["Invited", "Started", "Completed"],
        mix: [],
        recent: act.rows.slice(0, 5),
      });
    }
  }

  // Bespoke bundles + one-sitting candidates (combined reports).
  const bundles = (await loadBespokeServices({ organizationId: orgId })).filter(
    (s) => s.kind === "bundle" && s.organization_id === orgId
  );
  let bundleCands: BundleCand[] = [];
  if (bundles.length > 0) {
    try {
      const { data } = await createServiceClient()
        .from("bundle_candidates")
        .select("id, full_name, status, completed_at, bespoke_service_id")
        .in("bespoke_service_id", bundles.map((b) => b.id))
        .order("created_at", { ascending: false });
      bundleCands = (data ?? []) as BundleCand[];
    } catch { /* pre-migration */ }
  }

  // Headline numbers.
  const seatsTotal = active.reduce((a, x) => a + x.seats_total, 0);
  const seatsUsed = active.reduce((a, x) => a + x.seats_used, 0);
  const totalCompleted = panels.reduce((a, p) => a + p.funnel.c, 0) + bundleCands.filter((c) => c.status === "completed").length;

  return (
    <div dir="ltr" className="space-y-6">
      <BackLink href={`/portal${orgSuffix}`} label="Portal" />
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#010131] text-white">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-primary">Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Utilisation, completion, and results across every service your organisation subscribes to.
          </p>
        </div>
      </header>

      {/* Headline cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Active services", value: active.length },
          { label: "Seats granted", value: seatsTotal },
          { label: "Seats used", value: `${seatsUsed} (${pct(seatsUsed, seatsTotal)}%)` },
          { label: "Assessments completed", value: totalCompleted },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4 text-center">
            <div className="text-2xl font-semibold tabular-nums text-foreground">{s.value}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Per-service panels */}
      {panels.map((p) => (
        <section key={p.alloc.service} className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.accent }} /> {p.label}
            </h2>
            <Link
              href={`/portal/services/${p.alloc.service}${orgSuffix}`}
              className="inline-flex items-center gap-1 text-xs font-semibold hover:underline"
              style={{ color: p.accent }}
            >
              Open {p.label} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr]">
            {/* Utilisation + funnel */}
            <div className="space-y-2.5">
              <div>
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Seat utilisation</span>
                  <span className="tabular-nums">
                    {p.alloc.seats_used}/{p.alloc.seats_total} ({pct(p.alloc.seats_used, p.alloc.seats_total)}%)
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${pct(p.alloc.seats_used, p.alloc.seats_total)}%`, backgroundColor: p.accent }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([0, 1, 2] as const).map((i) => (
                  <div key={i} className="rounded-lg border p-2 text-center">
                    <div className="text-lg font-semibold tabular-nums text-foreground">
                      {i === 0 ? p.funnel.a : i === 1 ? p.funnel.b : p.funnel.c}
                    </div>
                    <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{p.funnelLabels[i]}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Completion rate: <span className="font-semibold text-foreground">{pct(p.funnel.c, Math.max(p.funnel.b, 1))}%</span> of{" "}
                {p.funnelLabels[1].toLowerCase()}
              </p>
            </div>

            {/* Result mix + recent completions */}
            <div className="space-y-2.5">
              {p.alloc.service === "persona" && personaIntel ? (
                <div className="rounded-lg border p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Cohort self-rating</div>
                  <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                    {personaIntel.cohortMean != null ? `${personaIntel.cohortMean.toFixed(2)} / 5` : "-"}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {personaIntel.bandMix.map((b) => (
                      <span key={b.label} className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                        {b.label} × {b.count}
                      </span>
                    ))}
                  </div>
                </div>
              ) : p.mix.length > 0 ? (
                <div className="rounded-lg border p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Result mix</div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {p.mix.map((m) => (
                      <span key={m.label} className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                        {m.label} × {m.count}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {p.recent.length > 0 && (
                <div className="rounded-lg border p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Recent completions</div>
                  <div className="mt-1.5 space-y-1">
                    {p.recent.map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">{r.name} <span className="text-muted-foreground">· {r.summary}</span></span>
                        <a href={r.reportPath} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[#5391D5] underline">
                          PDF
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      ))}

      {panels.length === 0 && (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
          No active service allocations yet. Please contact your VIFM consultant.
        </p>
      )}

      {/* Bespoke bundles */}
      {bundles.length > 0 && (
        <section className="rounded-xl border bg-card p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <Boxes className="h-4 w-4 text-[#5391D5]" /> Tailored programmes (bundles)
          </h2>
          <div className="mt-3 space-y-3">
            {bundles.map((b) => {
              const cands = bundleCands.filter((c) => c.bespoke_service_id === b.id);
              const done = cands.filter((c) => c.status === "completed");
              return (
                <div key={b.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-foreground">{b.name_en}</div>
                    <Link
                      href={`/portal/bundle/${b.id}${orgSuffix}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#5391D5] hover:underline"
                    >
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {cands.length} invited · {done.length} completed
                  </p>
                  {done.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {done.slice(0, 5).map((c) => (
                        <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate">{c.full_name}</span>
                          <a
                            href={`/api/admin/bundle/${c.id}/report`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-[#5391D5] underline"
                          >
                            Combined report (PDF)
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Assessment results are screening and development signals - combine them with structured interviews and work
        evidence before decisions. AI Readiness organisational reports are prepared and delivered by your VIFM consultant.
      </p>
    </div>
  );
}
