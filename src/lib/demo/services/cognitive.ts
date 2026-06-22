// Demo-data module for Logica (cognitive reasoning). Seeds completed psy_results
// rows (kind = 'cognitive') so /ac/cognitive/cohort populates with a realistic
// GCC finance cohort. psy_results gained organization_id in migration 00105, so
// org-scope when the column exists; otherwise the rows still surface in the cohort
// (sentinel email keeps them purge-findable either way).
//
// Shapes mirror the live scorer (src/lib/psychometrics/scoring.ts):
//   scales  = ScaleScore[]  {key, raw, normalized, band, bandLabel}
//   overall = {normalized, band, bandLabel}  (the g composite)
//   result  = the full PsyResult (kind, scales, overall, answeredCount, totalCount)

import type { DemoServiceModule, DemoSb, DemoOrgIds } from "./types";
import { DEMO_EMAIL_DOMAIN, type DemoSeedOutcome, type DemoServiceCount } from "../constants";

const SERVICE = "cognitive";
const LABEL = "Logica";

// Subtest keys in canonical order (mirrors COGNITIVE_SUBTESTS in the framework).
const SUBTESTS = ["numerical", "verbal", "inductive", "deductive"] as const;

type Band = "low" | "below" | "average" | "above" | "high";
const BAND_LABEL: Record<Band, string> = {
  low: "Low",
  below: "Below average",
  average: "Average",
  above: "Above average",
  high: "High",
};

/** % correct → indicative band (mirrors cognitiveBand in the framework). */
function bandFromPct(pct: number): Band {
  if (pct < 40) return "low";
  if (pct < 60) return "below";
  if (pct < 75) return "average";
  if (pct < 90) return "above";
  return "high";
}

type Scale = { key: string; raw: number; normalized: number; band: Band; bandLabel: string };

function scaleFor(key: string, pct: number): Scale {
  const band = bandFromPct(pct);
  return { key, raw: pct, normalized: pct, band, bandLabel: BAND_LABEL[band] };
}

/** Build a complete cognitive result row from per-subtest percentages. */
function buildRow(name: string, pcts: [number, number, number, number]) {
  const scales = SUBTESTS.map((k, i) => scaleFor(k, pcts[i]));
  const g = Math.round(scales.reduce((a, s) => a + s.normalized, 0) / scales.length);
  const gBand = bandFromPct(g);
  const overall = { normalized: g, band: gBand, bandLabel: BAND_LABEL[gBand] };
  const totalCount = 24; // ~6 items / subtest, indicative deck
  const result = {
    kind: "cognitive" as const,
    scales,
    overall,
    answeredCount: totalCount,
    totalCount,
    tier: "indicative" as const,
  };
  return {
    name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@${DEMO_EMAIL_DOMAIN}`,
    scales,
    overall,
    result,
  };
}

// A realistic GCC finance cohort: one strong, one mid, one developing taker.
const ROWS = [
  buildRow("Khalid Al Rashidi", [88, 80, 78, 84]), // g ≈ 83 → above
  buildRow("Maryam Al Suwaidi", [70, 62, 55, 66]), // g ≈ 63 → average
  buildRow("Tariq Al Balushi", [48, 42, 38, 50]), // g ≈ 45 → below
];

// ───────────────────────────────────── seed ──────────────────────────────────
async function seed(sb: DemoSb, org: DemoOrgIds): Promise<DemoSeedOutcome> {
  // Idempotency: skip if a demo cognitive result already exists. Match on the
  // sentinel email so a re-run after an org-id schema change is still detected.
  const existing = await sb
    .from("psy_results")
    .select("id")
    .eq("kind", "cognitive")
    .ilike("taker_email", `%@${DEMO_EMAIL_DOMAIN}`)
    .limit(1);
  if (existing.data && existing.data.length > 0) {
    return { service: SERVICE, label: LABEL, created: 0, note: "already present" };
  }

  const baseRows = ROWS.map((r) => ({
    instrument_id: null,
    kind: "cognitive",
    taker_name: r.name,
    taker_email: r.email,
    scales: r.scales,
    overall: r.overall,
    validity: null,
    result: r.result,
  }));

  // Org-scope when migration 00105 added organization_id; fall back to the base
  // shape (no org column) so a fresh DB without 00105 still seeds + appears in the
  // cohort (the sentinel email keeps the rows purge-findable).
  let ins = await sb.from("psy_results").insert(
    baseRows.map((row) => ({ ...row, organization_id: org.organizationId }))
  );
  if (ins.error) {
    ins = await sb.from("psy_results").insert(baseRows);
  }
  if (ins.error) throw new Error(`Logica cognitive results: ${ins.error.message}`);

  return {
    service: SERVICE,
    label: LABEL,
    created: ROWS.length,
    note: "3 cognitive results (above / average / below) for the cohort report",
  };
}

// ──────────────────────────────────── purge ──────────────────────────────────
async function purge(sb: DemoSb, org: DemoOrgIds): Promise<string> {
  // Find this service's demo result ids (org-scoped OR sentinel email), delete the
  // FK child (psy_item_responses) first, then the results themselves.
  const byEmail = await sb
    .from("psy_results")
    .select("id")
    .eq("kind", "cognitive")
    .ilike("taker_email", `%@${DEMO_EMAIL_DOMAIN}`);
  const idSet = new Set<string>(((byEmail.data ?? []) as { id: string }[]).map((r) => r.id));

  // Also catch any org-scoped demo rows (best-effort; column may not exist).
  const byOrg = await sb
    .from("psy_results")
    .select("id")
    .eq("kind", "cognitive")
    .eq("organization_id", org.organizationId);
  if (!byOrg.error) {
    for (const r of (byOrg.data ?? []) as { id: string }[]) idSet.add(r.id);
  }

  const ids = Array.from(idSet);
  if (ids.length === 0) return "no cognitive results";

  await sb.from("psy_item_responses").delete().in("result_id", ids);
  const del = await sb.from("psy_results").delete().in("id", ids);
  if (del.error) throw new Error(del.error.message);
  return `cognitive results removed (${ids.length})`;
}

// ──────────────────────────────────── count ──────────────────────────────────
async function count(sb: DemoSb, org: DemoOrgIds): Promise<DemoServiceCount | null> {
  try {
    // Org-scoped count first (00105); fall back to the sentinel-email count so a
    // pre-00105 DB still reports correctly. A missing table returns null.
    let res = await sb
      .from("psy_results")
      .select("id", { count: "exact", head: true })
      .eq("kind", "cognitive")
      .eq("organization_id", org.organizationId);
    if (res.error) {
      res = await sb
        .from("psy_results")
        .select("id", { count: "exact", head: true })
        .eq("kind", "cognitive")
        .ilike("taker_email", `%@${DEMO_EMAIL_DOMAIN}`);
    }
    if (res.error) return null;
    return { service: SERVICE, label: LABEL, count: res.count ?? 0 };
  } catch {
    return null;
  }
}

const cognitiveModule: DemoServiceModule = { id: SERVICE, label: LABEL, seed, purge, count };
export default cognitiveModule;
