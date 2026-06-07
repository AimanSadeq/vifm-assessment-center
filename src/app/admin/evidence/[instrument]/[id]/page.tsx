import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EvidencePanel } from "@/components/admin/evidence-panel";
import { getEvidenceAdapter } from "@/lib/evidence/instruments";

export const dynamic = "force-dynamic";

/**
 * Generic per-construct evidence detail page for the four adapter-driven
 * instruments. Shows the construct's context (skill/domain/framework/
 * scale) and the validation-evidence editor. Counterpart to the AC
 * detail page at /admin/ac-evidence/[competencyId].
 */

type Props = { params: { instrument: string; id: string } };

export default async function InstrumentEvidenceDetailPage({ params }: Props) {
  const adapter = getEvidenceAdapter(params.instrument);
  if (!adapter) notFound();

  const detail = await adapter.loadOne(params.id);
  if (!detail) notFound();

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href={adapter.basePath}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {adapter.label} Evidence Console
      </Link>

      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{detail.group}</div>
      <h1 className="text-xl font-bold mb-4">{detail.label}</h1>

      {detail.contextLines.length > 0 && (
        <div className="rounded-lg border bg-card mb-6 p-5">
          <h2 className="text-sm font-semibold mb-3">Construct context</h2>
          <dl className="space-y-1.5">
            {detail.contextLines.map((l, i) => (
              <div key={i} className="grid grid-cols-[110px_1fr] gap-2 text-sm">
                <dt className="text-[11px] uppercase tracking-wider text-muted-foreground pt-0.5">{l.k}</dt>
                <dd className="text-foreground/90">{l.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <EvidencePanel
        instrumentKey={adapter.key}
        itemId={detail.id}
        reviewerEmail="admin@vifm.ae"
        initialEvidence={detail.evidence}
      />
    </div>
  );
}
