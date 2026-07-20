/**
 * ONE data-retention policy for the whole platform.
 *
 * The contract (CLAUDE.md, and the UAE PDPL / Saudi PDPL / GDPR posture we sell
 * on) is: personal data is held for a maximum of 2 years unless contractually
 * extended. Until now that promise had four different implementations - three
 * services anonymised, two hard-deleted, ARC skipped voucher redemptions
 * entirely, and Role Readiness had no purge at all - and only ARC ran on a
 * schedule. This module is the single definition of the policy; specs.ts says
 * which tables it applies to per service, and engine.ts executes it.
 *
 * The policy, in one sentence: after the window, DELETE the personal
 * assessment record and any keyed session, and ANONYMISE the voucher
 * redemption - keeping the row so the commercial seat ledger still reconciles,
 * while removing the person from it.
 *
 * Why anonymise rather than delete the redemption: a voucher's used_count is
 * the billing record. Deleting the rows that explain it leaves the ledger
 * claiming N seats consumed with nothing to audit against, which is worse for
 * a billing dispute and no better for the data subject - PDPL/GDPR require
 * removing the personal data, not the commercial fact that a seat was used.
 */

/** Months of retention. One number, every service. */
export const RETENTION_MONTHS = 24;

/** Typed confirmation required by the manual admin purge pages. */
export const PURGE_CONFIRMATION = "PURGE";

/** The instant before which data is past the retention window. */
export function retentionCutoffIso(now: Date = new Date()): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() - RETENTION_MONTHS);
  return d.toISOString();
}
