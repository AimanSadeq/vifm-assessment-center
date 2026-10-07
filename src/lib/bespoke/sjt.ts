// Scenario-question (SJT) stage for bespoke bundles (00234).
// A candidate sees each scenario's situation and four responses and marks one
// MOST and one LEAST effective. Each response is keyed to a level; the keys
// never leave the server. Scores per competency are points on a 0-12 scale
// (three scenarios), banded by configurable cut-offs, and stored with the
// config used so results can be rescored.

import { randomInt } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/server";

export {
  OPTION_LEVELS,
  LEVEL_NAMES,
  DEFAULT_SJT_CONFIG,
  sanitiseSjtConfig,
  type OptionLevel,
  type SjtOption,
  type SjtItem,
  type BundleCompetency,
  type SjtConfig,
} from "./sjt-shared";
import { OPTION_LEVELS, type SjtItem, type SjtOption, type BundleCompetency, type SjtConfig } from "./sjt-shared";

export type SjtAnswer = { most: string; least: string };
export type CompetencyScore = { points: number; max: number; scaled: number; level: number; answered: number; items: number };

/** Pure scoring. Unanswered or invalid answers score 0 for that scenario. */
export function scoreSjt(items: SjtItem[], answers: Record<string, SjtAnswer>, cfg: SjtConfig): Record<string, CompetencyScore> {
  const maxMost = Math.max(...OPTION_LEVELS.map((l) => cfg.points[l]));
  const perItemMax = maxMost + cfg.leastCounterBonus;
  const out: Record<string, CompetencyScore> = {};
  for (const it of items) {
    const s = (out[it.competency_code] ??= { points: 0, max: 0, scaled: 0, level: 0, answered: 0, items: 0 });
    s.items += 1;
    s.max += perItemMax;
    const a = answers[it.id];
    const most = a && it.options.find((o) => o.key === a.most);
    const least = a && it.options.find((o) => o.key === a.least);
    if (!most || !least || most.key === least.key) continue;
    s.answered += 1;
    s.points += cfg.points[most.level] + (least.level === "Counter-evidence" ? cfg.leastCounterBonus : 0);
  }
  for (const s of Object.values(out)) {
    s.scaled = s.max ? Math.round((s.points / s.max) * 12 * 10) / 10 : 0;
    s.level = s.scaled >= cfg.cuts.advanced ? 3 : s.scaled >= cfg.cuts.proficient ? 2 : s.scaled >= cfg.cuts.basic ? 1 : 0;
  }
  return out;
}

function shuffle<T>(a: T[]): T[] {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
}

/** The candidate's fixed presentation order: scenarios, and responses within each. */
export function buildItemOrder(items: SjtItem[], comps: BundleCompetency[], cfg: SjtConfig): Array<{ id: string; opts: string[] }> {
  const lvl = { Basic: 0, Proficient: 1, Advanced: 2 } as const;
  const compOrder = new Map(comps.map((c) => [c.code, c.sort_order]));
  const ordered =
    cfg.order === "grouped"
      ? [...items].sort((a, b) => (compOrder.get(a.competency_code) ?? 99) - (compOrder.get(b.competency_code) ?? 99) || lvl[a.target_level] - lvl[b.target_level] || a.sort_order - b.sort_order)
      : shuffle(items);
  return ordered.map((it) => ({ id: it.id, opts: shuffle(it.options.map((o) => o.key)) }));
}

// ── Data access ─────────────────────────────────────────────────

export async function loadSjtItems(bundleId: string): Promise<SjtItem[]> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("bundle_sjt_items")
      .select("id, ref, competency_code, target_level, situation, options, sort_order")
      .eq("bespoke_service_id", bundleId)
      .eq("active", true)
      .order("sort_order");
    return ((data ?? []) as SjtItem[]).sort((a, b) => a.sort_order - b.sort_order);
  } catch {
    return [];
  }
}

export async function loadBundleCompetencies(bundleId: string): Promise<BundleCompetency[]> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("bundle_competencies")
      .select("code, name, category, definition, required_levels, sort_order")
      .eq("bespoke_service_id", bundleId)
      .order("sort_order");
    return ((data ?? []) as BundleCompetency[]).sort((a, b) => a.sort_order - b.sort_order);
  } catch {
    return [];
  }
}

type ResultRow = {
  id: string;
  item_order: Array<{ id: string; opts: string[] }>;
  answers: Record<string, SjtAnswer>;
  submitted_at: string | null;
};

export async function loadSjtResult(candidateId: string): Promise<ResultRow | null> {
  try {
    const sb = createServiceClient();
    const { data } = await sb
      .from("bundle_sjt_results")
      .select("id, item_order, answers, submitted_at")
      .eq("bundle_candidate_id", candidateId)
      .maybeSingle<ResultRow>();
    return data ?? null;
  } catch {
    return null;
  }
}

/** What the browser receives: no levels, no indicator ids. */
export type PublicSjtItem = { id: string; situation: string; options: Array<{ key: string; text: string }> };

type Ctx = { candidate: { id: string }; bundle: { id: string }; settings: { sjtConfig: SjtConfig } };

export async function startSjt(
  ctx: Ctx,
): Promise<{ ok: true; items: PublicSjtItem[]; answers: Record<string, SjtAnswer> } | { ok: false; error: string; status: number }> {
  const items = await loadSjtItems(ctx.bundle.id);
  if (items.length === 0) return { ok: false, error: "The scenario section is not ready yet. Please try again later.", status: 503 };
  const byId = new Map(items.map((i) => [i.id, i]));

  let row = await loadSjtResult(ctx.candidate.id);
  if (row?.submitted_at) return { ok: false, error: "You have already submitted the scenario section.", status: 409 };
  if (!row) {
    const comps = await loadBundleCompetencies(ctx.bundle.id);
    const sb = createServiceClient();
    const { error } = await sb.from("bundle_sjt_results").insert({
      bundle_candidate_id: ctx.candidate.id,
      bespoke_service_id: ctx.bundle.id,
      item_order: buildItemOrder(items, comps, ctx.settings.sjtConfig),
      answers: {},
    });
    // A parallel tab may have created it first (unique per candidate): read whichever exists.
    void error;
    row = await loadSjtResult(ctx.candidate.id);
    if (!row) return { ok: false, error: "Could not start the scenario section.", status: 500 };
    await sb.from("bundle_candidates").update({ status: "in_progress" }).eq("id", ctx.candidate.id);
  }

  const publicItems: PublicSjtItem[] = [];
  for (const o of row.item_order) {
    const it = byId.get(o.id);
    if (!it) continue; // retired after this candidate started
    publicItems.push({
      id: it.id,
      situation: it.situation,
      options: o.opts.map((k) => it.options.find((x) => x.key === k)).filter((x): x is SjtOption => !!x).map((x) => ({ key: x.key, text: x.text })),
    });
  }
  return { ok: true, items: publicItems, answers: row.answers ?? {} };
}

export async function saveSjtAnswer(ctx: Ctx, itemId: string, most: string, least: string): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const row = await loadSjtResult(ctx.candidate.id);
  if (!row) return { ok: false, error: "Start the scenario section first.", status: 400 };
  if (row.submitted_at) return { ok: false, error: "You have already submitted the scenario section.", status: 409 };
  const entry = row.item_order.find((o) => o.id === itemId);
  if (!entry || !entry.opts.includes(most) || !entry.opts.includes(least) || most === least) {
    return { ok: false, error: "Choose one most effective and a different least effective response.", status: 400 };
  }
  const sb = createServiceClient();
  const { error } = await sb
    .from("bundle_sjt_results")
    .update({ answers: { ...(row.answers ?? {}), [itemId]: { most, least } } })
    .eq("id", row.id)
    .is("submitted_at", null);
  if (error) return { ok: false, error: "Could not save your answer. Please try again.", status: 500 };
  return { ok: true };
}

export async function submitSjt(ctx: Ctx): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const row = await loadSjtResult(ctx.candidate.id);
  if (!row) return { ok: false, error: "Start the scenario section first.", status: 400 };
  if (row.submitted_at) return { ok: false, error: "You have already submitted the scenario section.", status: 409 };
  const items = (await loadSjtItems(ctx.bundle.id)).filter((i) => row.item_order.some((o) => o.id === i.id));
  const missing = items.filter((i) => !row.answers?.[i.id]).length;
  if (missing > 0) return { ok: false, error: `Please answer every scenario (${missing} left).`, status: 400 };

  const cfg = ctx.settings.sjtConfig;
  const scores = scoreSjt(items, row.answers, cfg);
  const sb = createServiceClient();
  const { data, error } = await sb
    .from("bundle_sjt_results")
    .update({ scores, scoring_config: cfg, submitted_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("submitted_at", null)
    .select("id");
  if (error) return { ok: false, error: "Could not submit. Please try again.", status: 500 };
  if (!data || data.length === 0) return { ok: false, error: "You have already submitted the scenario section.", status: 409 };
  return { ok: true };
}
