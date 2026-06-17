-- ════════════════════════════════════════════════════════════════
-- 00119 - Remove SQL sandbox tasks from all technical assessments
--
-- Per product decision: relational-DB / SQL querying is too technical for
-- the intended audience. Deactivate every SQL-engine skill block across all
-- functions so it never appears in a sitting, the framework showcase, or a
-- generated test. Deactivate (not delete) so it is reversible and no scored
-- responses are orphaned.
--
-- Today only the FP&A worked example carries a SQL block (its "Data Lifecycle
-- Interrogation & BI Architecture" pillar will render with no active blocks
-- afterwards - acceptable; FP&A is a demo example, not a live client function).
-- L&D (2.6) has no SQL blocks. No new function should use engine_type='sql'.
--
-- Idempotent + reversible (set status back to 'active' to restore).
-- ════════════════════════════════════════════════════════════════

UPDATE technical_skill_blocks
SET status = 'inactive'
WHERE engine_type = 'sql'
  AND status <> 'inactive';
