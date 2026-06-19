import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { ShieldCheck, FlaskConical, ChevronRight, BookOpenCheck } from "lucide-react";
import { BulkEvidenceButtons } from "@/components/admin/bulk-evidence-buttons";
import type { ValidationEvidence } from "@/types/evidence";
import { getServerLocale, getServerDir } from "@/lib/i18n/server";
import { localizedName } from "@/lib/i18n/localized";
import { BackLink } from "@/components/shared/back-link";

export const dynamic = "force-dynamic";

/**
 * Assessment Center per-competency evidence console.
 *
 * Lists all 41 AC behavioural competencies grouped by domain → cluster,
 * each with its validation-evidence review status. This is the AC
 * counterpart to the ARC question-bank evidence workflow, and the place
 * an admin closes the "where does this competency come from
 * scientifically?" gap. Click a competency to manage its research
 * anchors. Aggregated into /admin/evidence-map.
 */

type Row = {
  id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  sort_order: number;
  validation_evidence: ValidationEvidence | null;
  competency_clusters: {
    name: string;
    name_ar: string | null;
    sort_order: number;
    competency_domains: { name: string; name_ar: string | null; sort_order: number } | null;
  } | null;
};

type StatusKey = "verified" | "ai_proposed" | "rejected" | "none";

function statusOf(ev: ValidationEvidence | null): StatusKey {
  if (!ev) return "none";
  if (ev.review_status === "verified" || ev.review_status === "edited") return "verified";
  if (ev.review_status === "ai_proposed") return "ai_proposed";
  if (ev.review_status === "rejected") return "rejected";
  return "none";
}

const STATUS_META: Record<StatusKey, { label: string; tone: string }> = {
  verified:    { label: "Documented",   tone: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  ai_proposed: { label: "AI proposed",  tone: "bg-amber-100 text-amber-900 border-amber-200" },
  rejected:    { label: "Rejected",     tone: "bg-rose-100 text-rose-900 border-rose-200" },
  none:        { label: "Not documented", tone: "bg-muted text-muted-foreground border-border" },
};

export default async function AcEvidencePage() {
  const sb = createServiceClient();
  const rtl = getServerDir(await getServerLocale()) === "rtl";
  const { data, error } = await sb
    .from("competencies")
    .select(
      "id, name, name_ar, description, sort_order, validation_evidence, competency_clusters(name, name_ar, sort_order, competency_domains(name, name_ar, sort_order))"
    );

  // Supabase types to-one embeds as arrays; at runtime they're single
  // objects (cluster_id / domain_id are many-to-one). Cast through unknown.
  const rows = (data ?? []) as unknown as Row[];

  // Aggregate counts for the header.
  const counts = { verified: 0, ai_proposed: 0, rejected: 0, none: 0 } as Record<StatusKey, number>;
  for (const r of rows) counts[statusOf(r.validation_evidence)]++;
  const total = rows.length;
  const pct = total ? Math.round((counts.verified / total) * 100) : 0;

  // Group by domain → cluster, preserving sort order.
  const domains = new Map<
    string,
    { sort: number; display: string; clusters: Map<string, { sort: number; items: Row[] }> }
  >();
  for (const r of rows) {
    const dom = r.competency_clusters?.competency_domains;
    const dName = dom?.name ?? "Unassigned";
    const dDisplay = dom ? localizedName(dom, rtl) : "Unassigned";
    const dSort = dom?.sort_order ?? 999;
    const cName = r.competency_clusters?.name ?? "Unassigned";
    const cSort = r.competency_clusters?.sort_order ?? 999;
    if (!domains.has(dName)) domains.set(dName, { sort: dSort, display: dDisplay, clusters: new Map() });
    const d = domains.get(dName)!;
    if (!d.clusters.has(cName)) d.clusters.set(cName, { sort: cSort, items: [] });
    d.clusters.get(cName)!.items.push(r);
  }
  const sortedDomains = Array.from(domains.entries()).sort((a, b) => a[1].sort - b[1].sort);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <BackLink href="/admin" label="Back" history />
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="h-5 w-5 text-accent" />
        <h1 className="text-xl font-bold">Assessment Center — Evidence Console</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Per-competency research provenance. Anchor each competency to the published
        assessment-centre / competency-modelling literature so a client spot-check on any
        competency has a defensible answer. Only <strong>Documented</strong> (human-verified)
        anchors are surfaced in client deliverables.
      </p>

      {error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 mb-4">
          Could not load competencies: {error.message}
        </div>
      )}

      <BulkEvidenceButtons show={["ac"]} />

      {/* Coverage summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Documented" value={counts.verified} accent="text-emerald-700" />
        <SummaryCard label="AI proposed" value={counts.ai_proposed} accent="text-amber-700" />
        <SummaryCard label="Not documented" value={counts.none + counts.rejected} accent="text-muted-foreground" />
        <SummaryCard label="Coverage" value={`${pct}%`} accent="text-accent" />
      </div>

      <div className="space-y-6">
        {sortedDomains.map(([dName, d]) => {
          const sortedClusters = Array.from(d.clusters.entries()).sort((a, b) => a[1].sort - b[1].sort);
          return (
            <section key={dName}>
              <div className="flex items-center gap-2 mb-2">
                <BookOpenCheck className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{d.display}</h2>
              </div>
              <div className="rounded-lg border bg-card divide-y divide-border">
                {sortedClusters.flatMap(([, c]) =>
                  c.items
                    .sort((a, b) => a.sort_order - b.sort_order)
                    .map((r) => {
                      const s = statusOf(r.validation_evidence);
                      const meta = STATUS_META[s];
                      return (
                        <Link
                          key={r.id}
                          href={`/admin/ac-evidence/${r.id}`}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{localizedName(r, rtl)}</p>
                            {r.validation_evidence?.anchor_instruments?.length ? (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {r.validation_evidence.anchor_instruments.length} anchor(s) ·{" "}
                                {r.validation_evidence.anchor_instruments[0]?.name}
                              </p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground italic">No research anchors yet</p>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border shrink-0 ${meta.tone}`}>
                            {meta.label}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </Link>
                      );
                    })
                )}
              </div>
            </section>
          );
        })}
      </div>

      {total === 0 && !error && (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          <FlaskConical className="h-6 w-6 mx-auto mb-2 opacity-50" />
          No competencies found in the database.
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}
