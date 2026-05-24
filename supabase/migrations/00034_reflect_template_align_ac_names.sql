-- ============================================================
-- VIFM Reflect 360 — align template competency names with AC catalogue
-- Migration 00034
--
-- The seed template from 00033 used VIFM-flavoured competency names
-- ("Strategic Thinking", "Drive for Results", etc.). After M6 (course
-- recommender bridge), we discovered those names did not match any
-- entry in the AC `competencies` table, so the recommender couldn't
-- find course tags and returned empty.
--
-- This migration renames the template's five competencies to use the
-- AC catalogue's existing competency names, so a freshly-cloned
-- Reflect framework immediately produces course recommendations.
-- Behaviours are untouched; only the competency labels move.
-- ============================================================

DO $b$
DECLARE
  v_framework_id uuid;
BEGIN
  SELECT id INTO v_framework_id
  FROM reflect_frameworks
  WHERE is_template = true
    AND name_en = 'VIFM Leadership Essentials'
  LIMIT 1;

  IF v_framework_id IS NULL THEN
    RAISE NOTICE 'VIFM Leadership Essentials template not found — skipping rename.';
    RETURN;
  END IF;

  UPDATE reflect_competencies
  SET name_en = 'Drives Vision and Purpose',
      description_en = 'Paints a compelling picture of the future, anticipates change, and connects today''s actions to long-term outcomes.'
  WHERE framework_id = v_framework_id AND name_en = 'Strategic Thinking';

  UPDATE reflect_competencies
  SET name_en = 'Drives Results',
      description_en = 'Sets ambitious goals, holds self and others accountable, and turns plans into measurable outcomes.'
  WHERE framework_id = v_framework_id AND name_en = 'Drive for Results';

  UPDATE reflect_competencies
  SET name_en = 'Builds Effective Teams',
      description_en = 'Develops, motivates, and trusts the team to deliver — and creates an environment where people grow.'
  WHERE framework_id = v_framework_id AND name_en = 'People Leadership';

  UPDATE reflect_competencies
  SET name_en = 'Communicates Effectively',
      description_en = 'Communicates clearly to any audience and influences decisions through credibility, not authority.'
  WHERE framework_id = v_framework_id AND name_en = 'Communication & Influence';

  UPDATE reflect_competencies
  SET name_en = 'Learning Agility',
      description_en = 'Stays effective through change, learns from setbacks, and remains open to new ways of working.'
  WHERE framework_id = v_framework_id AND name_en = 'Adaptability & Learning';
END
$b$;
