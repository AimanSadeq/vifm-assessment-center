/**
 * One-shot cleanup for test artefacts left in the live DB during
 * development of the ARA Personal flow + the AC G7 re-engagement
 * verification. Inert on environments that don't have the rows
 * (each delete is keyed by the test record's known id/email).
 *
 * What this removes:
 *
 *   1. Personal AI Readiness Snapshot test row created during
 *      end-to-end smoke (commit 00eae4a). Identified by the
 *      respondent email "test+personal@vifm.ae".
 *
 *   2. Two empty G7 re-engagement drafts created during the
 *      candidate-copy-bug diagnosis (commit 55ffa30 came later
 *      and fixed it; these were the failed attempts before the
 *      fix). Identified by their UUIDs which were captured in
 *      conversation logs.
 *
 * Idempotent — safe to re-run. Anything already deleted just
 * reports `not found` and moves on.
 *
 * Run:  npx tsx scripts/cleanup-test-data.ts
 */

import { config as loadEnv } from "dotenv";
import { createClient } from "@supabase/supabase-js";
loadEnv({ path: ".env.local" });

const TEST_PERSONAL_EMAIL = "test+personal@vifm.ae";

// G7 re-engagement test drafts — captured during diagnosis. Both
// were ADNOC-engagement re-engagements that were created with
// 0 candidates due to the demographic-columns bug.
const ORPHAN_REENGAGEMENT_IDS = [
  "52ac5fbc-7594-4c25-ab89-48cb54981355",
  "10552a2d-9e86-46e1-b0c8-62dd48f59e6e",
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const sb = createClient(url, key);

  // ─── 1. Personal AI Readiness test rows ─────────────────
  console.log("\n[1] Personal AI Readiness test artefacts");
  const { data: testRespondents } = await sb
    .from("ara_respondents")
    .select("id, assessment_id, name, email")
    .eq("email", TEST_PERSONAL_EMAIL);

  if (!testRespondents || testRespondents.length === 0) {
    console.log("    no test respondents found — nothing to delete");
  } else {
    console.log(`    found ${testRespondents.length} test respondent(s):`);
    for (const r of testRespondents) {
      console.log(`      - ${r.name} <${r.email}> (respondent ${r.id}, assessment ${r.assessment_id})`);
    }
    const respIds = testRespondents.map((r) => r.id);
    const assessmentIds = Array.from(new Set(testRespondents.map((r) => r.assessment_id)));

    // Delete responses first (they cascade from respondent + assessment
    // already, but being explicit keeps the audit trail clear).
    await sb.from("ara_responses").delete().in("respondent_id", respIds);
    // Delete respondents (cascades pillar assignments, supporting materials).
    await sb.from("ara_respondents").delete().in("id", respIds);
    // Delete the parent assessments — they were created solely for the
    // test respondents, so leaving them would mean orphan personal
    // assessments cluttering the consultant dashboard.
    const { error: assessErr } = await sb
      .from("ara_assessments")
      .delete()
      .in("id", assessmentIds);
    if (assessErr) {
      console.warn(`    warning deleting assessments: ${assessErr.message}`);
    } else {
      console.log(`    deleted ${respIds.length} respondent(s) + ${assessmentIds.length} assessment(s)`);
    }
  }

  // ─── 2. Empty G7 re-engagement drafts ───────────────────
  console.log("\n[2] Orphan G7 re-engagement drafts (zero-candidate)");
  for (const id of ORPHAN_REENGAGEMENT_IDS) {
    const { data: existing } = await sb
      .from("engagements")
      .select("id, name, status")
      .eq("id", id)
      .maybeSingle<{ id: string; name: string; status: string }>();
    if (!existing) {
      console.log(`    ${id} — not found (already cleaned up)`);
      continue;
    }
    // Sanity-check: should be 0 candidates. If not, we don't auto-delete
    // — this row may have been repurposed by the user since the test.
    const { count } = await sb
      .from("candidates")
      .select("id", { count: "exact", head: true })
      .eq("engagement_id", id);
    if ((count ?? 0) > 0) {
      console.log(`    ${id} ("${existing.name}") — has ${count} candidate(s); SKIPPING for safety`);
      continue;
    }

    // Cascade-delete the wiring (matrix, exercises, competencies) then
    // the engagement itself. Mirrors the rollback() in createReengagementAction.
    await sb.from("exercise_competency_matrix").delete().eq("engagement_id", id);
    await sb.from("engagement_exercises").delete().eq("engagement_id", id);
    await sb.from("engagement_competencies").delete().eq("engagement_id", id);
    const { error: engErr } = await sb.from("engagements").delete().eq("id", id);
    if (engErr) {
      console.warn(`    ${id} — delete failed: ${engErr.message}`);
    } else {
      console.log(`    ${id} ("${existing.name}") — deleted`);
    }
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
