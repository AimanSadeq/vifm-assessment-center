/**
 * Seed the vetted competency quiz bank into competency_quiz_items as
 * status='in_review' (NOT approved) - the bank is filled ahead of demand, but a
 * sitting only draws from it once a human SME approves a competency's items.
 * Bilingual SJT/MCQ items across the behavioural competencies, authored grounded
 * in each competency's behavioural indicators then adversarially reviewed.
 *
 * Per-competency idempotent: skips competencies already seeded, so an expanded
 * seed file (as more competencies are authored) adds only the new ones.
 *
 * Requires migration 00180 (competency_quiz_items).
 * Run: npx tsx scripts/seed-competency-quiz-bank.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { COMPETENCY_QUIZ_SEED_V1 } from "../src/lib/competencies/competency-quiz-seed";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const POINTS: Record<string, number> = { easy: 10, medium: 15, hard: 20 };

async function main() {
  console.log("Seeding competency quiz bank (in_review)...");
  const { data: existing } = await supabase
    .from("competency_quiz_items")
    .select("competency_id")
    .eq("source", "seed");
  const seeded = new Set((existing ?? []).map((r) => (r as { competency_id: string }).competency_id));

  const toInsert = COMPETENCY_QUIZ_SEED_V1.filter((it) => !seeded.has(it.competency_id));
  if (toInsert.length === 0) {
    console.log("All seed competencies already present. Nothing to do.");
    return;
  }

  const rows = toInsert.map((it) => ({
    competency_id: it.competency_id,
    type: it.type,
    prompt_en: it.prompt_en,
    prompt_ar: it.prompt_ar,
    options_en: it.options_en,
    options_ar: it.options_ar,
    correct_index: it.correct_index,
    points: POINTS[it.difficulty] ?? 15,
    difficulty: it.difficulty,
    explanation_en: it.explanation_en ?? null,
    explanation_ar: it.explanation_ar ?? null,
    sequence: null,
    status: "in_review",
    source: "seed",
    ar_reviewed: false,
  }));

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase.from("competency_quiz_items").insert(chunk);
    if (error) throw error;
    inserted += chunk.length;
  }
  const newComps = new Set(toInsert.map((it) => it.competency_name));
  console.log(`Inserted ${inserted} items (in_review) across ${newComps.size} newly-seeded competencies.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
