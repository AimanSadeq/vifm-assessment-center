-- ════════════════════════════════════════════════════════════════
-- Combined Technical Assessment: an MCQ section inside the sandbox sitting
--
-- The voucher-delivered technical assessment can now blend a knowledge (MCQ)
-- section with the hands-on sandbox section. The MCQ % set on the voucher is a
-- SCORE WEIGHT (not an item count): each section is scored on its own 0-100
-- scale, then blended  combined = mcq*pct + sandbox*(100-pct). mcq_pct = 0 keeps
-- the historical sandbox-only behaviour (fully backward compatible).
-- ════════════════════════════════════════════════════════════════

-- Voucher batch: the agreed MCQ weight for sittings redeemed from it.
ALTER TABLE technical_sandbox_vouchers
  ADD COLUMN IF NOT EXISTS mcq_pct smallint NOT NULL DEFAULT 0
    CHECK (mcq_pct BETWEEN 0 AND 100);

-- Sitting: the MCQ section's weight, server-held keyed test, the taker's
-- answers, the section + combined scores, and any issued credential.
ALTER TABLE technical_sandbox_sessions
  ADD COLUMN IF NOT EXISTS mcq_pct            smallint NOT NULL DEFAULT 0
    CHECK (mcq_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS mcq_test           jsonb,    -- keyed MCQ items (never sent to the browser)
  ADD COLUMN IF NOT EXISTS mcq_answers        jsonb,    -- the taker's answers
  ADD COLUMN IF NOT EXISTS mcq_score_pct      numeric,  -- MCQ section, 0-100
  ADD COLUMN IF NOT EXISTS combined_score_pct numeric,  -- weighted blend, 0-100
  ADD COLUMN IF NOT EXISTS combined_band      text,     -- band of the blended score
  ADD COLUMN IF NOT EXISTS credential_code    uuid;     -- issued technical_proficiency, if both sections passed
