/**
 * Batch evidence backfill for the Evidence & Validity Map.
 *
 * Walks the Assessment Center competencies and/or the ARC question bank,
 * calls the per-construct AI evidence suggester for any construct that has
 * NO evidence yet, and saves the result as `review_status: 'ai_proposed'`.
 *
 * IMPORTANT — the hallucination guard is preserved: nothing is written as
 * `verified`. AI proposals stay out of every client-facing surface until a
 * human Accepts/Edits them in the admin UI (/admin/ac-evidence and the ARC
 * question console). This script just does the slow first pass so reviewers
 * curate instead of author from scratch.
 *
 * Idempotent: constructs already human-touched (verified / edited /
 * rejected) are never overwritten. By default only NULL evidence is filled;
 * pass --refresh to also re-propose constructs still in 'ai_proposed'.
 *
 * Run:
 *   npx tsx scripts/backfill-evidence.ts            # AC + ARC
 *   npx tsx scripts/backfill-evidence.ts --ac       # AC only
 *   npx tsx scripts/backfill-evidence.ts --arc      # ARC only
 *   npx tsx scripts/backfill-evidence.ts --limit 5  # first 5 of each (test run)
 *   npx tsx scripts/backfill-evidence.ts --refresh  # also redo ai_proposed
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
loadEnv({ path: ".env.local" });

import { suggestCompetencyValidationEvidence } from "../src/lib/ai/ac-evidence-suggester";
import { suggestValidationEvidence } from "../src/lib/ai/validation-evidence-suggester";
import { ARA_PILLARS } from "../src/lib/constants/ara-pillars";
import { ARA_INDIVIDUAL_FACTOR_MAP } from "../src/lib/constants/ara-individual-factors";

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const limitArg = (() => {
  const i = args.indexOf("--limit");
  return i >= 0 && args[i + 1] ? parseInt(args[i + 1], 10) : Infinity;
})();
const REFRESH = has("--refresh");
// Default: run both. A specific flag narrows it.
const runAc = has("--ac") || !(has("--ac") || has("--arc"));
const runArc = has("--arc") || !(has("--ac") || has("--arc"));

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Decide whether a construct should be (re)processed. */
function shouldProcess(ev: { review_status?: string } | null): boolean {
  if (!ev) return true; // never touched → fill
  if (ev.review_status === "ai_proposed") return REFRESH; // only with --refresh
  return false; // verified / edited / rejected → leave human work alone
}

type Tally = { processed: number; skipped: number; failed: number };
const t = (): Tally => ({ processed: 0, skipped: 0, failed: 0 });

async function backfillAc(): Promise<Tally> {
  const tally = t();
  console.log("\n=== Assessment Center competencies ===");
  const { data, error } = await sb
    .from("competencies")
    .select("id, name, description, validation_evidence, competency_clusters(name, competency_domains(name))");
  if (error) {
    console.error("  ! could not load competencies:", error.message);
    return tally;
  }

  let n = 0;
  for (const c of (data ?? []) as any[]) {
    if (n >= limitArg) break;
    if (!shouldProcess(c.validation_evidence)) {
      tally.skipped++;
      continue;
    }
    n++;
    const domain = c.competency_clusters?.competency_domains?.name ?? "";
    process.stdout.write(`  • ${c.name} [${domain}] … `);
    const ev = await suggestCompetencyValidationEvidence({
      competency_name: c.name,
      competency_description: c.description ?? "",
      domain_name: domain,
    });
    if (!ev) {
      console.log("FAILED (no suggestion)");
      tally.failed++;
      await sleep(300);
      continue;
    }
    const { error: upErr } = await sb.from("competencies").update({ validation_evidence: ev }).eq("id", c.id);
    if (upErr) {
      console.log(`FAILED (save: ${upErr.message})`);
      tally.failed++;
    } else {
      console.log(`ok — ${ev.anchor_instruments.length} anchor(s)`);
      tally.processed++;
    }
    await sleep(400);
  }
  return tally;
}

async function backfillArc(): Promise<Tally> {
  const tally = t();
  console.log("\n=== ARC question bank ===");

  // Prefer the active version so we don't re-process superseded banks.
  const { data: ver } = await sb
    .from("ara_question_bank_versions")
    .select("id, version_number")
    .eq("is_active", true)
    .maybeSingle();
  if (ver) console.log(`  active version: ${ver.version_number ?? ver.id}`);

  let query = sb
    .from("ara_questions")
    .select("id, question_text_en, pillar_id, individual_factor_id, validation_evidence");
  if (ver?.id) query = query.eq("version_id", ver.id);

  const { data, error } = await query;
  if (error) {
    console.error("  ! could not load ara_questions:", error.message);
    return tally;
  }

  let n = 0;
  for (const q of (data ?? []) as any[]) {
    if (n >= limitArg) break;
    if (!shouldProcess(q.validation_evidence)) {
      tally.skipped++;
      continue;
    }
    n++;

    // Resolve construct context (individual factor wins over pillar).
    let constructId: string;
    let constructName: string;
    let constructDescription: string;
    if (q.individual_factor_id) {
      const f = ARA_INDIVIDUAL_FACTOR_MAP[q.individual_factor_id as keyof typeof ARA_INDIVIDUAL_FACTOR_MAP];
      constructId = f?.id ?? q.individual_factor_id;
      constructName = f?.name_en ?? q.individual_factor_id;
      constructDescription = f?.description_en ?? "";
    } else {
      const p = ARA_PILLARS.find((x) => x.id === q.pillar_id);
      constructId = q.pillar_id;
      constructName = p?.name_en ?? q.pillar_id;
      constructDescription = p?.description_en ?? "";
    }

    process.stdout.write(`  • ${constructName}: "${String(q.question_text_en).slice(0, 48)}…" … `);
    const ev = await suggestValidationEvidence({
      question_text_en: q.question_text_en,
      construct_id: constructId,
      construct_name: constructName,
      construct_description: constructDescription,
    });
    if (!ev) {
      console.log("FAILED (no suggestion)");
      tally.failed++;
      await sleep(300);
      continue;
    }
    const { error: upErr } = await sb.from("ara_questions").update({ validation_evidence: ev }).eq("id", q.id);
    if (upErr) {
      console.log(`FAILED (save: ${upErr.message})`);
      tally.failed++;
    } else {
      console.log(`ok — ${ev.anchor_instruments.length} anchor(s)`);
      tally.processed++;
    }
    await sleep(400);
  }
  return tally;
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is not set in .env.local — nothing to do.");
    process.exit(1);
  }
  console.log(
    `Evidence backfill — targets: ${[runAc && "AC", runArc && "ARC"].filter(Boolean).join(" + ")}` +
      `${limitArg !== Infinity ? `, limit ${limitArg}` : ""}${REFRESH ? ", refresh ai_proposed" : ""}`
  );

  const ac = runAc ? await backfillAc() : t();
  const arc = runArc ? await backfillArc() : t();

  console.log("\n=== Summary ===");
  if (runAc) console.log(`  AC : ${ac.processed} proposed, ${ac.skipped} skipped, ${ac.failed} failed`);
  if (runArc) console.log(`  ARC: ${arc.processed} proposed, ${arc.skipped} skipped, ${arc.failed} failed`);
  console.log(
    "\nAll new evidence is review_status='ai_proposed' — verify it in the admin UI before it reaches any client deliverable."
  );
}

main().catch((e) => {
  console.error("Backfill crashed:", e);
  process.exit(1);
});
