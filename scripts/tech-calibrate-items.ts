/**
 * Calibrate the technical FUNCTION item bank's Rasch difficulties (Phase-3 #2).
 *
 *   npx tsx scripts/tech-calibrate-items.ts
 *
 * For each function-skill item (domain_key NULL) writes irt_b: estimated from
 * its proportion-correct (times_correct / times_administered) once it has
 * TECH_CALIBRATE_MIN administrations (default 15), else seeded from the
 * easy/medium/hard prior. Once a skill's pool is calibrated, the CAT engine
 * (src/lib/scoring/irt.ts selectNextItem) can serve it adaptively. Re-run as
 * response data accumulates. Mirrors scripts/fluent-calibrate-items.ts.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { raschDifficultyFromPValue } from "../src/lib/scoring/irt";

const env = readFileSync(".env.local", "utf8");
const get = (k: string) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};
const PRIOR: Record<string, number> = { easy: -1.0, medium: 0.0, hard: 1.0 };
const MIN_ADMIN = Number(process.env.TECH_CALIBRATE_MIN || 15);

type Item = { id: string; skill: string; difficulty: string; times_administered: number; times_correct: number };

async function main() {
  const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const { data, error } = await sb
    .from("tech_assessment_items")
    .select("id, skill, difficulty, times_administered, times_correct")
    .is("domain_key", null);
  if (error) {
    console.log("tech_assessment_items unavailable (apply migrations 00059/00060):", error.message.slice(0, 80));
    return;
  }
  const items = (data ?? []) as Item[];
  if (items.length === 0) {
    console.log("No function-skill items yet — draft + approve some in the certification workbench, then re-run.");
    return;
  }

  let calibrated = 0;
  let dataDriven = 0;
  for (const it of items) {
    const n = Number(it.times_administered ?? 0);
    const c = Number(it.times_correct ?? 0);
    let b: number;
    let se: number | null;
    if (n >= MIN_ADMIN) {
      const r = raschDifficultyFromPValue(c, n);
      b = r.b;
      se = r.se;
      dataDriven += 1;
    } else {
      b = PRIOR[it.difficulty] ?? 0;
      se = null;
    }
    const upd = await sb
      .from("tech_assessment_items")
      .update({ irt_b: b, irt_se: se, calibrated_at: new Date().toISOString() })
      .eq("id", it.id);
    if (upd.error) {
      console.log(`SKIP ${it.id.slice(0, 8)}: ${upd.error.message.slice(0, 70)} (apply migration 00060)`);
      continue;
    }
    calibrated += 1;
    console.log(`${(it.skill || "").slice(0, 30).padEnd(30)} ${String(it.difficulty).padEnd(6)} n=${n} b=${b} ${n >= MIN_ADMIN ? "(data)" : "(prior)"}`);
  }
  console.log(`\nCalibrated ${calibrated} function-skill item(s); ${dataDriven} data-driven (>= ${MIN_ADMIN} admins), rest seeded from the difficulty prior.`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
