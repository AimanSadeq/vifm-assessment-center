import { createServiceClient } from "@/lib/supabase/server";
import {
  BARS_SCALE,
  CLUSTER_DEFINITIONS,
  resolveDomainVisual,
  type DomainVisual,
} from "@/lib/competencies/framework-definitions";
import { FrameworkGrid } from "./_components/framework-grid";

export const dynamic = "force-dynamic";
export const metadata = { title: "Competency Framework · VIFM" };

// The VIFM behavioural competency framework rendered as a branded grid:
// four domains -> clusters -> competencies, each on a five-point BARS, with
// search, per-domain filtering and an EN/AR toggle. Read-only reference.
//
// Data is read LIVE from the competency catalogue (competency_domains /
// _clusters / competencies) so counts and the set are never hardcoded - a 9th
// cluster + its competencies appear automatically once seeded. Bilingual
// columns (name_ar / description_ar, migration 00071) are fetched tolerantly:
// if a DB predates them the rich select falls back to the EN-only columns.
// The whole /admin surface is already admin-role-gated in admin/layout.tsx.

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

export type CompNode = { id: string; nameEn: string; nameAr: string; descEn: string; descAr: string; seq: number };
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

// Fetch a table with the rich (bilingual) column set; on a 42703 "column does
// not exist" fall back to the EN-only columns (DB predates migration 00071).
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

const titleCase = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default async function FrameworkPage() {
  const sb = createServiceClient();
  const [domains, clusters, comps] = await Promise.all([
    fetchTolerant<DomainRow>(sb, "competency_domains", "id, name, name_ar, sort_order", "id, name, sort_order"),
    fetchTolerant<ClusterRow>(sb, "competency_clusters", "id, name, name_ar, domain_id, sort_order", "id, name, domain_id, sort_order"),
    fetchTolerant<CompRow>(
      sb,
      "competencies",
      "id, name, name_ar, description, description_ar, cluster_id, sort_order",
      "id, name, description, cluster_id, sort_order",
    ),
  ]);

  // Shape into domains -> clusters -> competencies, assigning a stable sequential
  // number across the whole framework in display order (domain, then cluster,
  // then competency). The number is fixed here so search/filter never renumber.
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

  const counts = {
    domains: tree.length,
    clusters: tree.reduce((n, d) => n + d.clusters.length, 0),
    competencies: tree.reduce((n, d) => n + d.compCount, 0),
    scalePoints: BARS_SCALE.length,
  };

  return <FrameworkGrid domains={tree} scale={BARS_SCALE} counts={counts} />;
}
