-- ============================================================
-- 00138 - Pre-Hire requisition competency override (CAL-PRE-502)
-- ============================================================
-- The Pre-Hire competency quiz currently generates from ONE synthetic
-- "{title} core competency" with no behavioural grounding. This lets a
-- requisition carry an explicit competency set (pre-filled from the
-- chosen role profile's competencies, but editable - add/remove from
-- the behavioural 38) that the quiz draws its items from.
--
-- Stored as a uuid[] of competencies.id. Weighting for the top-N
-- sampling is resolved at quiz-build time from role_profile_competencies
-- (a competency in the role profile uses its weight/priority; an added
-- one defaults), so no per-row weight column is needed here.
--
-- Tolerant: ADD COLUMN IF NOT EXISTS. NULL/empty = legacy behaviour
-- (resolve from the role profile, else the synthetic fallback), so
-- existing requisitions are unaffected.
-- ============================================================

ALTER TABLE prehire_requisitions
  ADD COLUMN IF NOT EXISTS competency_ids uuid[];

COMMENT ON COLUMN prehire_requisitions.competency_ids IS
  'Optional explicit competency set for the Pre-Hire quiz (competencies.id[]). Pre-filled from the role profile but editable. NULL/empty = resolve from role_profile_competencies, then the synthetic fallback (CAL-PRE-502).';
