/**
 * Read-only full-detail viewer for drafted research anchors. Prints each
 * construct's summary + every anchor (confidence + name + one-line
 * rationale) so a reviewer can judge match quality before verifying.
 * Writes nothing.
 *
 *   npx tsx scripts/evidence-detail.ts --instrument ac
 *   npx tsx scripts/evidence-detail.ts --instrument arc --sample 3   # 3 per construct group
 *
 * --sample N keeps only the first N items per construct group (handy for
 * the 243-item ARC bank). Omit to print every drafted item.
 */

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
loadEnv({ path: ".env.local", override: true });
import { ARA_PILLARS } from "../src/lib/constants/ara-pillars";
import { ARA_INDIVIDUAL_FACTOR_MAP } from "../src/lib/constants/ara-individual-factors";

const args = process.argv.slice(2);
const valOf = (f: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : undefined; };
const ONLY = (valOf("--instrument") ?? "ac").toLowerCase();
const SAMPLE = valOf("--sample") ? parseInt(valOf("--sample")!, 10) : Infinity;

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const C: Record<string, string> = { direct_adaptation: "DIR", construct_aligned: "ALN", novel: "NOV" };

function printItem(group: string, label: string, ev: any) {
  if (!ev || !ev.review_status) return;
  console.log(`  [${group}] ${label}`);
  console.log(`     summary: ${ev.construct_summary ?? "—"}  (${ev.review_status})`);
  for (const a of ev.anchor_instruments ?? [])
    console.log(`     ${C[a.confidence] ?? "?"}  ${a.name}\n           ↳ ${a.rationale ?? ""}`);
  if (!(ev.anchor_instruments ?? []).length) console.log(`     ⚠ no anchors`);
}

async function main() {
  const perGroup = new Map<string, number>();
  const take = (g: string) => { const n = (perGroup.get(g) ?? 0) + 1; perGroup.set(g, n); return n <= SAMPLE; };

  if (ONLY === "ac") {
    const { data } = await sb.from("competencies")
      .select("name, validation_evidence, competency_clusters(competency_domains(name))");
    console.log("=== AC competencies ===");
    for (const c of (data ?? []) as any[]) {
      const g = c.competency_clusters?.competency_domains?.name ?? "?";
      if (take(g)) printItem(g, c.name, c.validation_evidence);
    }
  } else if (ONLY === "arc") {
    const { data } = await sb.from("ara_questions")
      .select("question_text_en, pillar_id, individual_factor_id, validation_evidence");
    console.log("=== ARC questions ===");
    const rows = (data ?? []) as any[];
    rows.sort((a, b) => String(a.pillar_id ?? a.individual_factor_id).localeCompare(String(b.pillar_id ?? b.individual_factor_id)));
    for (const q of rows) {
      const name = q.individual_factor_id
        ? (ARA_INDIVIDUAL_FACTOR_MAP as any)[q.individual_factor_id]?.name_en ?? q.individual_factor_id
        : ARA_PILLARS.find((p) => p.id === q.pillar_id)?.name_en ?? q.pillar_id;
      if (take(name)) printItem(name, String(q.question_text_en).slice(0, 70), q.validation_evidence);
    }
  } else if (ONLY === "fluent") {
    const { data } = await sb.from("eng_fluent_items").select("skill, cefr_label, validation_evidence");
    console.log("=== Fluent items ===");
    for (const r of (data ?? []) as any[])
      if (take(r.skill)) printItem(r.skill, `CEFR ${r.cefr_label ?? "?"}`, r.validation_evidence);
  } else if (ONLY === "reflect") {
    const { data } = await sb.from("reflect_competencies")
      .select("name_en, validation_evidence, reflect_frameworks(name_en)");
    console.log("=== Reflect competencies ===");
    for (const r of (data ?? []) as any[])
      if (take(r.reflect_frameworks?.name_en ?? "?")) printItem(r.reflect_frameworks?.name_en ?? "?", r.name_en, r.validation_evidence);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
