// Fluent receptive bank - admin/SME console data (server-only).
// Groups the curated (non-accumulated) items by skill x CEFR level so an SME can
// review + promote them to 'live' (which activates bank-serving in the runner).
// A skill serves once every CEFR level in the ramp has enough LIVE items.

import { createServiceClient } from "@/lib/supabase/server";
import { CEFR_ORDER, type CefrLevel } from "@/lib/ai/fluent-english";

export type FluentItemStatus = "draft" | "calibrating" | "live" | "in_review" | "rejected" | "retired";

/** Served ramp per skill: 2 each A1-B2, 1 each C1/C2. */
export const FLUENT_RAMP: Record<CefrLevel, number> = { A1: 2, A2: 2, B1: 2, B2: 2, C1: 1, C2: 1 };

export type FluentItem = {
  id: string;
  skill: "reading" | "listening";
  cefr: string;
  content: string; // passage or script
  question: string;
  options: string[];
  correct_index: number;
  status: FluentItemStatus;
};

export type FluentCell = {
  skill: "reading" | "listening";
  cefr: CefrLevel;
  need: number;
  live: number;
  inReview: number;
  items: FluentItem[];
};

export type FluentBankView = {
  tableReady: boolean;
  cells: FluentCell[];
  totals: { live: number; inReview: number; readingServable: boolean; listeningServable: boolean };
};

type Row = { id: string; skill: string; stem: unknown; cefr_label: string | null; status: string };
type Stem = { passage?: unknown; script?: unknown; question?: unknown; options?: unknown; correct_index?: unknown; cefr?: unknown };
const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export async function loadFluentBank(): Promise<FluentBankView> {
  const svc = createServiceClient();
  let tableReady = true;
  const byKey = new Map<string, FluentItem[]>();
  try {
    const { data, error } = await svc
      .from("eng_fluent_items")
      .select("id, skill, stem, cefr_label, status")
      .in("status", ["in_review", "live", "rejected", "retired"])
      .limit(5000);
    if (error) throw error;
    for (const r of (data ?? []) as Row[]) {
      const st = (r.stem ?? {}) as Stem;
      const skill = r.skill === "listening" ? "listening" : "reading";
      const cefr = (CEFR_ORDER.includes((r.cefr_label ?? st.cefr) as CefrLevel) ? (r.cefr_label ?? st.cefr) : "B1") as string;
      const item: FluentItem = {
        id: r.id, skill, cefr,
        content: String((skill === "reading" ? st.passage : st.script) ?? ""),
        question: String(st.question ?? ""),
        options: asStrArr(st.options),
        correct_index: typeof st.correct_index === "number" ? st.correct_index : 0,
        status: (["draft", "calibrating", "live", "in_review", "rejected", "retired"] as const).includes(r.status as never) ? (r.status as FluentItemStatus) : "in_review",
      };
      const k = `${skill}:${cefr}`;
      const arr = byKey.get(k) ?? [];
      arr.push(item);
      byKey.set(k, arr);
    }
  } catch {
    tableReady = false;
  }

  const cells: FluentCell[] = [];
  for (const skill of ["reading", "listening"] as const) {
    for (const cefr of CEFR_ORDER) {
      const items = byKey.get(`${skill}:${cefr}`) ?? [];
      cells.push({
        skill, cefr, need: FLUENT_RAMP[cefr],
        live: items.filter((i) => i.status === "live").length,
        inReview: items.filter((i) => i.status === "in_review").length,
        items,
      });
    }
  }
  const servable = (skill: "reading" | "listening") =>
    CEFR_ORDER.every((c) => (cells.find((x) => x.skill === skill && x.cefr === c)?.live ?? 0) >= FLUENT_RAMP[c]);
  const totals = {
    live: cells.reduce((s, c) => s + c.live, 0),
    inReview: cells.reduce((s, c) => s + c.inReview, 0),
    readingServable: servable("reading"),
    listeningServable: servable("listening"),
  };
  return { tableReady, cells, totals };
}
