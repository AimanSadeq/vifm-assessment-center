/**
 * Probe which VIFM Fluent migrations are actually applied on the live DB.
 *
 *   npx tsx scripts/check-fluent-migrations.ts
 *
 * Read-only: selects one row/column per migration artifact and reports
 * present (✓) / missing (✗). No writes. Uses the service-role key from
 * .env.local so RLS doesn't hide tables.
 */
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd(), true);
import { createClient } from "@supabase/supabase-js";

type Check = { migration: string; what: string; table: string; col: string };

const CHECKS: Check[] = [
  { migration: "00042", what: "eng_fluent_results", table: "eng_fluent_results", col: "id" },
  { migration: "00043", what: "eng_fluent_results.integrity_flags", table: "eng_fluent_results", col: "integrity_flags" },
  { migration: "00043", what: "eng_fluent_results.email_sent_at", table: "eng_fluent_results", col: "email_sent_at" },
  { migration: "00044", what: "eng_fluent_results.candidate_id", table: "eng_fluent_results", col: "candidate_id" },
  { migration: "00044", what: "eng_fluent_results.engagement_id", table: "eng_fluent_results", col: "engagement_id" },
  { migration: "00045", what: "eng_fluent_sessions", table: "eng_fluent_sessions", col: "id" },
  { migration: "00046", what: "eng_fluent_human_ratings", table: "eng_fluent_human_ratings", col: "id" },
  { migration: "00046", what: "eng_fluent_score_runs", table: "eng_fluent_score_runs", col: "id" },
  { migration: "00048", what: "eng_fluent_items", table: "eng_fluent_items", col: "id" },
  { migration: "00048", what: "eng_fluent_item_responses", table: "eng_fluent_item_responses", col: "id" },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
    return;
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const missing = new Set<string>();
  for (const c of CHECKS) {
    const { error } = await sb.from(c.table).select(c.col).limit(1);
    if (error) {
      missing.add(c.migration);
      console.log(`✗ [${c.migration}] ${c.what} — ${error.message.slice(0, 70)}`);
    } else {
      console.log(`✓ [${c.migration}] ${c.what}`);
    }
  }

  const all = Array.from(new Set(CHECKS.map((c) => c.migration))).sort();
  const applied = all.filter((m) => !missing.has(m));
  console.log(`\nApplied: ${applied.join(", ") || "(none)"}`);
  console.log(`Missing/incomplete: ${Array.from(missing).sort().join(", ") || "(none)"}`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e);
    process.exit(1);
  }
);
