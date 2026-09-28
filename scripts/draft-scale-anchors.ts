// B19 - draft rating anchors (BPS 4.31) for every ACTIVE competency that has
// none, and behavioural indicators for any active competency with none.
// Everything is stored as a draft (source 'ai_draft', sme_status 'pending');
// the SME review approves or rewrites it. Idempotent: competencies that
// already have anchors / indicators are skipped.
//
//   npx tsx scripts/draft-scale-anchors.ts            # dry run: prints drafts
//   npx tsx scripts/draft-scale-anchors.ts --apply    # writes them
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
import { draftIndicators, draftScaleAnchors } from "../src/lib/ai/scale-anchor-drafter";

const APPLY = process.argv.includes("--apply");
const U = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const K = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };

async function get<T>(q: string): Promise<T> {
  const r = await fetch(`${U}/rest/v1/${q}`, { headers: H });
  if (!r.ok) throw new Error(`${q}: ${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}
async function post(table: string, rows: unknown[]) {
  const r = await fetch(`${U}/rest/v1/${table}`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(rows) });
  if (!r.ok) throw new Error(`${table}: ${r.status} ${await r.text()}`);
}

type Comp = { id: string; name: string; description: string | null };
type Ind = { competency_id: string; indicator_type: string; description: string };

async function main() {
  const comps = await get<Comp[]>("competencies?select=id,name,description&retired_at=is.null&order=name");
  const ids = comps.map((c) => c.id).join(",");
  const inds = await get<Ind[]>(`behavioral_indicators?select=competency_id,indicator_type,description&competency_id=in.(${ids})`);
  const have = new Set((await get<{ competency_id: string }[]>(`competency_scale_anchors?select=competency_id&competency_id=in.(${ids})`)).map((a) => a.competency_id));

  for (const c of comps) {
    const mine = inds.filter((i) => i.competency_id === c.id && !i.description.startsWith("[DEV TIP]"));
    let positives = mine.filter((i) => i.indicator_type === "positive").map((i) => i.description);
    let negatives = mine.filter((i) => i.indicator_type === "negative").map((i) => i.description);

    if (positives.length === 0) {
      const d = await draftIndicators({ name: c.name, definition: c.description });
      if (!d) throw new Error(`indicators for ${c.name}: no draft (is ANTHROPIC_API_KEY set?)`);
      console.log(`\n# ${c.name} - drafted ${d.positive.length} + ${d.negative.length} indicators`);
      d.positive.forEach((p) => console.log(`  + ${p}`));
      d.negative.forEach((n) => console.log(`  - ${n}`));
      if (APPLY) {
        await post("behavioral_indicators", [
          ...d.positive.map((p, i) => ({ competency_id: c.id, indicator_type: "positive", description: p, sort_order: i + 1 })),
          ...d.negative.map((n, i) => ({ competency_id: c.id, indicator_type: "negative", description: n, sort_order: 50 + i + 1 })),
        ]);
      }
      positives = d.positive;
      negatives = d.negative;
    }

    if (have.has(c.id)) {
      console.log(`${c.name}: anchors already present, skipped`);
      continue;
    }
    const anchors = await draftScaleAnchors({ name: c.name, definition: c.description, positives, negatives });
    if (!anchors) throw new Error(`anchors for ${c.name}: no complete draft`);
    console.log(`\n## ${c.name}`);
    anchors.forEach((a) => console.log(`  ${a.scale_point}: ${a.anchor_en}`));
    if (APPLY) {
      await post(
        "competency_scale_anchors",
        anchors.map((a) => ({ competency_id: c.id, scale_point: a.scale_point, anchor_en: a.anchor_en, anchor_ar: a.anchor_ar, source: "ai_draft", sme_status: "pending" })),
      );
    }
  }
  console.log(APPLY ? "\nWritten." : "\nDry run only - re-run with --apply to write.");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
