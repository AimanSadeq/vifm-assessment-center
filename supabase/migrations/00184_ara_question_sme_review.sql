-- ARC (AI Readiness Compass): per-question SME review gate.
--
-- Until now ARC served every is_active question with no human sign-off on the
-- QUESTION itself (the existing validation_evidence.review_status only governs the
-- psychometric citations, not the item). This adds a question-level SME review
-- status. Serving is NOT hard-gated (ARC has no live-AI fallback, so a hard gate
-- would blank the assessment) - instead every ARC result/report is flagged
-- "provisional - content pending SME review" until its served questions are
-- approved (Option 2). The flag clears per-pillar as an SME approves.
--
-- The new column defaults to 'pending' for EVERY existing row, which is the honest
-- reset: no ARC question has been SME-reviewed yet.

ALTER TABLE ara_questions
  ADD COLUMN IF NOT EXISTS sme_status text NOT NULL DEFAULT 'pending'
    CHECK (sme_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS sme_reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS sme_reviewed_at timestamptz;

COMMENT ON COLUMN ara_questions.sme_status IS
  'Question-level human SME review. pending = not yet reviewed (result flagged provisional); approved = SME-signed-off; rejected = do not use. Distinct from validation_evidence.review_status (citation provenance).';

CREATE INDEX IF NOT EXISTS ara_questions_sme_status_idx ON ara_questions(sme_status);
