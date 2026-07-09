/**
 * Seed the vetted VIFM cognitive item bank (Logica) into psy_items as IN_REVIEW.
 * 120 items = 4 subtests x 3 facets x 10 (3 easy / 4 medium / 3 hard), EN + MSA
 * Arabic, authored to the Cognitive Item-Bank Standard v1 blueprint. Idempotent
 * (keyed on source='seed_v1'). Self-bootstraps the psy_instruments/psy_scales rows.
 *
 * NOTE: items land in_review (NOT approved) by design - an automated seed must not
 * self-approve. A human SME approves each subtest in /admin/psychometrics; only then
 * does the bank serve the reviewed fixed form (until then a sitting mints live-AI).
 *
 * Requires migration 00179 (psy_items.facet / rationale / ar_reviewed).
 * Run: npx tsx scripts/seed-cognitive-bank.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { COGNITIVE_SEED_V1 } from "../src/lib/psychometrics/cognitive-seed";
import { COGNITIVE_INSTRUMENT, COGNITIVE_SUBTESTS } from "../src/lib/psychometrics/framework";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function resolveInstrumentId(): Promise<string> {
  const { data: found } = await supabase.from("psy_instruments").select("id").eq("code", COGNITIVE_INSTRUMENT.code).maybeSingle();
  if (found) return (found as { id: string }).id;
  const { data: created, error } = await supabase
    .from("psy_instruments")
    .insert({ kind: "cognitive", code: COGNITIVE_INSTRUMENT.code, name_en: COGNITIVE_INSTRUMENT.name_en, name_ar: COGNITIVE_INSTRUMENT.name_ar })
    .select("id").single();
  if (error) throw error;
  return (created as { id: string }).id;
}

async function resolveScaleId(instrumentId: string, key: string): Promise<string> {
  const def = COGNITIVE_SUBTESTS.find((s) => s.key === key)!;
  const { data: found } = await supabase.from("psy_scales").select("id").eq("instrument_id", instrumentId).eq("key", key).maybeSingle();
  if (found) return (found as { id: string }).id;
  const { data: created, error } = await supabase
    .from("psy_scales")
    .insert({ instrument_id: instrumentId, key, name_en: def.name_en, name_ar: def.name_ar })
    .select("id").single();
  if (error) throw error;
  return (created as { id: string }).id;
}

async function main() {
  console.log("Seeding cognitive bank (Logica)...");
  const { count } = await supabase.from("psy_items").select("id", { count: "exact", head: true }).eq("source", "seed_v1");
  if ((count ?? 0) > 0) {
    console.log(`Already seeded (${count} items with source='seed_v1'). Nothing to do.`);
    return;
  }

  const instrumentId = await resolveInstrumentId();
  const scaleIds: Record<string, string> = {};
  for (const s of COGNITIVE_SUBTESTS) scaleIds[s.key] = await resolveScaleId(instrumentId, s.key);
  console.log("Scales resolved:", Object.keys(scaleIds).join(", "));

  const rows = COGNITIVE_SEED_V1.map((it) => ({
    scale_id: scaleIds[it.subtest],
    kind: "mcq",
    facet: it.facet,
    stem_en: it.stem_en,
    stem_ar: it.stem_ar,
    options_en: it.options_en,
    options_ar: it.options_ar,
    correct_index: it.correct_index,
    reverse_keyed: false,
    difficulty: it.difficulty,
    rationale: it.rationale_en ?? null,
    ar_reviewed: false,
    status: "in_review",
    source: "seed_v1",
  }));

  const { error } = await supabase.from("psy_items").insert(rows);
  if (error) throw error;
  console.log(`Inserted ${rows.length} in_review cognitive items (source='seed_v1', ar_reviewed=false) - awaiting SME approval.`);

  // Report per-subtest / per-facet counts.
  const byCell: Record<string, number> = {};
  for (const it of COGNITIVE_SEED_V1) byCell[`${it.subtest}/${it.facet}`] = (byCell[`${it.subtest}/${it.facet}`] ?? 0) + 1;
  console.log("Per-facet:", JSON.stringify(byCell, null, 0));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
