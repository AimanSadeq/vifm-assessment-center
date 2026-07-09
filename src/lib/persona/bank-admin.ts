// Persona bank - SME console data (server-only). Groups persona_items by
// competency (names from the code constant) so an admin can review + approve.

import { createServiceClient } from "@/lib/supabase/server";
import { BEHAVIORAL_COMPETENCIES } from "@/lib/scoring/behavioral-items";

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
  clusterNameEn: string;
  pending: number;
  approved: number;
  items: PersonaBankItem[];
};
export type PersonaBankView = {
  tableReady: boolean;
  competencies: PersonaBankCompetency[];
  totals: { total: number; approved: number; pending: number };
};

export async function loadPersonaBankAdmin(): Promise<PersonaBankView> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc
      .from("persona_items")
      .select("id, ac_competency_id, item_key, ord, reverse, text_en, text_ar, status")
      .order("item_key", { ascending: true });
    if (error || !data) return { tableReady: false, competencies: [], totals: { total: 0, approved: 0, pending: 0 } };

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
        clusterNameEn: c.clusterNameEn,
        pending: items.filter((i) => i.status === "pending").length,
        approved: items.filter((i) => i.status === "approved").length,
        items,
      };
    });
    const rows = data as Array<{ status: string }>;
    return {
      tableReady: true,
      competencies,
      totals: {
        total: rows.length,
        approved: rows.filter((r) => r.status === "approved").length,
        pending: rows.filter((r) => r.status === "pending").length,
      },
    };
  } catch {
    return { tableReady: false, competencies: [], totals: { total: 0, approved: 0, pending: 0 } };
  }
}
