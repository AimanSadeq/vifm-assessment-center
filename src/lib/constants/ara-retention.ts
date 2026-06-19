/**
 * ARC data-retention window (GOV-05).
 *
 * CLAUDE.md "Compliance Requirements": data retention is a MAXIMUM of 2 years
 * unless contractually extended. This is PDPL-relevant for Saudi-government
 * clients (e.g. SDAIA). Archived assessments older than this are eligible for
 * the retention purge. Single source of truth - imported by the purge logic
 * (src/lib/ara/admin-actions.ts) and the admin retention page so the value
 * can never drift between them.
 */
export const ARA_RETENTION_YEARS = 2;
