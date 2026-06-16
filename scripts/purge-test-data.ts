/**
 * Purge trial/test data to give a clean slate for testing.
 * Run: npx tsx scripts/purge-test-data.ts
 *
 * SCOPE (confirmed with the owner; system is pre-launch, all data is trial):
 *  - DELETE: participant/user data + emails, results, sessions, responses,
 *    issued credentials, voucher codes + redemptions, client organizations, and
 *    the containers (engagements, ARC assessments, Reflect engagements, Pre-Hire
 *    requisitions, Technical programs) across every service.
 *  - KEEP: admin/login accounts, the competency framework, course catalogue,
 *    question + item banks, role-profile library, technical taxonomy, timers,
 *    norms/cut-scores, and Reflect library templates.
 *
 * Allowlist only - the script NEVER touches a table that is not in DELETE_TABLES.
 * Reflect per-engagement frameworks are removed via cascade from reflect_engagements
 * so library templates (engagement_id IS NULL) survive.
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Ordered child -> parent (retry loop also resolves order independently).
const DELETE_TABLES: string[] = [
  // AC
  "development_recommendations",
  "consent_records",
  "candidate_reports",
  "overall_assessment_ratings",
  "consensus_ratings",
  "ratings",
  "observations",
  "integration_worksheets",
  "assessor_assignments",
  "candidate_quiz_attempts",
  "academy_lesson_attempts",
  "vifm_enrollments",
  "candidates",
  "exercise_competency_matrix",
  "engagement_exercises",
  "engagement_competencies",
  "engagement_technical_domains",
  "engagements",
  // ARC
  "ara_assessment_scores",
  "ara_pillar_scores",
  "ara_compliance_results",
  "ara_consultant_notes",
  "ara_reports",
  "ara_responses",
  "ara_respondent_pillar_assignments",
  "ara_supporting_materials",
  "ara_use_cases",
  "ara_data_management_log",
  "ara_email_log",
  "ara_voucher_redemptions",
  "ara_respondents",
  "ara_vouchers",
  "ara_assessments",
  "ara_organizations",
  // Reflect (reflect_engagements cascade clears per-engagement frameworks)
  "reflect_responses",
  "reflect_idps",
  "reflect_reports",
  "reflect_raters",
  "reflect_participants",
  "reflect_email_log",
  "reflect_audit_log",
  "reflect_engagements",
  // Fluent
  "eng_fluent_human_ratings",
  "eng_fluent_score_runs",
  "eng_fluent_item_responses",
  "eng_fluent_results",
  "eng_fluent_sessions",
  "eng_fluent_voucher_redemptions",
  "eng_fluent_vouchers",
  // Cognitive / Psychometrics
  "psy_item_responses",
  "psy_results",
  "psy_sessions",
  "psychometric_results",
  "cognitive_voucher_redemptions",
  "cognitive_vouchers",
  // Persona
  "behavioral_assessment_responses",
  "behavioral_competency_scores",
  "behavioral_assessment_sessions",
  "persona_voucher_redemptions",
  "persona_vouchers",
  // Technical
  "tech_assessment_results",
  "tech_assessment_sessions",
  "technical_sandbox_responses",
  "technical_sandbox_sessions",
  "technical_sandbox_voucher_redemptions",
  "technical_sandbox_vouchers",
  "technical_program_participants",
  "technical_program_domains",
  "technical_programs",
  // Pre-Hire
  "prehire_audit_log",
  "prehire_stage_results",
  "prehire_candidates",
  "prehire_requisitions",
  // Cross-cutting
  "cbi_sessions",
  "notifications",
  "vifm_credentials",
  "vifm_course_quote_requests",
  "readiness_results",
  // AC client registry
  "organizations",
];

// Config/content tables - reported after to PROVE they were preserved.
const KEEP_VERIFY: string[] = [
  "profiles",
  "competencies",
  "competency_clusters",
  "competency_domains",
  "behavioral_indicators",
  "exercises",
  "ara_questions",
  "ara_question_bank_versions",
  "ara_regulatory_frameworks",
  "vifm_courses",
  "eng_fluent_items",
  "tech_assessment_items",
  "psy_items",
  "role_profiles",
  "reflect_frameworks",
  "assessment_timers",
  "construct_competency_links",
];

async function countRows(table: string): Promise<number | null> {
  const { count, error } = await sb.from(table).select("*", { count: "exact", head: true });
  if (error) return null; // table absent / not exposed - treat as N/A
  return count ?? 0;
}

async function deleteAll(table: string): Promise<{ ok: boolean; error?: string }> {
  const { error } = await sb.from(table).delete({ count: "exact" }).not("id", "is", null);
  return error ? { ok: false, error: error.message } : { ok: true };
}

async function main() {
  console.log("=== PURGE TRIAL DATA - clean slate ===\n");

  // Before snapshot
  const before: Record<string, number | null> = {};
  for (const t of DELETE_TABLES) before[t] = await countRows(t);
  const totalBefore = DELETE_TABLES.reduce((a, t) => a + (before[t] ?? 0), 0);
  console.log(`Rows to clear across ${DELETE_TABLES.length} tables: ${totalBefore}`);
  const nonEmpty = DELETE_TABLES.filter((t) => (before[t] ?? 0) > 0);
  for (const t of nonEmpty) console.log(`  ${t}: ${before[t]}`);
  console.log("");

  // Iterative-retry delete (resolves FK order without a hard topo sort)
  const MAX_PASSES = 8;
  let remaining = [...DELETE_TABLES];
  const errors: Record<string, string> = {};
  for (let pass = 1; pass <= MAX_PASSES && remaining.length > 0; pass++) {
    const stillNonEmpty: string[] = [];
    for (const t of remaining) {
      const c = await countRows(t);
      if (c === null || c === 0) continue; // absent or already empty
      const res = await deleteAll(t);
      if (!res.ok) errors[t] = res.error ?? "unknown";
      const after = await countRows(t);
      if ((after ?? 0) > 0) stillNonEmpty.push(t);
    }
    console.log(`Pass ${pass}: ${remaining.length - stillNonEmpty.length} cleared, ${stillNonEmpty.length} remaining`);
    if (stillNonEmpty.length === remaining.length) break; // no progress
    remaining = stillNonEmpty;
  }

  // After snapshot of DELETE tables
  console.log("\n--- After ---");
  let stuck = 0;
  for (const t of DELETE_TABLES) {
    const c = await countRows(t);
    if (c === null) continue;
    if (c > 0) {
      stuck++;
      console.log(`  STILL HAS ROWS: ${t} = ${c}${errors[t] ? ` (last error: ${errors[t]})` : ""}`);
    }
  }
  if (stuck === 0) console.log("  All target tables empty. ✅");

  // Preservation check
  console.log("\n--- Preserved (config/content) ---");
  for (const t of KEEP_VERIFY) {
    const c = await countRows(t);
    console.log(`  ${t}: ${c === null ? "n/a (absent)" : c}`);
  }
  const tmpl = await sb
    .from("reflect_frameworks")
    .select("*", { count: "exact", head: true })
    .is("engagement_id", null);
  console.log(`  reflect_frameworks (library templates, engagement_id IS NULL): ${tmpl.count ?? 0}`);

  console.log("\n=== DONE ===");
}

main().catch((e) => {
  console.error("Purge failed:", e);
  process.exit(1);
});
