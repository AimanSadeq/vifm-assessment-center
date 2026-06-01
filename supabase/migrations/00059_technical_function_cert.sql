-- ════════════════════════════════════════════════════════════════
-- Technical Assessment — certified FUNCTION banks (per-skill items + cut-scores)
--
-- Phase-3 strand #1. Until now only a DOMAIN run could certify (00053): its bank
-- items are keyed by domain_key. A FUNCTION (Accounts Payable, Treasury…) is a
-- blueprint of skills that don't map to the 10 domains, so its certified items
-- must be keyed by SKILL, not domain. This migration lets the existing item bank
-- hold per-skill items (domain_key NULL) and adds a per-function passing standard
-- so a function run can issue a verifiable technical_proficiency credential.
--
-- The "skills = shared substrate" payoff: one approved bank of items for
-- "Invoice Processing & 3-Way Match" serves EVERY function whose blueprint lists
-- that skill (standard or JD-derived). Certified items stay classic 4-option
-- single MCQ (the CHECK on correct_index is unchanged) — the richer multi/
-- scenario item types live only on the indicative AI path.
-- ════════════════════════════════════════════════════════════════

-- A function-skill item has no domain — it's keyed by `skill` alone. Existing
-- domain items are untouched (domain_key stays set).
ALTER TABLE tech_assessment_items ALTER COLUMN domain_key DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tech_items_skill_status ON tech_assessment_items(skill, status);

-- ── Per-function passing standard ──
-- A function certifies when (1) EACH of its blueprint skills has at least
-- `min_items_per_skill` approved items (a coverage floor — you can't certify a
-- function while a skill is untested), and (2) the score clears `pass_pct`.
CREATE TABLE technical_function_cut_scores (
  function_id         uuid PRIMARY KEY REFERENCES technical_functions(id) ON DELETE CASCADE,
  pass_pct            numeric(5, 2) NOT NULL DEFAULT 70,
  min_items_per_skill smallint NOT NULL DEFAULT 2 CHECK (min_items_per_skill >= 1),
  method              text,                       -- e.g. "Modified Angoff, 3-SME panel"
  rationale           text,
  set_by              uuid,
  set_by_name         text,
  set_at              timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_tech_fn_cut_scores_updated_at
  BEFORE UPDATE ON technical_function_cut_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── RLS: admin manages; authenticated may read (assembly is service-role). ──
ALTER TABLE technical_function_cut_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY tech_fn_cut_scores_select_auth ON technical_function_cut_scores
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY tech_fn_cut_scores_admin_all ON technical_function_cut_scores
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
