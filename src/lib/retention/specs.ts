import type { RetentionSpec } from "./engine";

/**
 * Which tables the one retention policy (policy.ts) applies to, per service.
 *
 * Adding a service means adding a spec here - not writing another purge. Every
 * spec follows the same shape: delete the personal record, sweep any keyed
 * session, anonymise the voucher redemption.
 *
 * ARC is deliberately partial: its assessment purge has bespoke collateral
 * (Storage files, email log, an audit-log entry) and lives in
 * src/lib/ara/retention.ts. This spec covers only the piece ARC never had -
 * anonymising its voucher redemptions - and the cron runs both.
 */
export const RETENTION_SPECS: RetentionSpec[] = [
  {
    key: "cognitive",
    label: "Logica (cognitive)",
    // psy_item_responses cascade on delete.
    deletes: [{ table: "psy_results", match: { kind: "cognitive" } }],
    sweeps: [{ table: "psy_sessions", match: { kind: "cognitive" } }],
    anonymise: [{ table: "cognitive_voucher_redemptions" }],
  },
  {
    key: "fluent",
    label: "Fluent (English placement)",
    // score_runs + human_ratings cascade (00046).
    deletes: [{ table: "eng_fluent_results" }],
    sweeps: [{ table: "eng_fluent_sessions" }],
    anonymise: [{ table: "eng_fluent_voucher_redemptions" }],
  },
  {
    key: "persona",
    label: "Persona (behavioural)",
    // SCOPED to self-served / voucher sittings only. This table also holds
    // engagement-bound sittings (candidate_id NOT NULL) that feed Succession
    // Readiness; those are governed by the engagement's lifecycle, not this
    // window, and the admin page explicitly promises they are untouched.
    deletes: [{ table: "behavioral_assessment_sessions", matchNull: ["candidate_id"] }],
    anonymise: [{ table: "persona_voucher_redemptions" }],
  },
  {
    key: "technical",
    label: "Techno (technical certification)",
    deletes: [
      { table: "tech_assessment_results" },
      { table: "tech_assessment_sessions" },
      { table: "technical_sandbox_sessions" },
    ],
    // CHANGED: previously hard-deleted these rows, which erased the seat ledger
    // behind a voucher's used_count. Now anonymised, per the platform policy.
    anonymise: [{ table: "technical_sandbox_voucher_redemptions" }],
  },
  {
    key: "prehire",
    label: "Pre-Hire (screening)",
    // prehire_stage_results + demographics cascade from the candidate.
    deletes: [{ table: "prehire_candidates" }],
    // CHANGED: previously deleted alongside the candidate - see Techno above.
    anonymise: [{ table: "prehire_voucher_redemptions" }],
  },
  {
    key: "roleReadiness",
    label: "Role Readiness",
    // NEW: this service had no retention at all. rr_candidates IS the personal
    // record (name, email, access token) - Role Readiness has no separate
    // redemption table, so there is nothing to anonymise. rr_section_results
    // cascades (00153).
    deletes: [{ table: "rr_candidates" }],
  },
  {
    key: "ara",
    label: "AR Compass (vouchers)",
    // Assessment purge stays in src/lib/ara/retention.ts (bespoke collateral).
    // NEW: ARC's voucher redemptions were never anonymised by anything.
    anonymise: [{ table: "ara_voucher_redemptions" }],
  },
];

export function findRetentionSpec(key: string): RetentionSpec | undefined {
  return RETENTION_SPECS.find((s) => s.key === key);
}
