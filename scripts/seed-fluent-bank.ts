/**
 * Seed the vetted Fluent receptive bank into eng_fluent_items as
 * status='in_review' (NOT live) - the bank is filled ahead of demand, but the
 * runner only serves items an SME has promoted to 'live'. 120 CEFR-ramped
 * reading + listening MCQs (2 skills x 6 CEFR levels x 10), authored to the CEFR
 * anchors then adversarially level-reviewed.
 *
 * Idempotent via the content_hash UNIQUE index (upsert, ignore duplicates) - the
 * SAME canonical hash the runner uses, so seed items merge with any identical
 * accumulated item rather than duplicating.
 *
 * Requires migration 00181 (review states on eng_fluent_items).
 * Run: npx tsx scripts/seed-fluent-bank.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { createHash } from "crypto";
import { FLUENT_SEED_V1 } from "../src/lib/competencies/fluent-seed";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Permutation-stable content identity (matches the runner's itemHash): options
 *  hashed SORTED and keyed by the correct option's TEXT, not its index. */
function itemHash(skill: string, content: string, question: string, options: string[], correctIndex: number): string {
  return createHash("sha256")
    .update(JSON.stringify({ skill, content, question, options: [...options].sort(), correct: options[correctIndex] ?? correctIndex }))
    .digest("hex");
}

async function main() {
  console.log("Seeding Fluent receptive bank (in_review)...");
  const rows = FLUENT_SEED_V1.map((it) => {
    const sorted = [...it.options].sort();
    const canonIndex = sorted.indexOf(it.options[it.correct_index]);
    const contentKey = it.skill === "reading" ? "passage" : "script";
    const stem = { [contentKey]: it.content, question: it.question, options: sorted, correct_index: canonIndex, cefr: it.cefr };
    return {
      skill: it.skill,
      content_hash: itemHash(it.skill, it.content, it.question, it.options, it.correct_index),
      stem,
      cefr_label: it.cefr,
      status: "in_review",
      source: "seed",
    };
  });

  // Dedupe within the batch (identical content would violate the unique index).
  const seen = new Set<string>();
  const dedup = rows.filter((r) => (seen.has(r.content_hash) ? false : (seen.add(r.content_hash), true)));

  let inserted = 0;
  for (let i = 0; i < dedup.length; i += 50) {
    const chunk = dedup.slice(i, i + 50);
    const { data, error } = await supabase
      .from("eng_fluent_items")
      .upsert(chunk, { onConflict: "content_hash", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    inserted += data?.length ?? 0;
  }
  console.log(`Inserted ${inserted} of ${dedup.length} items (skipped ${dedup.length - inserted} existing by content_hash).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
