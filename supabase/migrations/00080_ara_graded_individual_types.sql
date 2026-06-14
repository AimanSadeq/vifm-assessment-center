-- ============================================================
-- VIFM ARC - graded individual-factor question types
--
-- Adds two performance-style question types to the ARC question bank,
-- used ONLY on the individual / personal factors (not org pillars):
--
--   situational_judgment - a realistic AI scenario; respondent picks the
--                          best action, scored against an expert key.
--   knowledge_check      - an objective right/wrong item (e.g. spot the
--                          hallucination), scored against the correct answer.
--
-- Both reuse the existing single-select mechanism: answers store in
-- ara_responses.answer_value; scoring is server-side via score_map
-- (calculateQuestionScore). The answer key is NEVER sent to the browser
-- (stripped in the respond page before reaching the client form).
--
-- NOTE: ADD VALUE only - the seed that USES these values must live in a
-- SEPARATE migration (00081), because a new enum value cannot be used in
-- the same transaction that introduces it.
-- ============================================================

ALTER TYPE ara_question_type ADD VALUE IF NOT EXISTS 'situational_judgment';
ALTER TYPE ara_question_type ADD VALUE IF NOT EXISTS 'knowledge_check';
