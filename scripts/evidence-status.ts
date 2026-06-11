/**
 * Read-only inventory for the Evidence & Validity Map research-anchor cells.
 *
 * Prints, per instrument, how many constructs exist and how their
 * validation_evidence.review_status breaks down (none / ai_proposed /
 * verified / edited / rejected), plus the verified ratio the map uses
 * (verified + edited) / total and whether it clears the 0.8 green bar.
 *
 * Pure inventory — writes nothing. Safe to run anytime to check progress.
 *
 *   npx tsx scripts/evidence-status.ts
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
loadEnv({ path: ".env.local" });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Bucket = { total: number; none: number; ai_proposed: number; verified: number; edited: number; rejected: number };
const emptyBucket = (): Bucket => ({ total: 0, none: 0, ai_proposed: 0, verified: 0, edited: 0, rejected: 0 });

function tally(rows: Array<{ validation_evidence: { review_status?: string } | null }>): Bucket {
  const b = emptyBucket();
  for (const r of rows) {
    b.total++;
    const s = r.validation_evidence?.review_status;
    if (!r.validation_evidence || !s) b.none++;
    else if (s === "ai_proposed") b.ai_proposed++;
    else if (s === "verified") b.verified++;
    else if (s === "edited") b.edited++;
    else if (s === "rejected") b.rejected++;
  }
  return b;
}

function line(label: string, b: Bucket) {
  const verified = b.verified + b.edited; // map counts edited as human-verified
  const ratio = b.total ? verified / b.total : 0;
  const green = ratio >= 0.8;
  const need = Math.max(0, Math.ceil(0.8 * b.total) - verified);
  const status = b.total === 0 ? "—" : green ? "GREEN" : verified > 0 ? "amber" : "RED";
  console.log(
    `${label.padEnd(24)} total=${String(b.total).padStart(4)}  ` +
      `verified=${String(verified).padStart(4)}  proposed=${String(b.ai_proposed).padStart(4)}  ` +
      `none=${String(b.none).padStart(4)}  rej=${String(b.rejected).padStart(3)}  ` +
      `ratio=${(ratio * 100).toFixed(0).padStart(3)}%  ${status.padEnd(5)}  need+${need}`
  );
}

async function loadTable(table: string, extra?: (q: any) => any): Promise<Bucket | null> {
  let q: any = sb.from(table).select("id, validation_evidence");
  if (extra) q = extra(q);
  const { data, error } = await q;
  if (error) {
    console.log(`${table.padEnd(24)} ! ${error.message}`);
    return null;
  }
  return tally((data ?? []) as any[]);
}

async function main() {
  console.log("\nEvidence & Validity Map — research-anchor inventory");
  console.log("(verified column = review_status verified + edited; green bar = 80%)\n");

  // AC
  line("AC competencies", (await loadTable("competencies")) ?? emptyBucket());

  // ARC — break out by bank version so we see active vs superseded.
  const { data: versions } = await sb
    .from("ara_question_bank_versions")
    .select("id, version_number, is_active")
    .order("is_active", { ascending: false });
  const allArc = (await loadTable("ara_questions")) ?? emptyBucket();
  line("ARC questions (ALL)", allArc);
  for (const v of (versions ?? []) as any[]) {
    const b = (await loadTable("ara_questions", (q: any) => q.eq("version_id", v.id))) ?? emptyBucket();
    line(`  v${v.version_number ?? "?"}${v.is_active ? " *active" : ""}`, b);
  }

  // Adapter-driven four
  line("Fluent items", (await loadTable("eng_fluent_items")) ?? emptyBucket());
  line("Technical items", (await loadTable("tech_assessment_items")) ?? emptyBucket());
  line("Reflect competencies", (await loadTable("reflect_competencies")) ?? emptyBucket());
  line("Psy scales", (await loadTable("psy_scales")) ?? emptyBucket());

  console.log("");
}

main().catch((e) => {
  console.error("inventory crashed:", e);
  process.exit(1);
});
