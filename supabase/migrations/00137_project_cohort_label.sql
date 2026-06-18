-- ============================================================
-- 00137 - Project / cohort label for Persona + Cognitive (CAL-PER-406, CAL-TM-303)
-- ============================================================
-- A client engagement often runs Persona (behavioural self-report) AND
-- Cognitive (ability) on the SAME cohort. Today each instrument is only
-- tagged with a client org, so the two cannot be reported together as one
-- project. This adds a free-text project/cohort label that an admin sets
-- when issuing a voucher batch; it rides voucher -> redemption -> result
-- exactly like organization_id, so the shared per-project cohort view can
-- group both instruments by the same label.
--
-- Tolerant: ADD COLUMN IF NOT EXISTS, all nullable free text (NULL =
-- unlabelled / legacy). No CHECK - the label is a human-entered name.
-- ============================================================

-- Persona (behavioural self-report)
ALTER TABLE persona_vouchers
  ADD COLUMN IF NOT EXISTS project_label text;
ALTER TABLE persona_voucher_redemptions
  ADD COLUMN IF NOT EXISTS project_label text;
ALTER TABLE behavioral_assessment_sessions
  ADD COLUMN IF NOT EXISTS project_label text;

-- Cognitive (ability)
ALTER TABLE cognitive_vouchers
  ADD COLUMN IF NOT EXISTS project_label text;
ALTER TABLE cognitive_voucher_redemptions
  ADD COLUMN IF NOT EXISTS project_label text;
ALTER TABLE psy_results
  ADD COLUMN IF NOT EXISTS project_label text;

COMMENT ON COLUMN persona_vouchers.project_label IS
  'Optional project/cohort name (CAL-PER-406). Copied onto the redemption then the session so Persona + Cognitive runs of one cohort report together.';
COMMENT ON COLUMN cognitive_vouchers.project_label IS
  'Optional project/cohort name (CAL-TM-303). Copied onto the redemption then the result so Persona + Cognitive runs of one cohort report together.';
