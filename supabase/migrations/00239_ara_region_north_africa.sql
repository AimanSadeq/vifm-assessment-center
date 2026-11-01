-- ============================================================
-- 00239 - Third AI Readiness Compass region: North Africa.
--   The enum behind ara_organizations / ara_assessments /
--   ara_regulatory_frameworks gains 'north_africa', and the text CHECKs on
--   ara_questions, ara_vouchers and ara_regulatory_documents accept it.
--   Question region 'both' already means "every region" in the serving code
--   (region = 'both' OR region = assessment.region), so the whole active bank
--   serves North Africa sittings. No regulatory frameworks are seeded for the
--   region yet; the compliance section says so until they are added.
-- ADDITIVE and idempotent.
-- ============================================================

ALTER TYPE ara_region ADD VALUE IF NOT EXISTS 'north_africa';

ALTER TABLE ara_questions DROP CONSTRAINT IF EXISTS ara_questions_region_check;
ALTER TABLE ara_questions
  ADD CONSTRAINT ara_questions_region_check CHECK (region IN ('uae', 'saudi', 'north_africa', 'both'));

ALTER TABLE ara_vouchers DROP CONSTRAINT IF EXISTS ara_vouchers_region_check;
ALTER TABLE ara_vouchers
  ADD CONSTRAINT ara_vouchers_region_check CHECK (region IN ('uae', 'saudi', 'north_africa'));

ALTER TABLE ara_regulatory_documents DROP CONSTRAINT IF EXISTS ara_regulatory_documents_region_check;
ALTER TABLE ara_regulatory_documents
  ADD CONSTRAINT ara_regulatory_documents_region_check CHECK (region IN ('uae', 'saudi', 'north_africa', 'global'));
