-- ════════════════════════════════════════════════════════════════
-- 00166 - Technical custom assessments (saved, admin-managed)
--
-- A reusable, named "pick-and-choose" sitting design in the Technical
-- Sandbox family: an admin curates a subset of a function's knowledge
-- skills and/or hands-on tasks (with an optional MCQ knowledge weight +
-- talent lens) and SAVES it so the same custom assessment can be reused
-- when issuing vouchers / a trial link, instead of re-picking the
-- custom_config every time.
--
-- Conventions mirror technical_sandbox_vouchers (00078):
--   - uuid PK default gen_random_uuid()
--   - function_id FK -> technical_functions(id) ON DELETE CASCADE
--   - created_by plain nullable uuid (no FK), app-set
--   - created_at / updated_at timestamptz NOT NULL DEFAULT now()
--   - BEFORE UPDATE trigger -> update_updated_at()
--   - RLS enabled, single admin-only FOR ALL policy (auth_role()='admin');
--     all writes go through the service-role client in app code.
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS technical_custom_assessments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  function_id uuid NOT NULL REFERENCES technical_functions(id) ON DELETE CASCADE,
  skills      text[] NOT NULL DEFAULT '{}',   -- selected knowledge-skill keys/names
  block_ids   text[] NOT NULL DEFAULT '{}',   -- selected technical_skill_blocks ids (text, matches custom_config shape)
  mcq_pct     int  NOT NULL DEFAULT 0 CHECK (mcq_pct >= 0 AND mcq_pct <= 100),
  talent_lens text CHECK (talent_lens IS NULL OR talent_lens IN ('acquisition','development')),
  created_by  uuid,                            -- app-set; nullable, no FK (mirrors vouchers.created_by)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tech_custom_assessments_function
  ON technical_custom_assessments(function_id);

CREATE TRIGGER trg_technical_custom_assessments_updated_at
  BEFORE UPDATE ON technical_custom_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE technical_custom_assessments ENABLE ROW LEVEL SECURITY;

-- Admin-only at the table level; the public sit/redeem flow never touches this
-- table (it only ever reads a saved design through an admin-issued voucher's
-- custom_config). All app writes use the service-role client.
CREATE POLICY tech_custom_assessments_all_admin ON technical_custom_assessments
  FOR ALL USING (auth_role() = 'admin');
