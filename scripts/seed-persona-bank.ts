/**
 * Seed the Persona managed item bank from the code constant
 * (src/lib/scoring/behavioral-items.ts) into persona_items as status='pending'.
 * 41 competencies x 4 items = 164. Idempotent on item_key (upsert, ignore
 * duplicates). Items land 'pending' - none have been SME-reviewed yet.
 *
 * Requires migration 00185. Run: npx tsx scripts/seed-persona-bank.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { BEHAVIORAL_COMPETENCIES } from "../src/lib/scoring/behavioral-items";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log("Seeding Persona item bank (pending)...");
  const rows = BEHAVIORAL_COMPETENCIES.flatMap((c) =>
    c.items.map((it) => ({
      ac_competency_id: c.acCompetencyId,
      item_key: it.itemKey,
      ord: it.ord,
      reverse: it.reverse,
      text_en: it.textEn,
      text_ar: it.textAr ?? null,
      status: "pending",
      source: "seed_v1",
      ar_reviewed: false,
    }))
  );

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { data, error } = await supabase
      .from("persona_items")
      .upsert(chunk, { onConflict: "item_key", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    inserted += data?.length ?? 0;
  }
  console.log(`Inserted ${inserted} of ${rows.length} items (skipped ${rows.length - inserted} existing by item_key).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
