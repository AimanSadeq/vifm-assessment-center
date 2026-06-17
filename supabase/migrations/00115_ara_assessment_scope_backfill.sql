-- ════════════════════════════════════════════════════════════════
-- 00115 - Backfill ara_assessments.region/sector from the owning org
--
-- The assessment row is the single source of truth for region + sector
-- across the ARC module (compliance scoring, the report header + sector
-- label, peer-benchmark cohort matching, and respondent question
-- filtering all read it). The create wizard historically exposed both as
-- free-choice fields, so a mis-pick could store a region/sector that
-- diverged from the client organisation - which would, for example,
-- silently exclude the banking-only SAMA Cyber Security Framework
-- (migration 00113) from a Saudi bank.
--
-- The application now stamps region/sector from the org at creation and
-- re-stamps draft assessments when the org is edited. This migration
-- corrects any pre-existing rows that diverged before those guards
-- existed, so the row matches the client it belongs to.
--
-- Scope: only DRAFT assessments that have not yet collected any answers are
-- corrected. active / completed / frozen / archived rows - and any draft
-- that already has responses - are left untouched, because respondent
-- question selection keys off region/sector, so moving it after answers
-- exist would re-filter a run mid-flight. Pre-existing divergence on those
-- rows is left as-is here (not auto-rewritten); new assessments inherit the
-- corrected org values at creation, and the org-edit path re-stamps clean
-- drafts going forward.
--
-- Idempotent: only rows that actually differ are updated; re-running is a
-- no-op once aligned.
-- ════════════════════════════════════════════════════════════════

UPDATE ara_assessments a
SET region = o.region,
    sector = o.sector
FROM ara_organizations o
WHERE a.organization_id = o.id
  AND a.status = 'draft'
  AND (a.region <> o.region OR a.sector <> o.sector)
  AND NOT EXISTS (
    SELECT 1 FROM ara_responses r WHERE r.assessment_id = a.id
  );
