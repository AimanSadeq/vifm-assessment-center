// Persona bank - SME console data (server-only). Groups persona_items by the
// full VIFM framework hierarchy: 4 domains -> 9 clusters -> 41 competencies ->
// items, so an admin reviews + approves in the same shape the report uses.

import { createServiceClient } from "@/lib/supabase/server";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";
import { DOMAIN_ORDER, CLUSTER_TO_DOMAIN, type DomainName } from "@/lib/competencies/framework-definitions";

export type PersonaBankItem = {
  id: string;
  item_key: string;
  ord: number;
  reverse: boolean;
  text_en: string;
  text_ar: string | null;
  status: string;
};
export type PersonaBankCompetency = {
  acCompetencyId: string;
  nameEn: string;
  nameAr: string;
  clusterOrder: number;
  clusterNameEn: string;
  clusterNameAr: string;
  pending: number;
  approved: number;
  items: PersonaBankItem[];
};
export type PersonaBankCluster = {
  clusterOrder: number;
  clusterNameEn: string;
  clusterNameAr: string;
  total: number;
  approved: number;
  pending: number;
  competencies: PersonaBankCompetency[];
};
export type PersonaBankDomain = {
  domain: DomainName;
  total: number;
  approved: number;
  pending: number;
  clusters: PersonaBankCluster[];
};
export type PersonaBankView = {
  tableReady: boolean;
  domains: PersonaBankDomain[];
  totals: { total: number; approved: number; pending: number };
};

const DOMAIN_INDEX = Object.fromEntries(DOMAIN_ORDER.map((d, i) => [d, i])) as Record<DomainName, number>;

export async function loadPersonaBankAdmin(): Promise<PersonaBankView> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc
      .from("persona_items")
      .select("id, ac_competency_id, item_key, ord, reverse, text_en, text_ar, status")
      .order("item_key", { ascending: true });
    if (error || !data) return { tableReady: false, domains: [], totals: { total: 0, approved: 0, pending: 0 } };

    const byComp = new Map<string, PersonaBankItem[]>();
    for (const r of data as Array<PersonaBankItem & { ac_competency_id: string }>) {
      const arr = byComp.get(r.ac_competency_id) ?? [];
      arr.push({ id: r.id, item_key: r.item_key, ord: r.ord, reverse: r.reverse, text_en: r.text_en, text_ar: r.text_ar, status: r.status });
      byComp.set(r.ac_competency_id, arr);
    }

    const competencies: PersonaBankCompetency[] = BEHAVIORAL_COMPETENCIES.filter((c) => byComp.has(c.acCompetencyId)).map((c) => {
      const items = (byComp.get(c.acCompetencyId) ?? []).slice().sort((a, b) => a.ord - b.ord);
      return {
        acCompetencyId: c.acCompetencyId,
        nameEn: c.nameEn,
        nameAr: c.nameAr,
        clusterOrder: c.clusterOrder,
        clusterNameEn: c.clusterNameEn,
        clusterNameAr: c.clusterNameAr,
        pending: items.filter((i) => i.status === "pending").length,
        approved: items.filter((i) => i.status === "approved").length,
        items,
      };
    });

    // Group competencies -> clusters -> domains.
    const clusterMap = new Map<number, PersonaBankCluster>();
    for (const comp of competencies) {
      let cl = clusterMap.get(comp.clusterOrder);
      if (!cl) {
        cl = { clusterOrder: comp.clusterOrder, clusterNameEn: comp.clusterNameEn, clusterNameAr: comp.clusterNameAr, total: 0, approved: 0, pending: 0, competencies: [] };
        clusterMap.set(comp.clusterOrder, cl);
      }
      cl.competencies.push(comp);
      cl.total += comp.items.length;
      cl.approved += comp.approved;
      cl.pending += comp.pending;
    }

    const domainMap = new Map<DomainName, PersonaBankDomain>();
    for (const cl of clusterMap.values()) {
      const domain = CLUSTER_TO_DOMAIN[cl.clusterNameEn] ?? "SELF";
      let dm = domainMap.get(domain);
      if (!dm) {
        dm = { domain, total: 0, approved: 0, pending: 0, clusters: [] };
        domainMap.set(domain, dm);
      }
      dm.clusters.push(cl);
      dm.total += cl.total;
      dm.approved += cl.approved;
      dm.pending += cl.pending;
    }

    const domains = [...domainMap.values()]
      .sort((a, b) => DOMAIN_INDEX[a.domain] - DOMAIN_INDEX[b.domain])
      .map((d) => ({ ...d, clusters: d.clusters.slice().sort((a, b) => a.clusterOrder - b.clusterOrder) }));

    const rows = data as Array<{ status: string }>;
    return {
      tableReady: true,
      domains,
      totals: {
        total: rows.length,
        approved: rows.filter((r) => r.status === "approved").length,
        pending: rows.filter((r) => r.status === "pending").length,
      },
    };
  } catch {
    return { tableReady: false, domains: [], totals: { total: 0, approved: 0, pending: 0 } };
  }
}
