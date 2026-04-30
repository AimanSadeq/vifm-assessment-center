-- ============================================================
-- 00029 — Per-assessment pillars_in_scope override
-- ============================================================
-- Today the pillars in scope for an assessment are derived from
-- the engagement_stage:
--   department  → 4 fixed pillars (Data, Talent, Culture, Operations)
--   division    → 6 fixed pillars (adds Strategy, Governance)
--   enterprise  → all 8
--
-- Different clients in different sectors reasonably want different
-- pillar combinations at the same tier. A bank running Stage 1
-- might prioritise Data + Governance + Talent + Model Management;
-- a marketing agency might want Strategy + Talent + Culture +
-- Operations. The price (and the question count) is the same — the
-- *which* changes.
--
-- This migration adds an explicit pillars_in_scope text[] column
-- that overrides the stage default when set. NULL means "use the
-- stage default" — legacy assessments created before this column
-- existed continue to work via that fallback path in the helper
-- src/lib/constants/ara-stages.ts → getPillarsForAssessment().
--
-- Wizard rules:
--   department  → exactly 4 of 8
--   division    → exactly 6 of 8
--   enterprise  → all 8 (no UI shown — column stays NULL)
--
-- After respondent answers exist, the column is treated as locked
-- (UI side) — flipping it mid-engagement would invalidate already-
-- answered pillars. No DB-level lock for now; consultant discipline.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.
-- ============================================================

ALTER TABLE ara_assessments
  ADD COLUMN IF NOT EXISTS pillars_in_scope text[];

-- GIN index so future queries like "find all assessments that
-- included Governance" stay efficient as the table grows.
CREATE INDEX IF NOT EXISTS ara_assessments_pillars_in_scope_gin
  ON ara_assessments USING gin (pillars_in_scope);

COMMENT ON COLUMN ara_assessments.pillars_in_scope IS
  'Optional override of which pillars this assessment scores. NULL = use the engagement_stage default (department=4, division=6, enterprise=8). When set, must respect the stage cardinality. See ARA_STAGE_MAP[stage].applicable_pillars for defaults and src/lib/constants/ara-stages.ts → getPillarsForAssessment for the resolution logic.';
