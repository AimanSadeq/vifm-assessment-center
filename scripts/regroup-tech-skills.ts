/**
 * Regroup each technical FUNCTION's flat skills into named COMPETENCIES, using
 * Claude — populating the relational competency tier added in migration 00074
 * (technical_competencies + technical_competency_skills).
 *
 * Taxonomy: Domain → Function → Competency → Skill.
 * A function's existing flat skills (technical_functions.skills_en / skills_ar)
 * are grouped into 2–4 competencies; every original skill is preserved VERBATIM
 * (EN + AR) and assigned to exactly one competency. Claude only groups + names
 * the competencies bilingually — it does not invent or reword skills.
 *
 * Run (against the REAL Supabase, with a real key):
 *   npx tsx scripts/regroup-tech-skills.ts            # all functions, skip ones already grouped
 *   npx tsx scripts/regroup-tech-skills.ts --dry      # print plan, write nothing
 *   npx tsx scripts/regroup-tech-skills.ts --force    # re-group even if competencies exist (replaces them)
 *   npx tsx scripts/regroup-tech-skills.ts --function corporate_finance   # one function by key
 *
 * Requires in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * ANTHROPIC_API_KEY.
 */
import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// override:true — the Claude Code harness can inject an EMPTY ANTHROPIC_API_KEY
// into spawned processes (see docs/post-parity-roadmap.md §1).
loadEnv({ path: ".env.local", override: true });

const AI_MODEL = "claude-sonnet-4-20250514";

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const valOf = (f: string): string | null => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : null;
};
const DRY = has("--dry");
const FORCE = has("--force");
const ONE_FUNCTION = valOf("--function");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;
if (!url || !serviceKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
if (!anthropicKey) throw new Error("Missing ANTHROPIC_API_KEY (the regrouping needs Claude)");

const sb = createClient(url, serviceKey);
const ai = new Anthropic({ apiKey: anthropicKey });

type FunctionRow = {
  id: string;
  key: string | null;
  name_en: string;
  name_ar: string | null;
  category: string | null;
  skills_en: string[];
  skills_ar: string[] | null;
};

type CompetencyPlan = {
  name_en: string;
  name_ar: string;
  skills: { name_en: string; name_ar: string }[];
};

function buildPrompt(fn: FunctionRow): string {
  // Pair each EN skill with its AR counterpart by index (the seed keeps them aligned).
  const skills = fn.skills_en.map((en, i) => ({
    name_en: en,
    name_ar: (fn.skills_ar && fn.skills_ar[i]) || "",
  }));
  return [
    `You are organising a professional technical-competency taxonomy.`,
    `DOMAIN: ${fn.category ?? "(unspecified)"}`,
    `FUNCTION (a real job/role): ${fn.name_en}${fn.name_ar ? ` / ${fn.name_ar}` : ""}`,
    ``,
    `Group the following skills into 2–4 COMPETENCIES. A competency is a coherent`,
    `area of capability that the function requires; skills are its granular,`,
    `assessable parts.`,
    ``,
    `Rules:`,
    `- Use EVERY skill below exactly once; do not drop, merge, split, invent, or`,
    `  reword any skill. Copy each skill's name_en and name_ar VERBATIM.`,
    `- Produce 2–4 competencies, each with a concise bilingual name (English +`,
    `  Modern Standard Arabic). The Arabic must be natural, professional finance/`,
    `  business terminology.`,
    `- Return ONLY JSON, no prose, matching this shape:`,
    `  { "competencies": [ { "name_en": "...", "name_ar": "...",`,
    `      "skills": [ { "name_en": "...", "name_ar": "..." } ] } ] }`,
    ``,
    `SKILLS:`,
    JSON.stringify(skills, null, 2),
  ].join("\n");
}

async function planFor(fn: FunctionRow): Promise<CompetencyPlan[]> {
  const res = await ai.messages.create({
    model: AI_MODEL,
    max_tokens: 2000,
    messages: [{ role: "user", content: buildPrompt(fn) }],
  });
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart < 0 || jsonEnd < 0) throw new Error(`No JSON returned for ${fn.name_en}`);
  const parsed = JSON.parse(text.slice(jsonStart, jsonEnd + 1)) as { competencies: CompetencyPlan[] };
  if (!parsed.competencies?.length) throw new Error(`Empty plan for ${fn.name_en}`);
  return parsed.competencies;
}

async function main() {
  let q = sb
    .from("technical_functions")
    .select("id, key, name_en, name_ar, category, skills_en, skills_ar")
    .eq("status", "active");
  if (ONE_FUNCTION) q = q.eq("key", ONE_FUNCTION);
  const { data: functions, error } = await q;
  if (error) throw new Error(`Load functions: ${error.message}`);
  if (!functions?.length) {
    console.log("No matching functions.");
    return;
  }

  console.log(`${functions.length} function(s) to process${DRY ? " (DRY RUN)" : ""}\n`);

  for (const fn of functions as FunctionRow[]) {
    if (!fn.skills_en?.length) {
      console.log(`• ${fn.name_en}: no skills, skipped`);
      continue;
    }

    const { data: existing } = await sb
      .from("technical_competencies")
      .select("id")
      .eq("function_id", fn.id);
    if (existing?.length && !FORCE) {
      console.log(`• ${fn.name_en}: already has ${existing.length} competencies, skipped (use --force to replace)`);
      continue;
    }

    let plan: CompetencyPlan[];
    try {
      plan = await planFor(fn);
    } catch (e) {
      console.error(`✗ ${fn.name_en}: ${(e as Error).message}`);
      continue;
    }

    console.log(`• ${fn.name_en} → ${plan.length} competencies:`);
    for (const c of plan) console.log(`    - ${c.name_en} (${c.skills.length} skills)`);

    if (DRY) continue;

    if (existing?.length && FORCE) {
      await sb.from("technical_competencies").delete().eq("function_id", fn.id);
    }

    for (let ci = 0; ci < plan.length; ci++) {
      const c = plan[ci];
      const { data: compRow, error: cErr } = await sb
        .from("technical_competencies")
        .insert({ function_id: fn.id, name_en: c.name_en, name_ar: c.name_ar, sort_order: ci })
        .select("id")
        .single();
      if (cErr || !compRow) {
        console.error(`  ✗ insert competency "${c.name_en}": ${cErr?.message}`);
        continue;
      }
      const skillRows = c.skills.map((s, si) => ({
        competency_id: compRow.id,
        name_en: s.name_en,
        name_ar: s.name_ar || null,
        sort_order: si,
      }));
      const { error: sErr } = await sb.from("technical_competency_skills").insert(skillRows);
      if (sErr) console.error(`  ✗ insert skills for "${c.name_en}": ${sErr.message}`);
    }
  }

  console.log(`\n${DRY ? "Dry run complete — nothing written." : "✅ Done."}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
