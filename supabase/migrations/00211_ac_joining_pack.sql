-- Assessment Center: the joining pack, and reasonable adjustments.
--
-- BPS standard:
--   5.38  the service provider shall prepare a pack of materials as joining
--         instructions for participants
--   5.39  the pack shall give all practical information - dates, times,
--         locations - and everything needed to decide whether to consent
--   5.41  the pack shall include the purpose of this centre, what participants
--         will do, how to prepare including practice materials, how results
--         will be used, what recommendations or decisions will be made, how
--         long results are kept, whether results may be used in validation or
--         research, and how to request reasonable adjustments
--   5.11  participants shall be told if and how they will receive feedback,
--         before attending
--   5.12  participants shall be told if and how the information will be used to
--         make decisions, and when they are likely to hear
--   5.13  participants shall be told who will receive reports and asked to
--         agree before attending
--   3.17  participants shall have enough information to give informed consent
--   5.8   consent should cover retention for follow-up validation or research
--   4.47  the policy statement shall be provided to participants
--   5.45  the briefing shall be enough for a participant to anticipate whether
--         they need to request an adjustment
--   5.46  participants shall be asked in advance about disability related or
--         other needs
--   5.47  the service provider shall ensure reasonable adjustments are made
--   4.10  the design shall let all suitable participants equally access and
--         demonstrate their capabilities
--
-- Today consent is a page of generic text with no centre in it: a participant
-- agrees before being told what the centre is for, what will happen, who sees
-- the result or how long it is kept. Consent given without that is not informed
-- consent, which is the clause the whole of section 5 turns on.
--
-- Most of the pack is generated from the design that already exists - the
-- purpose, the dates, the exercises and their timings - so these columns hold
-- only what the design cannot know.

ALTER TABLE engagements
  -- What this centre is for, in words a participant reads (5.41.1). The
  -- purpose enum says selection or development; this says why, for them.
  ADD COLUMN IF NOT EXISTS pack_purpose_statement text,
  -- Where, and anything practical the dates do not cover (5.39).
  ADD COLUMN IF NOT EXISTS pack_location text,
  -- How to prepare, including practice materials (5.41.3).
  ADD COLUMN IF NOT EXISTS pack_preparation text,
  -- How the results will be used (5.41.4).
  ADD COLUMN IF NOT EXISTS pack_results_use text,
  -- What recommendations or decisions follow, and when they will hear
  -- (5.41.5, 5.12).
  ADD COLUMN IF NOT EXISTS pack_decisions text,
  ADD COLUMN IF NOT EXISTS pack_decision_timing text,
  -- Who receives reports. The participant is asked to agree to this list
  -- before attending (5.13), so it is also the boundary any later disclosure
  -- is measured against.
  ADD COLUMN IF NOT EXISTS pack_report_recipients text,
  -- Whether and how feedback is given (5.11).
  ADD COLUMN IF NOT EXISTS pack_feedback_offer text
    CHECK (pack_feedback_offer IN ('written_report', 'verbal_debrief', 'both', 'none')),
  ADD COLUMN IF NOT EXISTS pack_feedback_when text,
  -- How long results are kept (5.41.6) and whether they may be used for
  -- validation or research afterwards (5.41.7, 5.8). Research is opt-in per
  -- centre and consented to separately by the participant.
  ADD COLUMN IF NOT EXISTS retention_months integer NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS research_use boolean NOT NULL DEFAULT false,
  -- How to ask for an adjustment (5.41.8, 5.45).
  ADD COLUMN IF NOT EXISTS pack_adjustments_note text,
  -- Published means participants may be sent it. Until then it is a draft and
  -- the centre cannot honestly collect consent against it.
  ADD COLUMN IF NOT EXISTS pack_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS pack_published_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN engagements.pack_report_recipients IS
  'Who receives reports from this centre, agreed by the participant before attending (BPS 5.13). Anyone outside this list needs express permission (BPS 8.13).';
COMMENT ON COLUMN engagements.retention_months IS
  'How long centre results are kept, stated in the joining pack (BPS 5.41.6). Default 24 months, matching the platform retention policy.';

ALTER TABLE candidates
  -- Read the pack, then consent (3.17, 5.39). Recorded separately from consent
  -- so it is possible to tell the two apart afterwards.
  ADD COLUMN IF NOT EXISTS pack_ack_at timestamptz,
  -- Asked of every participant, not only those who volunteer it (5.46).
  -- 'not_asked' is the honest state for centres that ran before this existed.
  ADD COLUMN IF NOT EXISTS adjustment_status text NOT NULL DEFAULT 'not_asked'
    CHECK (adjustment_status IN ('not_asked', 'none_needed', 'requested', 'agreed', 'declined')),
  ADD COLUMN IF NOT EXISTS adjustment_request text,
  ADD COLUMN IF NOT EXISTS adjustment_requested_at timestamptz,
  -- What was actually put in place, and what it did to the timings, which
  -- assessors need to know when they read the evidence (5.47, 4.33).
  ADD COLUMN IF NOT EXISTS adjustment_agreed text,
  ADD COLUMN IF NOT EXISTS adjustment_extra_minutes integer,
  ADD COLUMN IF NOT EXISTS adjustment_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS adjustment_decided_by uuid REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN candidates.adjustment_status IS
  'Reasonable adjustments (BPS 5.45-5.47). not_asked means the question was never put, which is itself a gap; none_needed means the participant was asked and said no.';
COMMENT ON COLUMN candidates.adjustment_extra_minutes IS
  'Extra time agreed, per timed exercise. Assessors see it so a slower finish is not read as weaker performance.';
