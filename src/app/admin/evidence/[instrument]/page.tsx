import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, FlaskConical, ChevronRight, BookOpenCheck } from "lucide-react";
import { BulkEvidenceButtons } from "@/components/admin/bulk-evidence-buttons";
import { getEvidenceAdapter } from "@/lib/evidence/instruments";
import type { ValidationEvidence } from "@/types/evidence";

export const dynamic = "force-dynamic";

/**
 * Generic per-construct evidence console for the four adapter-driven
 * instruments (Fluent / Technical / Reflect / Psychometrics). The
 * [instrument] segment selects the adapter; the page lists its
 * constructs grouped by skill/domain/framework/instrument with each
 * one's validation-evidence status. Counterpart to the bespoke AC
 * console at /admin/ac-evidence. Aggregated into /admin/evidence-map.
 */

type Props = { params: { instrument: string } };

type StatusKey = "verified" | "ai_proposed" | "rejected" | "none";

function statusOf(ev: ValidationEvidence | null): StatusKey {
  if (!ev) return "none";
  if (ev.review_status === "verified" || ev.review_status === "edited") return "verified";
  if (ev.review_status === "ai_proposed") return "ai_proposed";
  if (ev.review_status === "rejected") return "rejected";
  return "none";
}

const STATUS_META: Record<StatusKey, { label: string; tone: string }> = {
  verified:    { label: "Documented",     tone: "bg-emerald-100 text-emerald-900 border-emerald-200" },
  ai_proposed: { label: "AI proposed",    tone: "bg-amber-100 text-amber-900 border-amber-200" },
  rejected:    { label: "Rejected",       tone: "bg-rose-100 text-rose-900 border-rose-200" },
  none:        { label: "Not documented", tone: "bg-muted text-muted-foreground border-border" },
};

export default async function InstrumentEvidencePage({ params }: Props) {
  const adapter = getEvidenceAdapter(params.instrument);
  if (!adapter) notFound();

  const items = await adapter.listItems();

  const counts = { verified: 0, ai_proposed: 0, rejected: 0, none: 0 } as Record<StatusKey, number>;
  for (const it of items) counts[statusOf(it.evidence)]++;
  const total = items.length;
  const pct = total ? Math.round((counts.verified / total) * 100) : 0;

  // Group by the adapter-provided group (skill / domain / framework / instrument).
  const groups = new Map<string, typeof items>();
  for (const it of items) {
    if (!groups.has(it.group)) groups.set(it.group, []);
    groups.get(it.group)!.push(it);
  }
  const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="h-5 w-5 text-accent" />
        <h1 className="text-xl font-bold">{adapter.label} — Evidence Console</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        {adapter.blurb} Only <strong>Documented</strong> (human-verified) anchors are surfaced in
        client deliverables.
      </p>

      <BulkEvidenceButtons show={[adapter.key]} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Documented" value={counts.verified} accent="text-emerald-700" />
        <SummaryCard label="AI proposed" value={counts.ai_proposed} accent="text-amber-700" />
        <SummaryCard label="Not documented" value={counts.none + counts.rejected} accent="text-muted-foreground" />
        <SummaryCard label="Coverage" value={`${pct}%`} accent="text-accent" />
      </div>

      <div className="space-y-6">
        {sortedGroups.map(([gName, gItems]) => (
          <section key={gName}>
            <div className="flex items-center gap-2 mb-2">
              <BookOpenCheck className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{gName}</h2>
              <span className="text-[11px] text-muted-foreground">({gItems.length})</span>
            </div>
            <div className="rounded-lg border bg-card divide-y divide-border">
              {gItems.map((it) => {
                const s = statusOf(it.evidence);
                const meta = STATUS_META[s];
                return (
                  <Link
                    key={it.id}
                    href={`${adapter.basePath}/${it.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{it.label}</p>
                      {it.evidence?.anchor_instruments?.length ? (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {it.evidence.anchor_instruments.length} anchor(s) ·{" "}
                          {it.evidence.anchor_instruments[0]?.name}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground italic">
                          {it.sublabel ? `${it.sublabel} · ` : ""}No research anchors yet
                        </p>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border shrink-0 ${meta.tone}`}>
                      {meta.label}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {total === 0 && (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          <FlaskConical className="h-6 w-6 mx-auto mb-2 opacity-50" />
          No {adapter.unitNoun}s found in the database for this instrument.
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
