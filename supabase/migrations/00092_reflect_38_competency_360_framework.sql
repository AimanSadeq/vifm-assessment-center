-- ============================================================
-- 00092 — VIFM 38-Competency Behavioural 360 framework (template)
--
-- Seeds a Reflect framework that mirrors the AC behavioural catalogue so the
-- 360 measures the same 38 competencies as the behavioural self-assessment.
-- Competency names/descriptions are pulled STRAIGHT FROM the catalogue and
-- each Reflect competency is hard-linked to its catalogue row via
-- ac_competency_id (added in migration 00088). This removes name-matching.
--
-- (Delivered as handover "00083"; renumbered to 00092 because 00083 is taken
-- by 00083_assessment_timers.sql and Slice 1 landed at 00087-00091.)
--
-- Prerequisite: 00088_reflect_competency_ac_link.sql (adds ac_competency_id).
-- The full 4-item observer bank is loaded by 00093 (replaces the starter row).
-- Idempotent: safe to re-run.
-- ============================================================

DO $$
DECLARE
  v_fw uuid := 'f1000001-0000-0000-0000-000000000001';  -- stable id for cross-env reference
BEGIN
  -- 1) The framework (library template: engagement_id NULL, is_template true).
  INSERT INTO reflect_frameworks
    (id, engagement_id, name_en, name_ar, description_en, source, is_template, is_active)
  VALUES
    (v_fw, NULL,
     'VIFM 38-Competency Behavioural 360',
     'تقييم 360 السلوكي - 38 جدارة',
     'Observer-perspective 360 across all four domains and 38 competencies of the VIFM behavioural framework. Mirrors the behavioural self-assessment item bank so Self and Others are directly comparable.',
     'custom', true, true)
  ON CONFLICT (id) DO NOTHING;

  -- 2) 38 competencies, copied from the catalogue, linked by ac_competency_id.
  --    The UUID prefix targets exactly the 38 v2 behavioural competencies.
  INSERT INTO reflect_competencies
    (framework_id, ac_competency_id, name_en, name_ar, description_en, description_ar, display_order)
  SELECT
    v_fw, c.id, c.name, c.name_ar, c.description, c.description_ar,
    row_number() OVER (ORDER BY d.sort_order, cl.sort_order, c.sort_order)::int
  FROM competencies c
  JOIN competency_clusters cl ON cl.id = c.cluster_id
  JOIN competency_domains  d  ON d.id  = cl.domain_id
  WHERE c.id::text LIKE 'a0000001-0000-0000-0000-%'
    AND NOT EXISTS (
      SELECT 1 FROM reflect_competencies rc
      WHERE rc.framework_id = v_fw AND rc.ac_competency_id = c.id
    );

  -- 3) A starter observer behaviour per competency. The catalogue description
  --    is already third-person/observer-worded, so it serves as a valid item
  --    and makes the 360 runnable immediately. 00093 EXPANDS this to the full
  --    4-item bank.
  INSERT INTO reflect_behaviors
    (competency_id, level_tier, text_en, text_ar, source, display_order)
  SELECT rc.id, 'all', rc.description_en, rc.description_ar, 'manual', 1
  FROM reflect_competencies rc
  WHERE rc.framework_id = v_fw
    AND NOT EXISTS (
      SELECT 1 FROM reflect_behaviors b WHERE b.competency_id = rc.id
    );

  RAISE NOTICE 'Seeded 38-competency 360 framework % (competencies linked by ac_competency_id).', v_fw;
END $$;
