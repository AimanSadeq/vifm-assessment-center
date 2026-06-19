import "server-only";
import { createServiceClient } from "@/lib/supabase/server";
import { BARS_SCALE, CLUSTER_DEFINITIONS, resolveDomainVisual, type DomainVisual } from "@/lib/competencies/framework-definitions";

// Shared loader for the VIFM behavioural competency framework tree (domains ->
// clusters -> competencies, each with its positive/negative behavioural
// indicators). Read live from the catalogue so counts + the set are never
// hardcoded. Used by /admin/framework (grid) AND the framework PDF route, so the
// on-screen reference and the downloadable PDF can never drift.

type DomainRow = { id: string; name: string; name_ar: string | null; sort_order: number };
type ClusterRow = { id: string; name: string; name_ar: string | null; domain_id: string; sort_order: number };
type CompRow = {
  id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  description_ar: string | null;
  cluster_id: string;
  sort_order: number;
};
type IndicatorRow = { competency_id: string; indicator_type: "positive" | "negative"; description: string; sort_order: number };

export type CompNode = {
  id: string;
  nameEn: string;
  nameAr: string;
  descEn: string;
  descAr: string;
  seq: number;
  /** Behavioural indicators (EN-only in the catalogue). */
  positives: string[];
  negatives: string[];
};
export type ClusterNode = { id: string; nameEn: string; nameAr: string; defEn: string; comps: CompNode[] };
export type DomainNode = {
  id: string;
  nameUpper: string;
  displayEn: string;
  nameAr: string;
  key: string;
  visual: DomainVisual;
  clusters: ClusterNode[];
  compCount: number;
};
export type FrameworkCounts = { domains: number; clusters: number; competencies: number; scalePoints: number; indicators: number };

async function fetchTolerant<T>(
  sb: ReturnType<typeof createServiceClient>,
  table: string,
  richCols: string,
  leanCols: string,
): Promise<T[]> {
  const rich = await sb.from(table).select(richCols).order("sort_order");
  if (!rich.error) return (rich.data ?? []) as T[];
  const lean = await sb.from(table).select(leanCols).order("sort_order");
  return (lean.data ?? []) as T[];
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export async function loadFrameworkTree(): Promise<{ domains: DomainNode[]; counts: FrameworkCounts }> {
  const sb = createServiceClient();
  const [domains, clusters, comps, indicators] = await Promise.all([
    fetchTolerant<DomainRow>(sb, "competency_domains", "id, name, name_ar, sort_order", "id, name, sort_order"),
    fetchTolerant<ClusterRow>(sb, "competency_clusters", "id, name, name_ar, domain_id, sort_order", "id, name, domain_id, sort_order"),
    fetchTolerant<CompRow>(
      sb,
      "competencies",
      "id, name, name_ar, description, description_ar, cluster_id, sort_order",
      "id, name, description, cluster_id, sort_order",
    ),
    (async (): Promise<IndicatorRow[]> => {
      const { data } = await sb
        .from("behavioral_indicators")
        .select("competency_id, indicator_type, description, sort_order")
        .order("sort_order");
      return (data ?? []) as IndicatorRow[];
    })(),
  ]);

  const posByComp = new Map<string, string[]>();
  const negByComp = new Map<string, string[]>();
  let indicatorCount = 0;
  for (const i of indicators) {
    const desc = i.description?.trim();
    // Development tips are seeded into the same table (migration 00004) tagged
    // "[DEV TIP] ..." with indicator_type='positive'. They are coaching
    // suggestions, NOT positive/negative behavioural indicators, so exclude them.
    if (!desc || desc.startsWith("[DEV TIP]")) continue;
    indicatorCount += 1;
    const map = i.indicator_type === "negative" ? negByComp : posByComp;
    const arr = map.get(i.competency_id) ?? [];
    arr.push(desc);
    map.set(i.competency_id, arr);
  }

  let seq = 0;
  const tree: DomainNode[] = domains.map((d, di) => {
    const dClusters = clusters
      .filter((c) => c.domain_id === d.id)
      .map((c): ClusterNode => {
        const cComps = comps
          .filter((k) => k.cluster_id === c.id)
          .map((k): CompNode => {
            seq += 1;
            return {
              id: k.id,
              nameEn: k.name,
              nameAr: k.name_ar?.trim() || k.name,
              descEn: k.description?.trim() || "",
              descAr: k.description_ar?.trim() || k.description?.trim() || "",
              seq,
              positives: posByComp.get(k.id) ?? [],
              negatives: negByComp.get(k.id) ?? [],
            };
          });
        return {
          id: c.id,
          nameEn: c.name,
          nameAr: c.name_ar?.trim() || c.name,
          defEn: CLUSTER_DEFINITIONS[c.name] ?? "",
          comps: cComps,
        };
      });
    return {
      id: d.id,
      nameUpper: d.name,
      displayEn: titleCase(d.name),
      nameAr: d.name_ar?.trim() || titleCase(d.name),
      key: d.name.toLowerCase(),
      visual: resolveDomainVisual(d.name, di, domains.length),
      clusters: dClusters,
      compCount: dClusters.reduce((n, c) => n + c.comps.length, 0),
    };
  });

  const counts: FrameworkCounts = {
    domains: tree.length,
    clusters: tree.reduce((n, d) => n + d.clusters.length, 0),
    competencies: tree.reduce((n, d) => n + d.compCount, 0),
    scalePoints: BARS_SCALE.length,
    indicators: indicatorCount,
  };
  return { domains: tree, counts };
}
