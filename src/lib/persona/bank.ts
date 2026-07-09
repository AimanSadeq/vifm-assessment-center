// Persona managed item bank (migration 00185). Promotes the code-resident items
// (behavioral-items.ts) into a DB bank with an SME review gate, while keeping the
// code constant's competency/cluster metadata (names, ordering) stable. The
// runner serves the curated bank (pending + approved), falling back to the code
// items per-competency when the DB has none - so Persona never serves empty.

import { createServiceClient } from "@/lib/supabase/server";
import {
  BEHAVIORAL_COMPETENCIES,
  type BehavioralCompetency,
  type BehavioralItem,
} from "@/lib/scoring/behavioral-items";

type Row = {
  id: string;
  ac_competency_id: string;
  item_key: string;
  ord: number;
  reverse: boolean;
  text_en: string;
  text_ar: string | null;
  status: string;
};

/** Persona competencies with items served from the managed bank (curated =
 *  pending + approved). Per-competency fallback to the code items when the DB
 *  has none (or the table is unapplied). Same shape as BEHAVIORAL_COMPETENCIES. */
export async function loadPersonaCompetencies(): Promise<BehavioralCompetency[]> {
  let rows: Row[] = [];
  try {
    const svc = createServiceClient();
    const { data, error } = await svc
      .from("persona_items")
      .select("id, ac_competency_id, item_key, ord, reverse, text_en, text_ar, status")
      .in("status", ["pending", "approved"])
      .order("ac_competency_id", { ascending: true })
      .order("ord", { ascending: true });
    if (!error && data) rows = data as Row[];
  } catch {
    rows = [];
  }

  const byComp = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byComp.get(r.ac_competency_id) ?? [];
    arr.push(r);
    byComp.set(r.ac_competency_id, arr);
  }

  return BEHAVIORAL_COMPETENCIES.map((c) => {
    const dbItems = (byComp.get(c.acCompetencyId) ?? []).slice().sort((a, b) => a.ord - b.ord);
    if (dbItems.length === 0) return c; // fallback to the code items
    const items: BehavioralItem[] = dbItems.map((r) => ({
      itemKey: r.item_key,
      acCompetencyId: c.acCompetencyId,
      ord: r.ord,
      reverse: r.reverse,
      textEn: r.text_en,
      textAr: r.text_ar ?? "",
    }));
    return { ...c, items };
  });
}

/** Bank counts for the readiness dashboard + provisional predicate. */
export async function loadPersonaBankStatus(): Promise<{
  total: number;
  approved: number;
  pending: number;
  tableReady: boolean;
}> {
  try {
    const svc = createServiceClient();
    const { data, error } = await svc.from("persona_items").select("status");
    if (error || !data) return { total: 0, approved: 0, pending: 0, tableReady: false };
    const approved = data.filter((r) => (r as { status: string }).status === "approved").length;
    const pending = data.filter((r) => (r as { status: string }).status === "pending").length;
    return { total: data.length, approved, pending, tableReady: true };
  } catch {
    return { total: 0, approved: 0, pending: 0, tableReady: false };
  }
}

/** A Persona sitting is provisional if any served item is not SME-approved.
 *  Coarse-but-honest: while the whole bank is pending, every sitting is flagged;
 *  clears once a competency's items are approved. Returns false when the table is
 *  unapplied (legacy code-served path). */
export async function personaBankProvisional(): Promise<{ provisional: boolean; pending: number; total: number }> {
  const s = await loadPersonaBankStatus();
  if (!s.tableReady || s.total === 0) return { provisional: false, pending: 0, total: 0 };
  return { provisional: s.pending > 0, pending: s.pending, total: s.total };
}
