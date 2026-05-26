/**
 * Calibrate VIFM Fluent item-bank difficulties from accumulated responses.
 *
 *   npx tsx scripts/fluent-calibrate-items.ts
 *
 * For each item in eng_fluent_items, aggregates its eng_fluent_item_responses
 * (proportion correct), estimates a Rasch difficulty (irt_b) via
 * raschDifficultyFromPValue, writes back irt_b/irt_se/n_responses, and promotes
 * items with enough responses (FLUENT_CALIBRATE_MIN, default 30) to status
 * 'live' - at which point a future adaptive flow (irt.ts selectNextItem) can
 * serve them. Run periodically as response data accumulates.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { raschDifficultyFromPValue } from "../src/lib/scoring/irt";

const env = readFileSync(".env.local", "utf8");
const get = (k: string) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};
const PROMOTE_AT = Number(process.env.FLUENT_CALIBRATE_MIN || 30);

type Item = { id: string; skill: string; cefr_label: string | null };

async function main() {
  const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const { data: items, error } = await sb.from("eng_fluent_items").select("id, skill, cefr_label");
  if (error) {
    console.log("eng_fluent_items unavailable (apply migration 00048):", error.message.slice(0, 80));
    return;
  }
  const bank = (items ?? []) as Item[];
  if (bank.length === 0) {
    console.log("No items yet - take some tests to populate the bank, then re-run.");
    return;
  }

  let calibrated = 0;
  let promoted = 0;
  for (const it of bank) {
    const { data: resp } = await sb.from("eng_fluent_item_responses").select("correct").eq("item_id", it.id);
    const rows = (resp ?? []) as Array<{ correct: boolean }>;
    const total = rows.length;
    if (total === 0) continue;
    const correct = rows.filter((r) => r.correct).length;
    const { b, se } = raschDifficultyFromPValue(correct, total);
    const status = total >= PROMOTE_AT ? "live" : "calibrating";
    await sb.from("eng_fluent_items").update({ irt_b: b, irt_se: se, n_responses: total, status }).eq("id", it.id);
    calibrated += 1;
    if (status === "live") promoted += 1;
    console.log(
      `${it.skill.padEnd(9)} ${(it.cefr_label ?? "?").padEnd(3)} | n=${total} p=${(correct / total).toFixed(2)} b=${b} se=${se} -> ${status}`
    );
  }
  console.log(`\nCalibrated ${calibrated} item(s) with responses; ${promoted} now live (>= ${PROMOTE_AT} responses).`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
