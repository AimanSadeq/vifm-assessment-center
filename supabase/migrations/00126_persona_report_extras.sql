-- ════════════════════════════════════════════════════════════════
-- 00126 - Persona report generated artefacts cache
--
-- A single jsonb bag of generated long-form report text for a Persona
-- sitting, mirroring 00125 competency_insights: generated once (at submit
-- or first render) and reused so views do not re-spend tokens. Additive,
-- idempotent, tolerant - NULL means "not generated yet" -> deterministic
-- fallback copy is used.
--
-- Shape (every key optional; language-scoped so EN and AR never mix):
--   {
--     "en": {
--       "summary": "<holistic opening narrative (development)>",
--       "interview_probes": { "<competency_id>": ["q1","q2"] },   // hiring
--       "consistency": { "index": 0.0, "flag": "ok|review", "note": "..." }
--     },
--     "ar": { ...same shape, Arabic copy... }
--   }
-- ════════════════════════════════════════════════════════════════

ALTER TABLE behavioral_assessment_sessions
  ADD COLUMN IF NOT EXISTS report_extras jsonb;
