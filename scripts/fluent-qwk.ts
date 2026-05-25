/**
 * Compute Claude-vs-human agreement (Quadratic Weighted Kappa) for VIFM
 * Fluent writing + speaking scores.
 *
 *   npx tsx scripts/fluent-qwk.ts
 *
 * Joins eng_fluent_human_ratings (entered at /ac/fluent/calibration) to the
 * AI CEFR in eng_fluent_results.result, then prints per-skill QWK + a
 * confusion matrix. QWK >= 0.70 is the conventional "acceptable" threshold.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { quadraticWeightedKappa, confusionMatrix, QWK_ACCEPTABLE } from "../src/lib/scoring/qwk";
import { CEFR_ORDER, type CefrLevel } from "../src/lib/ai/fluent-english";

const env = readFileSync(".env.local", "utf8");
const get = (k: string) => {
  const m = env.match(new RegExp("^" + k + "=(.*)$", "m"));
  return m ? m[1].trim() : "";
};
const rank = (c: string) => CEFR_ORDER.indexOf(c as CefrLevel) + 1;

type HumanRating = { result_id: string; skill: string; human_cefr: string };
type ResultRow = { id: string; result: Record<string, { cefr?: string }> | null };

async function main() {
  const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  const { data: humans, error } = await sb
    .from("eng_fluent_human_ratings")
    .select("result_id, skill, human_cefr");
  if (error) {
    console.log("eng_fluent_human_ratings unavailable (apply migration 00046):", error.message.slice(0, 80));
    return;
  }
  const ratings = (humans ?? []) as HumanRating[];
  if (ratings.length === 0) {
    console.log("No human ratings yet — rate some results at /ac/fluent/calibration, then re-run.");
    return;
  }

  const ids = Array.from(new Set(ratings.map((h) => h.result_id)));
  const { data: results } = await sb.from("eng_fluent_results").select("id, result").in("id", ids);
  const byId = new Map<string, ResultRow["result"]>((results ?? []).map((r) => [r.id as string, r.result]));

  for (const skill of ["writing", "speaking"] as const) {
    const pairs = ratings
      .filter((h) => h.skill === skill)
      .map((h) => {
        const aiCefr = byId.get(h.result_id)?.[skill]?.cefr;
        return aiCefr ? { human: rank(h.human_cefr), ai: rank(aiCefr) } : null;
      })
      .filter((p): p is { human: number; ai: number } => p !== null);

    if (pairs.length === 0) {
      console.log(`\n${skill}: no paired ratings`);
      continue;
    }
    const q = quadraticWeightedKappa(pairs.map((p) => p.ai), pairs.map((p) => p.human));
    const verdict = q >= QWK_ACCEPTABLE ? "✓ acceptable (>=0.70)" : "✗ below 0.70 — calibrate";
    console.log(`\n${skill}: n=${pairs.length}  QWK=${q.toFixed(3)}  ${verdict}`);
    const M = confusionMatrix(pairs.map((p) => p.ai), pairs.map((p) => p.human));
    console.log("  confusion (rows=AI, cols=human; A1 A2 B1 B2 C1 C2):");
    M.forEach((row, i) => console.log(`   ${CEFR_ORDER[i]}  ${row.join("  ")}`));
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
