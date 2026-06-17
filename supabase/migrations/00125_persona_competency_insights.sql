-- ════════════════════════════════════════════════════════════════
-- 00125 - Persona per-competency AI insights (hiring report)
--
-- Stores the AI-generated, per-competency narrative for a Persona hiring
-- sitting - grounded in the candidate's actual item-level self-ratings
-- (which statements they rated high vs low) rather than a fixed template.
-- Generated once at submit and reused by the on-screen result + the PDF,
-- so the report is consistent and we don't re-spend tokens per view.
--
-- Shape: { "<competency_id>": "<insight text>" }. NULL until generated
-- (the report falls back to a deterministic narrative). Idempotent.
-- ════════════════════════════════════════════════════════════════

ALTER TABLE behavioral_assessment_sessions
  ADD COLUMN IF NOT EXISTS competency_insights jsonb;
