import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { ArrowLeft } from "lucide-react";
import { CompetencyEvidencePanel } from "./_components/competency-evidence-panel";
import type { ValidationEvidence } from "@/types/evidence";

export const dynamic = "force-dynamic";

type Props = { params: { competencyId: string } };

type Detail = {
  id: string;
  name: string;
  description: string | null;
  validation_evidence: ValidationEvidence | null;
  competency_clusters: {
    name: string;
    competency_domains: { name: string } | null;
  } | null;
  behavioral_indicators: Array<{
    indicator_type: string;
    description: string;
    sort_order: number;
  }>;
};

export default async function CompetencyEvidenceDetailPage({ params }: Props) {
  const sb = createServiceClient();
  const { data } = await sb
    .from("competencies")
    .select(
      "id, name, description, validation_evidence, competency_clusters(name, competency_domains(name)), behavioral_indicators(indicator_type, description, sort_order)"
    )
    .eq("id", params.competencyId)
    .maybeSingle<Detail>();

  if (!data) notFound();

  const domain = data.competency_clusters?.competency_domains?.name ?? "Unassigned";
  const cluster = data.competency_clusters?.name ?? "";
  const indicators = (data.behavioral_indicators ?? []).sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <Link
        href="/admin/ac-evidence"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Evidence Console
      </Link>

      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {domain}
        {cluster ? ` · ${cluster}` : ""}
      </div>
      <h1 className="text-xl font-bold mb-2">{data.name}</h1>
      {data.description && <p className="text-sm text-muted-foreground mb-5">{data.description}</p>}

      {/* Behavioural indicators give the AI suggester + reviewer construct context. */}
      {indicators.length > 0 && (
        <div className="rounded-lg border bg-card mb-6 p-5">
          <h2 className="text-sm font-semibold mb-3">Behavioural indicators ({indicators.length})</h2>
          <ul className="space-y-1.5">
            {indicators.map((ind, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${
                    ind.indicator_type === "positive" ? "bg-emerald-500" : "bg-rose-400"
                  }`}
                />
                <span className="text-foreground/90">{ind.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <CompetencyEvidencePanel
        competencyId={data.id}
        reviewerEmail="admin@vifm.ae"
        initialEvidence={data.validation_evidence}
      />
    </div>
  );
}
