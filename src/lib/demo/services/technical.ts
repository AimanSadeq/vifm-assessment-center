// Demo-data module: Technical proficiency ("Techno").
//
// Seeds completed technical-sandbox SITTINGS so the admin results screen
// (/admin/tech-sandbox/results) and the per-sitting development report
// (/admin/tech-sandbox/results/[token]) populate for a BD demo.
//
// IMPORTANT - which tables back the screen: the prompt referenced
// `tech_assessment_results`, but the live results list is driven by
// `technical_sandbox_sessions` (migration 00077) joined to
// `technical_functions`, filtered to status='submitted'
// (see src/lib/technical-sandbox/service.ts → listSubmittedSessions).
// The detail report reads per-block `technical_sandbox_responses`. So this
// module seeds those sandbox tables, not the legacy MCQ results table.
//
// Sessions are NOT org-scoped (no organization_id column - they carry a free
// `organization_name`). We therefore tag every demo sitting with the demo
// org's display name (DEMO_SENTINEL substring is in DEMO_ORG_NAME) and demo
// emails, which is how purge/count find exactly these rows.
//
// We attach the demo sittings to whichever technical FUNCTION is `active` and
// already has skill blocks (FP&A 1.7 in the live seed). The per-block
// responses are synthesized from each block's REAL checkpoints so the detail
// report bands every sub-area correctly. Best-effort + tolerant: a missing
// table (un-applied 00077) returns a clean "skipped" note / null count.

import type { DemoServiceModule, DemoSb, DemoOrgIds } from "./types";
import {
  DEMO_ORG_NAME,
  DEMO_EMAIL_DOMAIN,
  type DemoSeedOutcome,
  type DemoServiceCount,
} from "../constants";

const SERVICE = "technical";
const LABEL = "Techno";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

// "advanced" >= 85, "intermediate" >= 60, else "basic" (mirrors
// src/lib/technical-sandbox/validators.ts tierFor()).
const bandFor = (pct: number): "advanced" | "intermediate" | "basic" =>
  pct >= 85 ? "advanced" : pct >= 60 ? "intermediate" : "basic";

type FnRow = { id: string; node_id: string | null; name_en: string };
type PillarRow = { id: string; name_en: string; sort_order: number };
type BlockRow = {
  id: string;
  pillar_id: string;
  name_en: string;
  checkpoints: unknown;
  sort_order: number;
};
type Checkpoint = { id?: string; kind?: string; weight?: number; label_en?: string; label_ar?: string };

/** A "schema not applied yet" error - lets seed/count degrade instead of 500. */
function isMissingSchema(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "42P01" || code === "42703" || code === "PGRST204";
}

/** Locate the active demo function (FP&A) + its blocks; null if unseeded. */
async function loadActiveFunction(
  sb: DemoSb,
): Promise<{ fn: FnRow; pillars: PillarRow[]; blocks: BlockRow[] } | null> {
  const fnRes = await sb
    .from("technical_functions")
    .select("id, node_id, name_en")
    .eq("node_status", "active")
    .order("node_id")
    .limit(1)
    .maybeSingle();
  if (fnRes.error) {
    if (isMissingSchema(fnRes.error)) return null;
    throw new Error(`tech functions: ${fnRes.error.message}`);
  }
  const fn = fnRes.data as FnRow | null;
  if (!fn) return null;

  const pRes = await sb
    .from("technical_pillars")
    .select("id, name_en, sort_order")
    .eq("function_id", fn.id)
    .order("sort_order");
  if (pRes.error) {
    if (isMissingSchema(pRes.error)) return null;
    throw new Error(`tech pillars: ${pRes.error.message}`);
  }
  const pillars = (pRes.data ?? []) as PillarRow[];
  const pillarIds = pillars.map((p) => p.id);
  if (pillarIds.length === 0) return { fn, pillars, blocks: [] };

  const bRes = await sb
    .from("technical_skill_blocks")
    .select("id, pillar_id, name_en, checkpoints, sort_order")
    .in("pillar_id", pillarIds)
    .eq("status", "active")
    .order("sort_order");
  if (bRes.error) {
    if (isMissingSchema(bRes.error)) return null;
    throw new Error(`tech blocks: ${bRes.error.message}`);
  }
  return { fn, pillars, blocks: (bRes.data ?? []) as BlockRow[] };
}

/** Synthesize a checkpoint_results array for a block at a target score %.
 *  Passes checkpoints (in weight order) until the weighted pass-rate reaches
 *  the target, so the report's missed-checkpoint narrative reads realistically. */
function synthCheckpointResults(checkpoints: Checkpoint[], targetPct: number) {
  const cps = checkpoints.map((c, i) => ({
    id: String(c.id ?? `cp${i}`),
    kind: String(c.kind ?? "cell_value"),
    weight: Number(c.weight ?? 1),
    label_en: c.label_en ?? c.id ?? `Checkpoint ${i + 1}`,
    label_ar: c.label_ar ?? null,
  }));
  const total = cps.reduce((s, c) => s + c.weight, 0) || 1;
  // Pass the highest-weight checkpoints first up to the target weight.
  const ordered = [...cps].sort((a, b) => b.weight - a.weight);
  const wantWeight = (Math.max(0, Math.min(100, targetPct)) / 100) * total;
  let accrued = 0;
  const passById = new Map<string, boolean>();
  for (const c of ordered) {
    const pass = accrued + c.weight <= wantWeight + 1e-6;
    passById.set(c.id, pass);
    if (pass) accrued += c.weight;
  }
  const results = cps.map((c) => ({
    id: c.id,
    kind: c.kind,
    weight: c.weight,
    passed: passById.get(c.id) ?? false,
    label_en: c.label_en,
    label_ar: c.label_ar,
    detail: passById.get(c.id) ? "met" : "not met",
  }));
  const passedWeight = results.reduce((s, c) => s + (c.passed ? c.weight : 0), 0);
  const scorePct = Math.round((passedWeight / total) * 100);
  return { results, scorePct };
}

const seed = async (sb: DemoSb, _org: DemoOrgIds): Promise<DemoSeedOutcome> => {
  // Idempotency: any demo-tagged submitted sitting means we've already seeded.
  const existing = await sb
    .from("technical_sandbox_sessions")
    .select("id")
    .eq("organization_name", DEMO_ORG_NAME)
    .limit(1);
  if (existing.error && isMissingSchema(existing.error)) {
    return { service: SERVICE, label: LABEL, created: 0, note: "skipped (apply migration 00077)" };
  }
  if (existing.error) throw new Error(`tech sessions probe: ${existing.error.message}`);
  if (existing.data && existing.data.length > 0) {
    return { service: SERVICE, label: LABEL, created: 0, note: "already present" };
  }

  const active = await loadActiveFunction(sb);
  if (!active || active.blocks.length === 0) {
    return {
      service: SERVICE,
      label: LABEL,
      created: 0,
      note: "skipped (no active technical function with skill blocks - apply 00077 seed)",
    };
  }
  const { fn, blocks } = active;

  // Three completed sittings: an Advanced, an Intermediate, and a Basic
  // profile, so the cohort/results screen reads realistically.
  const takers = [
    { name: "Khalid Al Faraj", target: 90, day: 1 }, // advanced
    { name: "Maryam Al Hashimi", target: 68, day: 3 }, // intermediate
    { name: "Tariq Al Nuaimi", target: 44, day: 6 }, // basic
  ];

  let created = 0;
  for (const t of takers) {
    const email = `${t.name.toLowerCase().replace(/[^a-z]+/g, ".")}@${DEMO_EMAIL_DOMAIN}`;

    // Per-block responses synthesized from each block's real checkpoints; the
    // session overall is the mean of the block scores (matches scoreSession's
    // simple-mean roll-up in src/lib/technical-sandbox/scoring.ts).
    const perBlock = blocks.map((b, i) => {
      // Spread block targets ±10% around the taker's target so categories differ.
      const blockTarget = Math.max(0, Math.min(100, t.target + (i % 2 === 0 ? 6 : -8)));
      const { results, scorePct } = synthCheckpointResults(
        (b.checkpoints ?? []) as Checkpoint[],
        blockTarget,
      );
      return { block: b, results, scorePct };
    });
    const overallPct = Math.round(
      perBlock.reduce((s, x) => s + x.scorePct, 0) / (perBlock.length || 1),
    );

    const sessRes = await sb
      .from("technical_sandbox_sessions")
      .insert({
        function_id: fn.id,
        candidate_name: t.name,
        candidate_email: email,
        organization_name: DEMO_ORG_NAME,
        status: "submitted",
        invited_at: daysAgo(t.day + 5),
        started_at: daysAgo(t.day),
        submitted_at: daysAgo(t.day),
        expires_at: daysAgo(t.day - 1),
        overall_score_pct: overallPct,
        overall_band: bandFor(overallPct),
      })
      .select("id")
      .single();
    if (sessRes.error || !sessRes.data) {
      throw new Error(`tech sandbox session: ${sessRes.error?.message}`);
    }
    const sessionId = sessRes.data.id as string;

    const responseRows = perBlock.map((x) => ({
      session_id: sessionId,
      skill_block_id: x.block.id,
      work: {},
      status: "validated" as const,
      score_pct: x.scorePct,
      band: bandFor(x.scorePct),
      checkpoint_results: x.results,
      started_at: daysAgo(t.day),
      submitted_at: daysAgo(t.day),
      validated_at: daysAgo(t.day),
    }));
    const respRes = await sb.from("technical_sandbox_responses").insert(responseRows);
    if (respRes.error) throw new Error(`tech sandbox responses: ${respRes.error.message}`);

    created += 1;
  }

  return {
    service: SERVICE,
    label: LABEL,
    created,
    note: `${created} completed ${fn.name_en} sittings (advanced / intermediate / basic)`,
  };
};

const purge = async (sb: DemoSb, _org: DemoOrgIds): Promise<string> => {
  const sessRes = await sb
    .from("technical_sandbox_sessions")
    .select("id")
    .eq("organization_name", DEMO_ORG_NAME);
  if (sessRes.error) {
    if (isMissingSchema(sessRes.error)) return "skipped (table absent)";
    throw new Error(sessRes.error.message);
  }
  const ids = ((sessRes.data ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return "no demo sittings";

  // Children first (responses FK session_id), then the sittings themselves.
  await sb.from("technical_sandbox_responses").delete().in("session_id", ids);
  const del = await sb.from("technical_sandbox_sessions").delete().in("id", ids);
  if (del.error) throw new Error(del.error.message);
  return `technical sittings removed (${ids.length})`;
};

const count = async (sb: DemoSb, _org: DemoOrgIds): Promise<DemoServiceCount | null> => {
  const res = await sb
    .from("technical_sandbox_sessions")
    .select("id", { count: "exact", head: true })
    .eq("organization_name", DEMO_ORG_NAME)
    .eq("status", "submitted");
  if (res.error) {
    if (isMissingSchema(res.error)) return null;
    return null;
  }
  return { service: SERVICE, label: LABEL, count: res.count ?? 0 };
};

const technicalModule: DemoServiceModule = {
  id: SERVICE,
  label: LABEL,
  seed,
  purge,
  count,
};

export default technicalModule;
