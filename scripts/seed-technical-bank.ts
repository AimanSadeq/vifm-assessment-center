/**
 * Seed the vetted VIFM technical-certification item bank into tech_assessment_items
 * as status='in_review' (NOT approved) - the bank is filled ahead of demand, but
 * the certified/credential path stays gated until a human SME approves each domain.
 * ~150 items across 10 finance domains x 5 skills, mixed formats, EN + MSA Arabic,
 * authored to the taxonomy then adversarially SME-reviewed for answer-key correctness.
 * Idempotent (keyed on the review_notes marker).
 *
 * Run: npx tsx scripts/seed-technical-bank.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { TECHNICAL_SEED_V1 } from "../src/lib/competencies/technical-seed";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SEED_MARKER = "techno_seed_v1: AI-authored + AI-construct-reviewed; pending human SME sign-off";

async function main() {
  console.log("Seeding technical bank (in_review)...");
  const { count } = await supabase
    .from("tech_assessment_items")
    .select("id", { count: "exact", head: true })
    .eq("review_notes", SEED_MARKER);
  if ((count ?? 0) > 0) {
    console.log(`Already seeded (${count} items with the seed marker). Nothing to do.`);
    return;
  }

  const rows = TECHNICAL_SEED_V1.map((it) => ({
    domain_key: it.domain_key,
    skill: it.skill,
    question_type: it.question_type,
    question_en: it.question_en,
    question_ar: it.question_ar,
    scenario_en: it.question_type === "scenario" ? (it.scenario_en ?? null) : null,
    scenario_ar: it.question_type === "scenario" ? (it.scenario_ar ?? null) : null,
    options_en: it.options_en,
    options_ar: it.options_ar,
    correct_index: it.correct_index,
    correct_indices: null,
    difficulty: it.difficulty,
    explanation_en: it.explanation_en ?? null,
    status: "in_review",
    source: "ai_generated",
    review_notes: SEED_MARKER,
  }));

  // Insert in chunks so one bad row doesn't sink the batch silently.
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase.from("tech_assessment_items").insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }
  console.log(`Inserted ${inserted} items as in_review (source='ai_generated').`);

  const byDomain: Record<string, number> = {};
  for (const it of TECHNICAL_SEED_V1) byDomain[it.domain_key] = (byDomain[it.domain_key] ?? 0) + 1;
  console.log("Per-domain:", JSON.stringify(byDomain));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
