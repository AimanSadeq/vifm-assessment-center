import Link from "next/link";
import { notFound } from "next/navigation";
import { BarChart3, ArrowRight, Boxes, Layers3, Ticket, CheckCircle2, Users, FileText } from "lucide-react";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/ara/paginate";
import { resolvePortalAccess } from "@/lib/clients/portal-access";
import { getAllocationsForOrg, type Allocation } from "@/lib/clients/allocations";
import { portalService } from "@/lib/clients/portal-services";
import { isVoucherService } from "@/lib/clients/voucher-issue";
import { isSeatService, getSeatActivity } from "@/lib/clients/seat-issue";
import { getServiceActivity, type ServiceActivity } from "@/lib/clients/monitor";
import { personaOrgIntel, type PersonaOrgIntel } from "@/lib/clients/portal-intel";
import { personaBand, PERSONA_BAND_TW } from "@/lib/scoring/persona-bands";
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

/** Server-rendered donut ring with the % in the centre. */
function Donut({ value, color, size = 76, label }: { value: number; color: string; size?: number; label: string }) {
  const r = (size - 10) / 2;
  const cx = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${filled}%`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#eef1f6" strokeWidth={9} />
        <circle
          cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={9} strokeLinecap="round"
          strokeDasharray={`${(filled / 100) * circ} ${circ}`}
          transform={`rotate(-90 ${cx} ${cx})`}
        />
        <text x={cx} y={cx + 4} textAnchor="middle" fontSize={size / 4.6} fontWeight={700} fill="#010131">
          {filled}%
        </text>
      </svg>
      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

/** Proportional funnel row (bar width relative to the stage maximum). */
function FunnelRow({ label, value, max, color, faded }: { label: string; value: number; max: number; color: string; faded?: boolean }) {
  const w = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 4;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="h-4 flex-1 overflow-hidden rounded-md bg-muted/60">
        <div
          className="flex h-full items-center rounded-md px-1.5"
          style={{ width: `${w}%`, backgroundColor: color, opacity: faded ? 0.45 : 1 }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

/** Initials avatar for the completion rosters. */
function Avatar({ name, color }: { name: string; color: string }) {
  const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}

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

  const sb = createServiceClient();
  const { data: org } = await sb.from("organizations").select("name").eq("id", orgId).maybeSingle<{ name: string }>();
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
    // Page (deterministic .order('id')): the headline totalCompleted below counts
    // over this set, so an unpaginated read would undercount a large org past 1000.
    bundleCands = await fetchAllPages<BundleCand>((from, to) =>
      sb
        .from("bundle_candidates")
        .select("id, full_name, status, completed_at, bespoke_service_id")
        .in("bespoke_service_id", bundles.map((b) => b.id))
        .order("id")
        .range(from, to),
    ).catch(() => [] as BundleCand[]);
  }

  // Headline numbers.
  const seatsTotal = active.reduce((a, x) => a + x.seats_total, 0);
  const seatsUsed = active.reduce((a, x) => a + x.seats_used, 0);
  const totalCompleted = panels.reduce((a, p) => a + p.funnel.c, 0) + bundleCands.filter((c) => c.status === "completed").length;
  const generatedAt = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const HEADLINE = [
    { label: "Active services", value: String(active.length), icon: Layers3, tone: "#5391D5" },
    { label: "Seats granted", value: String(seatsTotal), icon: Ticket, tone: "#7c3aed" },
    { label: "Seats used", value: `${seatsUsed}`, sub: `${pct(seatsUsed, seatsTotal)}% of granted`, icon: Users, tone: "#d97706" },
    { label: "Assessments completed", value: String(totalCompleted), icon: CheckCircle2, tone: "#059669" },
  ];

  return (
    <div dir="ltr">
      {/* ── Hero ── */}
      <div className="relative -mx-6 -mt-6 overflow-hidden bg-gradient-to-br from-[#010131] to-[#121140] px-6 pb-24 pt-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.14) 1px, transparent 0)", backgroundSize: "22px 22px" }}
        />
        <div className="relative">
          <BackLink href={`/portal${orgSuffix}`} label="Portal" className="text-white/70 hover:text-white" />
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#5391D5]/20 text-[#5391D5]">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#5391D5]">VIFM Talent Intelligence</div>
              <h1 className="text-2xl font-bold text-white">Intelligence</h1>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-white/70">
            {org?.name ?? "Your organisation"} · utilisation, completion, and results across every subscribed service · {generatedAt}
          </p>
        </div>
      </div>

      {/* ── Headline cards (overlap the hero) ── */}
      <div className="relative z-10 -mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {HEADLINE.map((s) => (
          <div key={s.label} className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</span>
              <s.icon className="h-4 w-4" style={{ color: s.tone }} />
            </div>
            <div className="mt-1.5 text-3xl font-bold tabular-nums text-[#010131]">{s.value}</div>
            {"sub" in s && s.sub ? <div className="text-[11px] text-muted-foreground">{s.sub}</div> : null}
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-5">
        {/* ── Per-service panels ── */}
        {panels.map((p) => (
          <section key={p.alloc.service} className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5"
              style={{ borderLeft: `4px solid ${p.accent}`, backgroundColor: `${p.accent}0d` }}
            >
              <h2 className="inline-flex items-center gap-2 text-sm font-bold text-[#010131]">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.accent }} /> {p.label}
                <span className="rounded-full border bg-white px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {p.kind === "voucher" ? "Self-issued vouchers" : "VIFM-managed seats"}
                </span>
              </h2>
              <Link
                href={`/portal/services/${p.alloc.service}${orgSuffix}`}
                className="inline-flex items-center gap-1 text-xs font-bold hover:underline"
                style={{ color: p.accent }}
              >
                Open {p.label} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr_1fr]">
              {/* Rings */}
              <div className="flex items-start justify-center gap-4">
                <Donut value={pct(p.alloc.seats_used, p.alloc.seats_total)} color={p.accent} label="Utilisation" />
                <Donut value={pct(p.funnel.c, Math.max(p.funnel.b, 1))} color="#059669" label="Completion" />
              </div>

              {/* Funnel */}
              <div className="space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Activity funnel</div>
                <FunnelRow label={p.funnelLabels[0]} value={p.funnel.a} max={Math.max(p.funnel.a, 1)} color={p.accent} faded />
                <FunnelRow label={p.funnelLabels[1]} value={p.funnel.b} max={Math.max(p.funnel.a, 1)} color={p.accent} />
                <FunnelRow label={p.funnelLabels[2]} value={p.funnel.c} max={Math.max(p.funnel.a, 1)} color="#059669" />
                <p className="pt-1 text-[11px] text-muted-foreground">
                  {p.alloc.seats_used}/{p.alloc.seats_total} seats used
                  {p.alloc.expires_at ? ` · expires ${new Date(p.alloc.expires_at).toLocaleDateString("en-GB")}` : ""}
                </p>
              </div>

              {/* Intelligence: cohort / result mix / recent */}
              <div className="space-y-3">
                {p.alloc.service === "persona" && personaIntel ? (
                  <div className="rounded-xl border p-3" style={{ backgroundColor: `${p.accent}08` }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Cohort self-rating</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <span className="text-2xl font-bold tabular-nums text-[#010131]">
                        {personaIntel.cohortMean != null ? personaIntel.cohortMean.toFixed(2) : "-"}
                      </span>
                      <span className="text-xs text-muted-foreground">/ 5 across {personaIntel.completed} completed</span>
                    </div>
                    {personaIntel.cohortMean != null && (
                      <div className="relative mt-2 h-2 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${((personaIntel.cohortMean - 1) / 4) * 100}%`, backgroundColor: p.accent }}
                        />
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {personaIntel.bandMix.map((b) => (
                        <span
                          key={b.key}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PERSONA_BAND_TW[b.key as keyof typeof PERSONA_BAND_TW] ?? "bg-slate-100 text-slate-600"}`}
                        >
                          {b.label} × {b.count}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : p.mix.length > 0 ? (
                  <div className="rounded-xl border p-3" style={{ backgroundColor: `${p.accent}08` }}>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Result mix</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {p.mix.map((m) => (
                        <span
                          key={m.label}
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                          style={{ backgroundColor: p.accent }}
                        >
                          {m.label} × {m.count}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                {p.recent.length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recent completions</div>
                    <div className="mt-1.5 space-y-1.5">
                      {p.recent.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 text-xs">
                          <Avatar name={r.name} color={p.accent} />
                          <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium text-foreground">{r.name}</span>
                            <span className="text-muted-foreground"> · {r.summary}</span>
                          </span>
                          <a
                            href={r.reportPath}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold text-[#5391D5] hover:bg-[#5391D5]/5"
                          >
                            <FileText className="h-3 w-3" /> PDF
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
          <p className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
            No active service allocations yet. Please contact your VIFM consultant.
          </p>
        )}

        {/* ── Bespoke bundles ── */}
        {bundles.length > 0 && (
          <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center gap-2 border-b border-l-4 border-l-[#010131] bg-[#010131]/[0.04] px-5 py-3.5">
              <Boxes className="h-4 w-4 text-[#5391D5]" />
              <h2 className="text-sm font-bold text-[#010131]">Tailored programmes (bundles)</h2>
            </div>
            <div className="grid gap-3 p-5 sm:grid-cols-2">
              {bundles.map((b) => {
                const cands = bundleCands.filter((c) => c.bespoke_service_id === b.id);
                const done = cands.filter((c) => c.status === "completed");
                return (
                  <div key={b.id} className="rounded-xl border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-[#010131]">{b.name_en}</div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {cands.length} invited · {done.length} completed
                        </p>
                      </div>
                      <Donut value={pct(done.length, Math.max(cands.length, 1))} color="#5391D5" size={56} label="Done" />
                    </div>
                    {done.length > 0 && (
                      <div className="mt-2 space-y-1.5 border-t pt-2">
                        {done.slice(0, 4).map((c) => (
                          <div key={c.id} className="flex items-center gap-2 text-xs">
                            <Avatar name={c.full_name} color="#010131" />
                            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{c.full_name}</span>
                            <a
                              href={`/api/admin/bundle/${c.id}/report`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold text-[#5391D5] hover:bg-[#5391D5]/5"
                            >
                              <FileText className="h-3 w-3" /> Combined PDF
                            </a>
                          </div>
                        ))}
                      </div>
                    )}
                    <Link
                      href={`/portal/bundle/${b.id}${orgSuffix}`}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#5391D5] hover:underline"
                    >
                      Open programme <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <p className="pb-2 text-[11px] leading-relaxed text-muted-foreground">
          Assessment results are screening and development signals - combine them with structured interviews and work
          evidence before decisions. AI Readiness organisational reports are prepared and delivered by your VIFM consultant.
        </p>
      </div>
    </div>
  );
}
