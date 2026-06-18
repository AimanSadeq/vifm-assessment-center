import { createServiceClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/shared/back-link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network } from "lucide-react";
import { CLUSTER_DEFINITIONS, DOMAIN_DEFINITIONS } from "@/lib/competencies/framework-definitions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Competency Framework · VIFM" };

// The VIFM behavioural competency framework on one page: 4 domains, 9 clusters
// (each with a definition) and 41 competencies (each with its definition). This
// is the single framework behind every VIFM instrument - Assessment Center,
// Persona, the Reflect 360, Succession Readiness and the course recommender.
// Read-only reference; sourced live from competency_domains / _clusters /
// competencies, with cluster + domain definitions from framework-definitions.ts.

type Domain = { id: string; name: string; sort_order: number };
type Cluster = { id: string; name: string; domain_id: string; sort_order: number };
type Competency = { id: string; name: string; description: string | null; cluster_id: string; sort_order: number };

// Domain accent palette - matches the THINKING/RESULTS/PEOPLE/SELF colours used
// across the JD-extractor tally and the candidate stats charts.
const DOMAIN_TONE: Record<string, { text: string; chip: string; bar: string }> = {
  THINKING: { text: "text-blue-700", chip: "bg-blue-50 text-blue-700 border-blue-200", bar: "bg-blue-500" },
  RESULTS: { text: "text-emerald-700", chip: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "bg-emerald-500" },
  PEOPLE: { text: "text-amber-700", chip: "bg-amber-50 text-amber-700 border-amber-200", bar: "bg-amber-500" },
  SELF: { text: "text-violet-700", chip: "bg-violet-50 text-violet-700 border-violet-200", bar: "bg-violet-500" },
};
const TONE_FALLBACK = { text: "text-slate-700", chip: "bg-slate-50 text-slate-700 border-slate-200", bar: "bg-slate-500" };

export default async function FrameworkPage() {
  const sb = createServiceClient();
  const [domRes, clRes, compRes] = await Promise.all([
    sb.from("competency_domains").select("id, name, sort_order").order("sort_order"),
    sb.from("competency_clusters").select("id, name, domain_id, sort_order").order("sort_order"),
    sb.from("competencies").select("id, name, description, cluster_id, sort_order").order("sort_order"),
  ]);
  const domains = (domRes.data ?? []) as Domain[];
  const clusters = (clRes.data ?? []) as Cluster[];
  const competencies = (compRes.data ?? []) as Competency[];

  const clustersOf = (domainId: string) => clusters.filter((c) => c.domain_id === domainId);
  const compsOf = (clusterId: string) => competencies.filter((c) => c.cluster_id === clusterId);

  return (
    <div className="space-y-6">
      <BackLink href="/admin" label="Back" history />

      <header>
        <h1 className="inline-flex items-center gap-2 text-2xl font-bold text-[#010131]">
          <Network className="h-6 w-6 text-[#5391D5]" /> VIFM Competency Framework
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          The single behavioural framework behind every VIFM instrument - the Assessment Center,
          Persona, the Reflect 360, Succession Readiness and the course recommender all score against
          it. Organised as four domains, nine clusters and forty-one competencies.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-full border bg-card px-3 py-1">{domains.length} domains</span>
          <span className="rounded-full border bg-card px-3 py-1">{clusters.length} clusters</span>
          <span className="rounded-full border bg-card px-3 py-1">{competencies.length} competencies</span>
        </div>
      </header>

      {domains.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            The framework tables are empty. Apply the seed migrations (00002 / 00100) to populate domains,
            clusters and competencies.
          </CardContent>
        </Card>
      ) : (
        domains.map((domain) => {
          const tone = DOMAIN_TONE[domain.name] ?? TONE_FALLBACK;
          const domainClusters = clustersOf(domain.id);
          const domainCompCount = domainClusters.reduce((n, cl) => n + compsOf(cl.id).length, 0);
          return (
            <section key={domain.id} className="space-y-3">
              <div className="border-b-2 pb-2" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className={`text-xl font-extrabold uppercase tracking-tight ${tone.text}`}>{domain.name}</h2>
                  <span className="text-xs text-muted-foreground">
                    {domainClusters.length} clusters · {domainCompCount} competencies
                  </span>
                </div>
                {DOMAIN_DEFINITIONS[domain.name] ? (
                  <p className="mt-0.5 text-sm text-muted-foreground">{DOMAIN_DEFINITIONS[domain.name]}</p>
                ) : null}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {domainClusters.map((cluster) => {
                  const comps = compsOf(cluster.id);
                  return (
                    <Card key={cluster.id} className="overflow-hidden">
                      <div className={`h-1 w-full ${tone.bar}`} />
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base text-[#010131]">{cluster.name}</CardTitle>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tone.chip}`}>
                            {comps.length} {comps.length === 1 ? "competency" : "competencies"}
                          </span>
                        </div>
                        {CLUSTER_DEFINITIONS[cluster.name] ? (
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {CLUSTER_DEFINITIONS[cluster.name]}
                          </p>
                        ) : null}
                      </CardHeader>
                      <CardContent className="pt-0">
                        <ol className="space-y-2.5">
                          {comps.map((c, i) => (
                            <li key={c.id} className="border-t border-slate-100 pt-2.5 first:border-0 first:pt-0">
                              <div className="flex items-baseline gap-2">
                                <span className="text-[11px] font-semibold tabular-nums text-slate-400">{i + 1}.</span>
                                <span className="text-sm font-semibold text-[#121232]">{c.name}</span>
                              </div>
                              {c.description ? (
                                <p className="ms-5 mt-0.5 text-xs leading-relaxed text-muted-foreground">{c.description}</p>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
