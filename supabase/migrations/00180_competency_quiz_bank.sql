-- ════════════════════════════════════════════════════════════════
-- VIFM Competency Quiz Bank - the vetted item bank behind the Pre-Hire
-- situational-judgement screen (and, later, the candidate skill quizzes +
-- Academy lesson checks, which share the same generator).
--
-- Today those quizzes are minted LIVE from the LLM per candidate (no SME sees
-- an item before a hiring candidate, and two candidates get non-equated forms).
-- This table lets a sitting be ASSEMBLED from SME-approved items instead, with a
-- clean fall-back to live generation when a competency's approved pool is thin.
--
-- One row per item; mirrors the QuizQuestion shape + a draft->approved review
-- lifecycle (two-person: the approver differs from the drafter, enforced in the
-- server action). Items are grounded in each competency's behavioural indicators.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS competency_quiz_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_id  uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  type           text NOT NULL CHECK (type IN ('multiple_choice','true_false','pattern_recognition')),
  prompt_en      text NOT NULL,
  prompt_ar      text,
  options_en     jsonb NOT NULL,
  options_ar     jsonb,
  correct_index  smallint NOT NULL CHECK (correct_index BETWEEN 0 AND 5),
  points         smallint NOT NULL DEFAULT 15,
  difficulty     text NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy','medium','hard')),
  explanation_en text,
  explanation_ar text,
  sequence       jsonb,   -- pattern_recognition only
  status         text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','in_review','approved','rejected','retired')),
  source         text NOT NULL DEFAULT 'ai_generated'
                   CHECK (source IN ('ai_generated','human_authored','seed')),
  ar_reviewed    boolean NOT NULL DEFAULT false,
  drafted_by     uuid,
  reviewed_by    uuid,
  reviewed_at    timestamptz,
  rejected_reason text,
  times_administered int NOT NULL DEFAULT 0,
  times_correct      int NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Assembly reads approved items per competency, least-administered-first.
CREATE INDEX IF NOT EXISTS idx_cqi_competency_status
  ON competency_quiz_items(competency_id, status, times_administered);

-- Exposure counter for the assembler's rotation (mirrors psy_increment_administered).
CREATE OR REPLACE FUNCTION cqi_increment_administered(ids uuid[])
RETURNS void
LANGUAGE sql
AS $BODY$
  UPDATE competency_quiz_items
     SET times_administered = times_administered + 1
   WHERE id = ANY(ids);
$BODY$;

-- ── RLS: admin manages the bank; assembly runs via the service role ──
ALTER TABLE competency_quiz_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cqi_admin ON competency_quiz_items;
CREATE POLICY cqi_admin ON competency_quiz_items
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
