/**
 * Seed the vetted VIFM Reflect 360 library template - the full 41-competency
 * behaviour set (authored by the fan-out author->review workflow). A consultant
 * clones this template for a "VIFM framework" engagement; source-based approval
 * then auto-approves it (no provisional flag), vs AI-decomposing a client's own
 * values (which stays provisional until approved).
 *
 * Data-only (no migration) - inserts into the existing reflect_frameworks /
 * reflect_competencies / reflect_behaviors tables. Idempotent by framework name.
 * Run: npx tsx scripts/seed-reflect-vifm-framework.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import { VIFM_REFLECT_FRAMEWORK } from "../src/lib/reflect/vifm-framework-seed";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NAME_EN = "VIFM Competency Framework (Full)";
const NAME_AR = "إطار كفايات VIFM (الكامل)";

async function main() {
  const { data: existing } = await supabase
    .from("reflect_frameworks")
    .select("id")
    .eq("name_en", NAME_EN)
    .eq("is_template", true)
    .maybeSingle();
  if (existing) {
    console.log(`Already seeded (framework ${(existing as { id: string }).id}). Nothing to do.`);
    return;
  }

  const { data: fw, error: fwErr } = await supabase
    .from("reflect_frameworks")
    .insert({
      engagement_id: null,
      name_en: NAME_EN,
      name_ar: NAME_AR,
      description_en:
        "The complete VIFM behavioural competency framework - 41 competencies across 9 clusters, each with four observable, frequency-rateable behaviours for 360 feedback. Clone this for a fully vetted VIFM-framework engagement.",
      description_ar:
        "إطار كفايات VIFM السلوكي الكامل - 41 كفاية موزّعة على 9 مجموعات، لكل منها أربعة سلوكيات ملاحَظة قابلة للتقييم بالتكرار لأغراض التغذية الراجعة 360. استنسخ هذا الإطار لبرنامج معتمد بالكامل على إطار VIFM.",
      source: "template",
      is_template: true,
      is_active: true,
      approved_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();
  if (fwErr || !fw) throw new Error(fwErr?.message ?? "Could not create framework");

  let compCount = 0;
  let behCount = 0;
  for (const c of VIFM_REFLECT_FRAMEWORK) {
    const { data: comp, error: compErr } = await supabase
      .from("reflect_competencies")
      .insert({
        framework_id: fw.id,
        name_en: c.name_en,
        name_ar: c.name_ar,
        display_order: c.display_order,
      })
      .select("id")
      .single<{ id: string }>();
    if (compErr || !comp) throw new Error(`competency "${c.name_en}": ${compErr?.message}`);
    compCount += 1;

    const rows = c.behaviours.map((b, i) => ({
      competency_id: comp.id,
      level_tier: "all",
      text_en: b.text_en,
      text_ar: b.text_ar,
      source: "manual",
      display_order: i + 1,
    }));
    const { error: behErr } = await supabase.from("reflect_behaviors").insert(rows);
    if (behErr) throw new Error(`behaviours for "${c.name_en}": ${behErr.message}`);
    behCount += rows.length;
  }

  console.log(`Seeded "${NAME_EN}" (framework ${fw.id}): ${compCount} competencies, ${behCount} behaviours.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
