-- ============================================================
-- 00097 - Optional per-competency target proficiency (handover C)
--
-- Today a role uses one role-level bar (role_profiles.default_target_proficiency).
-- A proper job analysis (e.g. SDAIA) often sets a different bar per competency
-- (Ethical Conduct at 5, Digital Fluency at 3). The engine already supports a
-- per-competency target (RoleCompetencyReq.target); this gives it a home.
-- NULL falls back to the role default.
--
-- (Delivered as handover "00085_role_competency_target"; renumbered to 00097.)
-- Idempotent.
-- ============================================================

ALTER TABLE role_profile_competencies
  ADD COLUMN IF NOT EXISTS target_proficiency numeric(2,1)
    CHECK (target_proficiency IS NULL OR target_proficiency BETWEEN 1 AND 5);
