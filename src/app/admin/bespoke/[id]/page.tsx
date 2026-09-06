import Link from "next/link";
import { notFound } from "next/navigation";
import { Boxes, Building2, Pencil, Copy, Lock, Ticket, Users, BrainCircuit, Layers, CalendarClock } from "lucide-react";
import { requireRole, isAuthorizationError } from "@/lib/ara/auth-guards";
import { createServiceClient } from "@/lib/supabase/server";
import { loadBundleService, loadBundleUsage } from "@/lib/bespoke/services";
import { loadBundleVouchers } from "@/lib/bespoke/bundle-vouchers";
import { PORTAL_SERVICES, type CaliberService } from "@/lib/clients/portal-services";
import { COGNITIVE_SUBTESTS, COGNITIVE_SUBTEST_KEYS } from "@/lib/psychometrics/framework";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { ReportCoverageBadges } from "../_components/report-coverage-badges";

export const dynamic = "force-dynamic";

/**
 * Design sheet for one composed bespoke bundle - the record of exactly how it
 * was structured, readable long after it was composed: identity, client,
 * every service with its full scope spelled out (not just a count), what the
 * scope buys in reports, who was invited and which vouchers were issued, and
 * the audit trail. Edit and Clone hand off to the composer.
 */
export default async function BundleDesignSheetPage({ params }: { params: { id: string } }) {
  try {
    await requireRole(["admin"]);
  } catch (e) {
    if (isAuthorizationError(e)) notFound();
    throw e;
  }

  const bundle = await loadBundleService(params.id);
  if (!bundle) notFound();

  const svc = createServiceClient();
  const [usage, vouchers, orgRes, candRes, creatorRes] = await Promise.all([
    loadBundleUsage(bundle.id),
    loadBundleVouchers(bundle.id),
    bundle.organization_id
      ? svc.from("organizations").select("name").eq("id", bundle.organization_id).maybeSingle<{ name: string }>()
      : Promise.resolve({ data: null }),
    svc
      .from("bundle_candidates")
      .select("id, full_name, email, status, consent_at, completed_at, created_at")
      .eq("bespoke_service_id", bundle.id)
      .order("created_at", { ascending: false })
      .limit(200),
    bundle.created_by
      ? svc.from("profiles").select("full_name, email").eq("id", bundle.created_by).maybeSingle<{ full_name: string | null; email: string | null }>()
      : Promise.resolve({ data: null }),
  ]);
  const orgName = orgRes.data?.name ?? "Unassigned";
  const candidates = (candRes.data ?? []) as Array<{ id: string; full_name: string; email: string; status: string; consent_at: string | null; completed_at: string | null; created_at: string }>;
  const creator = creatorRes.data?.full_name || creatorRes.data?.email || null;
  const locked = usage.candidates > 0 || usage.vouchers > 0;

  const cfg = bundle.service_config as { logica?: { subtests?: string[] }; persona?: { competencyIds?: string[] } };
  const logicaKeys = cfg.logica?.subtests && cfg.logica.subtests.length > 0 ? cfg.logica.subtests : [...COGNITIVE_SUBTEST_KEYS];
  const allCompetencyIds = BEHAVIORAL_COMPETENCIES.map((c) => c.acCompetencyId);
  const personaIds = cfg.persona?.competencyIds && cfg.persona.competencyIds.length > 0 ? cfg.persona.competencyIds : allCompetencyIds;
  const personaSet = new Set(personaIds);
  const clusters = (() => {
    const by = new Map<string, Array<{ id: string; name: string; on: boolean }>>();
    for (const c of BEHAVIORAL_COMPETENCIES) {
      if (!by.has(c.clusterNameEn)) by.set(c.clusterNameEn, []);
      by.get(c.clusterNameEn)!.push({ id: c.acCompetencyId, name: c.nameEn, on: personaSet.has(c.acCompetencyId) });
    }
    return [...by.entries()].map(([cluster, items]) => ({ cluster, items }));
  })();

  const meta = (id: string) => PORTAL_SERVICES.find((s) => s.id === (id as CaliberService));
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");

  // The exact record, as stored - the one artefact that cannot drift from the design.
  const designRecord = {
    id: bundle.id,
    name_en: bundle.name_en,
    name_ar: bundle.name_ar,
    description: bundle.description,
    organization_id: bundle.organization_id,
    service_keys: bundle.service_keys,
    service_config: bundle.service_config,
    status: bundle.status,
    created_at: bundle.created_at,
    updated_at: bundle.updated_at,
  };

  return (
    <div className="space-y-6">
      <BackLink href="/admin/bespoke" label="Back to Bespoke Services" history />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#010131] text-white">
            <Boxes className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[#5391D5]">Design sheet</div>
            <h1 className="text-2xl font-bold text-[#010131]">{bundle.name_en}</h1>
            {bundle.name_ar && <p className="text-sm text-muted-foreground" dir="rtl">{bundle.name_ar}</p>}
            {bundle.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{bundle.description}</p>}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" /> {orgName}</span>
              <span className={`rounded-full px-2 py-0.5 font-medium ${bundle.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>{bundle.status}</span>
              {locked && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-800"><Lock className="h-3 w-3" /> Design locked - in use</span>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link href={`/admin/bespoke?edit=${bundle.id}`}>
            <Button variant="outline" className="gap-1.5"><Pencil className="h-4 w-4" /> {locked ? "Edit name / client" : "Edit"}</Button>
          </Link>
          <Link href={`/admin/bespoke?clone=${bundle.id}`}>
            <Button className="gap-1.5"><Copy className="h-4 w-4" /> Clone</Button>
          </Link>
        </div>
      </div>

      {/* At a glance */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Services" value={String(bundle.service_keys.length)} sub={bundle.service_keys.map((k) => meta(k)?.label ?? k).join(" · ")} />
        <Stat label="Candidates invited" value={String(usage.candidates)} sub={`${usage.completed} completed`} icon={<Users className="h-4 w-4" />} />
        <Stat label="Vouchers issued" value={String(usage.vouchers)} sub={usage.seatsTotal > 0 ? `${usage.seatsUsed} of ${usage.seatsTotal} seats used` : "no seats"} icon={<Ticket className="h-4 w-4" />} />
        <Stat label="Composed" value={new Date(bundle.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} sub={creator ? `by ${creator}` : `last changed ${fmt(bundle.updated_at)}`} icon={<CalendarClock className="h-4 w-4" />} />
      </div>

      {/* The design, service by service */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">How this bundle is structured</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Every service the candidate sits, in the order the composer stored them, with the exact scope. A service with no scope note runs in full.
        </p>
        <ol className="mt-4 space-y-4">
          {bundle.service_keys.map((key, i) => {
            const m = meta(key);
            const accent = m?.accent ?? "#5391D5";
            return (
              <li key={key} className="rounded-lg border p-4" style={{ borderColor: `${accent}66` }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: accent }}>{i + 1}</span>
                    <span className="text-sm font-semibold" style={{ color: accent }}>{m?.label ?? key}</span>
                    {m?.labelAr && <span className="text-xs text-muted-foreground" dir="rtl">{m.labelAr}</span>}
                  </div>
                  <span className="text-[11px] text-muted-foreground">{m?.kind === "voucher" ? "Voucher service" : "Managed seat service"}</span>
                </div>

                {key === "logica" && (
                  <div className="mt-3">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground"><BrainCircuit className="h-3.5 w-3.5" style={{ color: accent }} /> Reasoning elements · {logicaKeys.length} of {COGNITIVE_SUBTEST_KEYS.length}{logicaKeys.length === COGNITIVE_SUBTEST_KEYS.length ? " (full battery)" : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {COGNITIVE_SUBTESTS.map((s) => {
                        const on = logicaKeys.includes(s.key);
                        return (
                          <span key={s.key} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${on ? "text-white" : "border-dashed text-muted-foreground line-through"}`} style={on ? { backgroundColor: accent, borderColor: accent } : undefined}>
                            {s.name_en}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {key === "persona" && (
                  <div className="mt-3">
                    <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground"><Layers className="h-3.5 w-3.5" style={{ color: accent }} /> Competencies · {personaIds.length} of {allCompetencyIds.length}{personaIds.length === allCompetencyIds.length ? " (full instrument)" : ""}</p>
                    <div className="mt-2 space-y-2">
                      {clusters.map((g) => {
                        const onCount = g.items.filter((x) => x.on).length;
                        return (
                          <div key={g.cluster}>
                            <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{g.cluster} · {onCount}/{g.items.length}</div>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {g.items.map((c) => (
                                <span key={c.id} className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${c.on ? "text-white" : "border-dashed text-muted-foreground line-through"}`} style={c.on ? { backgroundColor: accent, borderColor: accent } : undefined}>
                                  {c.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">What this scope produces</div>
                      <div className="mt-1"><ReportCoverageBadges selectedIds={personaIds} /></div>
                    </div>
                  </div>
                )}

                {key !== "logica" && key !== "persona" && (
                  <p className="mt-2 text-xs text-muted-foreground">Runs the standard {m?.label ?? key} instrument in full; this composer holds no per-service scope for it.</p>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Delivery so far */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-[#5391D5]" /> Candidates ({candidates.length})</h2>
          {candidates.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Nobody has been invited to this bundle yet.</p>
          ) : (
            <table className="mt-3 w-full text-xs">
              <thead className="text-muted-foreground">
                <tr><th className="py-1 text-left font-medium">Name</th><th className="py-1 text-left font-medium">Status</th><th className="py-1 text-left font-medium">Invited</th><th className="py-1 text-left font-medium">Completed</th></tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="py-1.5"><div className="font-medium text-foreground">{c.full_name}</div><div className="text-muted-foreground">{c.email}</div></td>
                    <td className="py-1.5">{c.status.replace("_", " ")}</td>
                    <td className="py-1.5">{fmt(c.created_at)}</td>
                    <td className="py-1.5">{fmt(c.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="rounded-xl border bg-card p-5">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold"><Ticket className="h-4 w-4 text-[#5391D5]" /> Vouchers ({vouchers.length})</h2>
          {vouchers.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">No vouchers issued for this bundle.</p>
          ) : (
            <table className="mt-3 w-full text-xs">
              <thead className="text-muted-foreground">
                <tr><th className="py-1 text-left font-medium">Code</th><th className="py-1 text-left font-medium">Label / recipient</th><th className="py-1 text-left font-medium">Seats</th><th className="py-1 text-left font-medium">Expires</th></tr>
              </thead>
              <tbody>
                {vouchers.map((v) => (
                  <tr key={v.id} className="border-t">
                    <td className="py-1.5 font-mono">{v.code}</td>
                    <td className="py-1.5">{v.label || v.recipient_name || v.recipient_email || "-"}</td>
                    <td className="py-1.5">{v.uses} / {v.max_uses}</td>
                    <td className="py-1.5">{v.expires_at ? fmt(v.expires_at) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* The stored record */}
      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold">Stored design record</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          The row as it sits in the database. Service keys are the sitting order; service_config holds only a scope that is narrower than the full instrument, so an absent key means &quot;in full&quot;.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-4 text-[11px] leading-relaxed text-slate-100">{JSON.stringify(designRecord, null, 2)}</pre>
        <p className="mt-2 text-[11px] text-muted-foreground">Created {fmt(bundle.created_at)}{creator ? ` by ${creator}` : ""} · last changed {fmt(bundle.updated_at)}</p>
      </section>
    </div>
  );
}

function Stat({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[#010131]">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-muted-foreground" title={sub}>{sub}</div>}
    </div>
  );
}
