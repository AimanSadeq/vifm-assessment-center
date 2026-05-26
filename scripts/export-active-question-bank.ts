/**
 * ============================================================
 * export-active-question-bank.ts
 * -----------------------------------------------------------
 * One-shot exporter - reads the currently active ARA question
 * bank version + all its questions from Supabase, and emits an
 * idempotent SQL migration at:
 *
 *   supabase/migrations/00021_ara_seed_question_bank.sql
 *
 * Why: the bank lives only as DB rows today. A fresh clone or
 * a restored backup gets an empty admin UI. This snapshots the
 * vetted bank into version control so it ships with every
 * environment.
 *
 * Usage:
 *   npx tsx scripts/export-active-question-bank.ts
 *
 * The output uses ON CONFLICT DO NOTHING on natural keys
 * (version_number for the version row, version_id+pillar_id+
 * question_number for each question) so re-running the
 * migration on an env that already has rows is a no-op.
 * ============================================================
 */

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

// Other scripts in this repo (seed-production-bank.ts, seed-pilot.ts)
// also use `.env.local` for the service-role key, so match that.
loadEnv({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key);

function sqlEscape(value: string | null): string {
  if (value === null || value === undefined) return "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function jsonbLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  const json = JSON.stringify(value).replace(/'/g, "''");
  return `'${json}'::jsonb`;
}

function intOrNull(value: number | null | undefined): string {
  return value === null || value === undefined ? "NULL" : String(value);
}

type VersionRow = {
  id: string;
  version_number: string;
  version_label: string | null;
  release_notes: string | null;
  is_active: boolean;
};

type QuestionRow = {
  id: string;
  version_id: string;
  pillar_id: string;
  question_number: number;
  question_text_en: string;
  question_text_ar: string;
  question_type: string;
  options_en: unknown;
  options_ar: unknown;
  score_map: unknown;
  help_text_en: string | null;
  help_text_ar: string | null;
  region: string | null;
  sector: string | null;
  layer: number | null;
  display_order: number | null;
  is_active: boolean | null;
};

async function main() {
  // 1. Find the active version
  const versionRes = await sb
    .from("ara_question_bank_versions")
    .select("id, version_number, version_label, release_notes, is_active")
    .eq("is_active", true)
    .single();
  if (versionRes.error || !versionRes.data) {
    console.error("No active version found:", versionRes.error?.message);
    process.exit(1);
  }
  const version = versionRes.data as unknown as VersionRow;
  console.log(`Active version: v${version.version_number} (${version.version_label ?? "no label"}) id=${version.id}`);

  // 2. Pull every question on that version
  const questionsRes = await sb
    .from("ara_questions")
    .select(
      "id, version_id, pillar_id, question_number, question_text_en, question_text_ar, " +
      "question_type, options_en, options_ar, score_map, help_text_en, help_text_ar, " +
      "region, sector, layer, display_order, is_active"
    )
    .eq("version_id", version.id)
    .order("pillar_id", { ascending: true })
    .order("layer", { ascending: true })
    .order("display_order", { ascending: true })
    .order("question_number", { ascending: true });
  if (questionsRes.error || !questionsRes.data) {
    console.error("Failed to read questions:", questionsRes.error?.message);
    process.exit(1);
  }
  const questions = questionsRes.data as unknown as QuestionRow[];
  console.log(`Found ${questions.length} questions to export.`);

  // 3. Emit SQL.
  const lines: string[] = [];
  lines.push(`-- ============================================================`);
  lines.push(`-- ARA seed question bank - captured ${new Date().toISOString()}`);
  lines.push(`-- Source: live DB active version v${version.version_number}`);
  lines.push(`-- Idempotent: re-running is safe; existing rows are kept.`);
  lines.push(`-- Activation is NOT done here - flip is_active manually if needed.`);
  lines.push(`-- ============================================================`);
  lines.push(``);
  lines.push(`-- Version row`);
  lines.push(`INSERT INTO ara_question_bank_versions (`);
  lines.push(`  version_number, version_label, release_notes, is_active`);
  lines.push(`) VALUES (`);
  lines.push(`  ${sqlEscape(version.version_number)},`);
  lines.push(`  ${sqlEscape(version.version_label)},`);
  lines.push(`  ${sqlEscape(version.release_notes)},`);
  lines.push(`  false`);
  lines.push(`) ON CONFLICT (version_number) DO NOTHING;`);
  lines.push(``);
  lines.push(`-- Questions - keyed against the version we just upserted,`);
  lines.push(`-- looked up by version_number so a remote env that already`);
  lines.push(`-- has the version row uses its existing id.`);
  lines.push(``);
  lines.push(`DO $$`);
  lines.push(`DECLARE`);
  lines.push(`  v_id uuid;`);
  lines.push(`BEGIN`);
  lines.push(`  SELECT id INTO v_id FROM ara_question_bank_versions WHERE version_number = ${sqlEscape(version.version_number)};`);
  lines.push(`  IF v_id IS NULL THEN`);
  lines.push(`    RAISE EXCEPTION 'Could not find ara_question_bank_versions row for v${version.version_number}';`);
  lines.push(`  END IF;`);
  lines.push(``);

  for (const q of questions) {
    const insertCols = [
      "version_id",
      "pillar_id",
      "question_number",
      "question_text_en",
      "question_text_ar",
      "question_type",
      "options_en",
      "options_ar",
      "score_map",
      "help_text_en",
      "help_text_ar",
      "region",
      "sector",
      "layer",
      "display_order",
      "is_active",
    ];
    const values = [
      "v_id",
      sqlEscape(q.pillar_id),
      intOrNull(q.question_number),
      sqlEscape(q.question_text_en),
      sqlEscape(q.question_text_ar),
      sqlEscape(q.question_type),
      jsonbLiteral(q.options_en),
      jsonbLiteral(q.options_ar),
      jsonbLiteral(q.score_map),
      sqlEscape(q.help_text_en ?? null),
      sqlEscape(q.help_text_ar ?? null),
      sqlEscape(q.region ?? "both"),
      sqlEscape(q.sector ?? "all"),
      intOrNull(q.layer ?? 1),
      intOrNull(q.display_order ?? 0),
      q.is_active === false ? "false" : "true",
    ];
    lines.push(`  INSERT INTO ara_questions (${insertCols.join(", ")})`);
    lines.push(`  SELECT ${values.join(", ")}`);
    lines.push(
      `  WHERE NOT EXISTS (SELECT 1 FROM ara_questions WHERE version_id = v_id AND pillar_id = ${sqlEscape(q.pillar_id)} AND question_number = ${intOrNull(q.question_number)});`
    );
  }

  lines.push(`END $$;`);
  lines.push(``);

  const outPath = resolve("supabase/migrations/00021_ara_seed_question_bank.sql");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, lines.join("\n"));
  console.log(`Wrote ${outPath} (${lines.length} lines)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
