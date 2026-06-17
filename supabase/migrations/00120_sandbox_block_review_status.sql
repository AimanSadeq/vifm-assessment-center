-- ════════════════════════════════════════════════════════════════
-- 00120 - SME review/approval workflow for sandbox skill blocks
--
-- Give performance sandbox tasks (technical_skill_blocks) the same
-- draft -> in_review -> approved -> rejected/retired lifecycle the MCQ
-- items already have (tech_assessment_items, migration 00053), so a
-- certified COMBINED credential can rest on SME-APPROVED sandbox tasks,
-- not just approved MCQ items.
--
-- IMPORTANT: review_status is ORTHOGONAL to the existing `status`
-- (active/inactive), which controls runtime VISIBILITY and is what
-- 00119 used to retire SQL blocks. Do not overload them.
--
-- Backfill: every block seeded so far (00077 finance, 00086, 00117 L&D)
-- is hand-authored + SME-noted, so backfill to 'approved' - otherwise the
-- moment the certified path requires 'approved' (Build 2 wiring), every
-- live combined sitting that previously certified would silently drop to
-- no-credential.
--
-- Idempotent (ADD COLUMN IF NOT EXISTS; backfill only NULL/unset rows).
-- ════════════════════════════════════════════════════════════════

ALTER TABLE technical_skill_blocks
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'draft'
    CHECK (review_status IN ('draft','in_review','approved','rejected','retired')),
  ADD COLUMN IF NOT EXISTS reviewed_by   uuid,
  ADD COLUMN IF NOT EXISTS reviewer_name text,
  ADD COLUMN IF NOT EXISTS reviewed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS review_notes  text;

-- Existing seeded blocks are hand-authored content - treat as approved so
-- current certified sittings keep working once the gate is enforced.
UPDATE technical_skill_blocks
SET review_status = 'approved',
    reviewer_name = COALESCE(reviewer_name, 'VIFM (seeded content)'),
    reviewed_at = COALESCE(reviewed_at, now())
WHERE review_status = 'draft';

CREATE INDEX IF NOT EXISTS idx_tech_skill_blocks_review
  ON technical_skill_blocks(pillar_id, review_status);
