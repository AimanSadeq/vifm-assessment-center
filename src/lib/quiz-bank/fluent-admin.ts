// Fluent receptive bank - admin/SME console data (server-only).
// Groups the curated (non-accumulated) items by skill x CEFR level so an SME can
// review + promote them to 'live' (which activates bank-serving in the runner).
// A skill serves once every CEFR level in the ramp has enough LIVE items.

import { createServiceClient } from "@/lib/supabase/server";
import { CEFR_ORDER, type CefrLevel } from "@/lib/ai/fluent-english";

import {
  PROMPT_MIN,
  type FluentItemStatus,
  type FluentItem,
  type FluentPrompt,
  type FluentCell,
} from "./fluent-constants";
export { PROMPT_MIN };
export type { FluentItemStatus, FluentItem, FluentPrompt, FluentCell };

/** Served ramp per skill: 2 each A1-B2, 1 each C1/C2. */
export const FLUENT_RAMP: Record<CefrLevel, number> = { A1: 2, A2: 2, B1: 2, B2: 2, C1: 1, C2: 1 };

export type FluentBankView = {
  tableReady: boolean;
  cells: FluentCell[];
  prompts: FluentPrompt[];
  totals: {
    live: number;
    inReview: number;
    readingServable: boolean;
    listeningServable: boolean;
    writingLive: number;
    speakingLive: number;
    writingInReview: number;
    speakingInReview: number;
    writingServable: boolean;
    speakingServable: boolean;
  };
};

type Row = { id: string; skill: string; stem: unknown; cefr_label: string | null; status: string };
type Stem = {
  passage?: unknown; script?: unknown; question?: unknown; options?: unknown; correct_index?: unknown; cefr?: unknown;
  prompt_en?: unknown; prompt_ar?: unknown; cefr_target?: unknown;
};
const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export async function loadFluentBank(): Promise<FluentBankView> {
  const svc = createServiceClient();
  let tableReady = true;
  const byKey = new Map<string, FluentItem[]>();
  const prompts: FluentPrompt[] = [];
  const normStatus = (s: string): FluentItemStatus =>
    (["draft", "calibrating", "live", "in_review", "rejected", "retired"] as const).includes(s as never) ? (s as FluentItemStatus) : "in_review";
  try {
    const { data, error } = await svc
      .from("eng_fluent_items")
      .select("id, skill, stem, cefr_label, status")
      .in("status", ["in_review", "live", "rejected", "retired"])
      .limit(5000);
    if (error) throw error;
    for (const r of (data ?? []) as Row[]) {
      const st = (r.stem ?? {}) as Stem;
      // Productive skills (writing/speaking) are prompts, not CEFR-ramp MCQs.
      if (r.skill === "writing" || r.skill === "speaking") {
        prompts.push({
          id: r.id, skill: r.skill,
          cefr: (r.cefr_label ?? String(st.cefr_target ?? "B1")) as string,
          prompt_en: String(st.prompt_en ?? ""),
          prompt_ar: String(st.prompt_ar ?? ""),
          status: normStatus(r.status),
        });
        continue;
      }
      const skill = r.skill === "listening" ? "listening" : "reading";
      const cefr = (CEFR_ORDER.includes((r.cefr_label ?? st.cefr) as CefrLevel) ? (r.cefr_label ?? st.cefr) : "B1") as string;
      const item: FluentItem = {
        id: r.id, skill, cefr,
        content: String((skill === "reading" ? st.passage : st.script) ?? ""),
        question: String(st.question ?? ""),
        options: asStrArr(st.options),
        correct_index: typeof st.correct_index === "number" ? st.correct_index : 0,
        status: normStatus(r.status),
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
  const promptLive = (skill: "writing" | "speaking") => prompts.filter((p) => p.skill === skill && p.status === "live").length;
  const promptInReview = (skill: "writing" | "speaking") => prompts.filter((p) => p.skill === skill && p.status === "in_review").length;
  const totals = {
    live: cells.reduce((s, c) => s + c.live, 0) + promptLive("writing") + promptLive("speaking"),
    inReview: cells.reduce((s, c) => s + c.inReview, 0) + promptInReview("writing") + promptInReview("speaking"),
    readingServable: servable("reading"),
    listeningServable: servable("listening"),
    writingLive: promptLive("writing"),
    speakingLive: promptLive("speaking"),
    writingInReview: promptInReview("writing"),
    speakingInReview: promptInReview("speaking"),
    writingServable: promptLive("writing") >= PROMPT_MIN,
    speakingServable: promptLive("speaking") >= PROMPT_MIN,
  };
  return { tableReady, cells, prompts, totals };
}
