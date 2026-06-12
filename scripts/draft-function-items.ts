/**
 * Bulk technical-function item drafting.
 *
 * For every skill in the standard technical-function library, AI-authors
 * candidate MCQ items into the certified function bank as `status='draft'`
 * (domain_key NULL — the per-skill pool shared by every function that lists the
 * skill). This is the slow first pass so an SME *curates* (Approve/Edit/Reject
 * in the cert workbench at /admin/tech-assessment/functions/[ref]) instead of
 * authoring every item from scratch.
 *
 * Hallucination guard preserved: NOTHING is written as `approved`. Drafts stay
 * out of every certified sitting until a human approves them — the indicative
 * (live-AI) path is unaffected and already serves these functions today.
 *
 * Idempotent: a skill that already has >= --per items in draft/in_review/
 * approved is skipped, so re-runs only fill gaps. Use --force to draft anyway.
 *
 * Run (needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 * in .env.local — same as backfill:evidence):
 *   npx tsx scripts/draft-function-items.ts --dry          # plan only, no AI/DB writes
 *   npx tsx scripts/draft-function-items.ts --function corporate_finance   # one function's skills
 *   npx tsx scripts/draft-function-items.ts --new-only     # only the 6 new competencies
 *   npx tsx scripts/draft-function-items.ts --category banking
 *   npx tsx scripts/draft-function-items.ts --per 6        # items per skill (default 4)
 *   npx tsx scripts/draft-function-items.ts --limit 5      # first 5 skills (test run)
 *   npx tsx scripts/draft-function-items.ts                # all standard functions' skills
 */

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
// override:true — the Claude Code harness can inject an EMPTY ANTHROPIC_API_KEY
// into spawned processes; without override dotenv won't replace it and the AI
// client silently no-ops. (Documented in docs/post-parity-roadmap.md §1.)
loadEnv({ path: ".env.local", override: true });

import { STANDARD_FUNCTIONS } from "../src/lib/competencies/technical-function";
import { draftFunctionSkillItems } from "../src/lib/competencies/technical-function-bank";

// The 6 competencies added in migration 00060 (everything beyond the original
// finance/accounting/treasury seed).
const NEW_COMPETENCIES = new Set([
  "banking",
  "investment",
  "analytics",
  "business_intelligence",
  "artificial_intelligence",
  "human_resources",
]);

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const valOf = (f: string): string | null => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};

const DRY = has("--dry");
const FORCE = has("--force");
const NEW_ONLY = has("--new-only");
const CATEGORY = valOf("--category");
const FUNCTION = valOf("--function"); // a single standard function key, e.g. corporate_finance
const PER = Math.max(1, Math.min(20, Number(valOf("--per") ?? "4")));
const LIMIT = valOf("--limit") ? Math.max(1, Number(valOf("--limit"))) : null;
// Existing drafts/in-review/approved that count toward "already covered".
const COUNTED_STATUSES = ["draft", "in_review", "approved"];

function pickFunctions() {
  let fns = STANDARD_FUNCTIONS;
  if (FUNCTION) fns = fns.filter((f) => f.key === FUNCTION);
  else if (CATEGORY) fns = fns.filter((f) => f.category === CATEGORY);
  else if (NEW_ONLY) fns = fns.filter((f) => NEW_COMPETENCIES.has(f.category));
  return fns;
}

/** Distinct skills (first-seen function name as authoring context). */
function skillPlan(): { skill: string; context: string }[] {
  const seen = new Map<string, string>();
  for (const f of pickFunctions()) {
    for (const s of f.skills_en) {
      const k = s.trim();
      if (k && !seen.has(k)) seen.set(k, f.name_en);
    }
  }
  return Array.from(seen.entries()).map(([skill, context]) => ({ skill, context }));
}

// Loose client type — the script only uses .from(); the SDK's strict default
// generics don't matter here.
async function existingCounts(sb: { from: (t: string) => any }, skills: string[]) {
  const counts: Record<string, number> = {};
  for (const s of skills) counts[s] = 0;
  // Batch the IN() so a long skill list doesn't blow the query.
  for (let i = 0; i < skills.length; i += 100) {
    const batch = skills.slice(i, i + 100);
    const { data, error } = await sb
      .from("tech_assessment_items")
      .select("skill")
      .is("domain_key", null)
      .in("status", COUNTED_STATUSES)
      .in("skill", batch);
    if (error) throw new Error(`count query failed: ${error.message}`);
    for (const r of (data as { skill: string }[] | null) ?? []) {
      if (r.skill in counts) counts[r.skill] += 1;
    }
  }
  return counts;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  if (!DRY && !process.env.ANTHROPIC_API_KEY) {
    console.error("✗ Missing ANTHROPIC_API_KEY in .env.local (required unless --dry)");
    process.exit(1);
  }

  if (FUNCTION && pickFunctions().length === 0) {
    console.error(`✗ No standard function with key='${FUNCTION}'. Check src/lib/competencies/technical-function.ts.`);
    process.exit(1);
  }

  const sb = createClient(url, key);
  const plan = skillPlan();
  const scope = FUNCTION
    ? `function=${FUNCTION}`
    : CATEGORY
      ? `category=${CATEGORY}`
      : NEW_ONLY
        ? "new competencies"
        : "all standard functions";

  console.log(`\nBulk function-item drafting`);
  console.log(`  scope:   ${scope}  (${pickFunctions().length} functions)`);
  console.log(`  skills:  ${plan.length} distinct  ·  target ${PER}/skill${FORCE ? "  ·  FORCE" : ""}`);
  console.log(`  mode:    ${DRY ? "DRY RUN (no AI calls, no writes)" : "LIVE"}\n`);

  const counts = await existingCounts(
    sb,
    plan.map((p) => p.skill)
  );

  // Skills still short of the target (unless --force).
  let todo = plan
    .map((p) => ({ ...p, have: counts[p.skill] ?? 0 }))
    .filter((p) => FORCE || p.have < PER);
  const skippedCovered = plan.length - todo.length;
  if (LIMIT) todo = todo.slice(0, LIMIT);

  console.log(`  ${skippedCovered} skill(s) already covered (>= ${PER}); ${todo.length} to draft${LIMIT ? ` (capped at --limit ${LIMIT})` : ""}.\n`);

  if (DRY) {
    for (const p of todo) {
      const need = FORCE ? PER : PER - p.have;
      console.log(`  • [${p.skill}]  have ${p.have} → draft ${need}   (ctx: ${p.context})`);
    }
    console.log(`\nDRY RUN complete — nothing written. Re-run without --dry to draft.\n`);
    return;
  }

  let drafted = 0;
  let failures = 0;
  for (let i = 0; i < todo.length; i++) {
    const p = todo[i];
    const need = FORCE ? PER : PER - p.have;
    process.stdout.write(`  [${i + 1}/${todo.length}] ${p.skill} → ${need} … `);
    try {
      const res = await draftFunctionSkillItems(p.skill, need, p.context);
      if (res.error) {
        failures++;
        console.log(`✗ ${res.error}`);
      } else {
        drafted += res.inserted;
        console.log(`✓ ${res.inserted} drafted`);
      }
    } catch (e) {
      failures++;
      console.log(`✗ ${(e as Error).message}`);
    }
    // Gentle pacing so we don't burst the Anthropic rate limit.
    if (i < todo.length - 1) await sleep(800);
  }

  console.log(`\nDone. ${drafted} item(s) drafted across ${todo.length} skill(s); ${failures} failure(s).`);
  console.log(`Next: an SME reviews + approves them in /admin/tech-assessment/functions/[ref]`);
  console.log(`(nothing is approved automatically — certified tests draw only from approved items).\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
