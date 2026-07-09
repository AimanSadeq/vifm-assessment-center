/**
 * Seed the vetted Fluent PRODUCTIVE prompts (writing + speaking) into
 * eng_fluent_items as status='in_review'. These are AI-scored open tasks, so the
 * stem is a PROMPT (no options / answer key). An SME promotes them to 'live' in
 * /admin/fluent-bank; the assembler then serves live prompts (else falls back to
 * the in-code rotation).
 *
 * Requires migrations 00181 (review states) + 00183 (writing/speaking skills).
 * Run: npx tsx scripts/seed-fluent-prompts.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { createHash } from "crypto";
import { FLUENT_PROMPT_SEED_V1 } from "../src/lib/competencies/fluent-prompt-seed";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/** Stable identity for a prompt (no options): sha256 of skill + prompt + cefr. */
function promptHash(skill: string, promptEn: string, cefr: string): string {
  return createHash("sha256").update(JSON.stringify({ skill, prompt: promptEn.trim(), cefr })).digest("hex");
}

async function main() {
  console.log("Seeding Fluent productive prompts (writing + speaking, in_review)...");
  const rows = FLUENT_PROMPT_SEED_V1.map((p) => ({
    skill: p.skill,
    content_hash: promptHash(p.skill, p.prompt_en, p.cefr),
    stem: {
      prompt_en: p.prompt_en,
      prompt_ar: p.prompt_ar,
      cefr_target: p.cefr,
      ...(p.min_words != null ? { min_words: p.min_words } : {}),
      ...(p.min_seconds != null ? { min_seconds: p.min_seconds } : {}),
    },
    cefr_label: p.cefr,
    status: "in_review",
    source: "seed",
  }));

  const seen = new Set<string>();
  const dedup = rows.filter((r) => (seen.has(r.content_hash) ? false : (seen.add(r.content_hash), true)));

  const { data, error } = await supabase
    .from("eng_fluent_items")
    .upsert(dedup, { onConflict: "content_hash", ignoreDuplicates: true })
    .select("id, skill");
  if (error) throw error;
  const w = (data ?? []).filter((r) => r.skill === "writing").length;
  const s = (data ?? []).filter((r) => r.skill === "speaking").length;
  console.log(`Inserted ${data?.length ?? 0} of ${dedup.length} prompts (writing ${w}, speaking ${s}; skipped existing by content_hash).`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
