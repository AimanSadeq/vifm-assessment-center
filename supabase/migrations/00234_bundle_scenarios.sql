-- ============================================================
-- 00234 - Bespoke bundle: scenario-question (SJT) stage.
--
-- Built for the SDC HiPo assessment (Part 1 = 30 client-specific scenarios,
-- MOST/LEAST effective, keyed by level to the client's behavioural
-- indicators; Part 2 = Logica). Generic: any bundle can carry its own
-- competencies and scenarios. ADDITIVE: a bundle without sjt_enabled runs
-- exactly as before.
--
--   bundle_competencies  the client's competencies for the bundle, with the
--                        required level per grade (0 = not required,
--                        1 Basic, 2 Proficient, 3 Advanced).
--   bundle_sjt_items     the scenarios: situation + four responses, each
--                        keyed to a level (Advanced / Proficient / Basic /
--                        Counter-evidence) and an indicator id. Never sent to
--                        the candidate's browser with the keys.
--   bundle_sjt_results   one row per candidate: their fixed scenario and
--                        response order, saved answers, and on submit the
--                        per-competency points, level and the scoring config
--                        used (so results can be rescored later).
--   bundle_settings      gains sjt_enabled and sjt_config (points, LEAST
--                        bonus, cut-offs on a 0-12 scale, order mode).
-- Idempotent / re-runnable.
-- ============================================================

ALTER TABLE bundle_settings ADD COLUMN IF NOT EXISTS sjt_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE bundle_settings ADD COLUMN IF NOT EXISTS sjt_config jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS bundle_competencies (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bespoke_service_id uuid NOT NULL REFERENCES bespoke_services(id) ON DELETE CASCADE,
  code               text NOT NULL CHECK (code ~ '^[A-Z]{2,5}$'),
  name               text NOT NULL,
  category           text,
  definition         text,
  required_levels    jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order         int NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bundle_competencies_code_unique UNIQUE (bespoke_service_id, code)
);

CREATE TABLE IF NOT EXISTS bundle_sjt_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bespoke_service_id uuid NOT NULL REFERENCES bespoke_services(id) ON DELETE CASCADE,
  ref                text NOT NULL,
  competency_code    text NOT NULL,
  target_level       text NOT NULL CHECK (target_level IN ('Basic','Proficient','Advanced')),
  situation          text NOT NULL,
  options            jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) = 4),
  sort_order         int NOT NULL DEFAULT 0,
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bundle_sjt_items_ref_unique UNIQUE (bespoke_service_id, ref)
);
CREATE INDEX IF NOT EXISTS idx_bundle_sjt_items_service ON bundle_sjt_items(bespoke_service_id);

CREATE TABLE IF NOT EXISTS bundle_sjt_results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_candidate_id uuid NOT NULL UNIQUE REFERENCES bundle_candidates(id) ON DELETE CASCADE,
  bespoke_service_id  uuid NOT NULL REFERENCES bespoke_services(id) ON DELETE CASCADE,
  item_order          jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers             jsonb NOT NULL DEFAULT '{}'::jsonb,
  scores              jsonb,
  scoring_config      jsonb,
  started_at          timestamptz NOT NULL DEFAULT now(),
  submitted_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bundle_sjt_results_service ON bundle_sjt_results(bespoke_service_id);

DROP TRIGGER IF EXISTS bundle_competencies_updated_at ON bundle_competencies;
CREATE TRIGGER bundle_competencies_updated_at BEFORE UPDATE ON bundle_competencies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS bundle_sjt_items_updated_at ON bundle_sjt_items;
CREATE TRIGGER bundle_sjt_items_updated_at BEFORE UPDATE ON bundle_sjt_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS bundle_sjt_results_updated_at ON bundle_sjt_results;
CREATE TRIGGER bundle_sjt_results_updated_at BEFORE UPDATE ON bundle_sjt_results FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: admin full. A client_manager may read their own org's competencies and
-- results; the scenario keys stay staff-only. The candidate flow uses the
-- service-role client only.
ALTER TABLE bundle_competencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_sjt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_sjt_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bundle_competencies_admin ON bundle_competencies;
CREATE POLICY bundle_competencies_admin ON bundle_competencies FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
DROP POLICY IF EXISTS bundle_competencies_cm_select ON bundle_competencies;
CREATE POLICY bundle_competencies_cm_select ON bundle_competencies FOR SELECT USING (auth_role() = 'client_manager' AND EXISTS (
  SELECT 1 FROM bespoke_services s WHERE s.id = bundle_competencies.bespoke_service_id AND s.organization_id = cm_org_id()));

DROP POLICY IF EXISTS bundle_sjt_items_admin ON bundle_sjt_items;
CREATE POLICY bundle_sjt_items_admin ON bundle_sjt_items FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

DROP POLICY IF EXISTS bundle_sjt_results_admin ON bundle_sjt_results;
CREATE POLICY bundle_sjt_results_admin ON bundle_sjt_results FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
DROP POLICY IF EXISTS bundle_sjt_results_cm_select ON bundle_sjt_results;
CREATE POLICY bundle_sjt_results_cm_select ON bundle_sjt_results FOR SELECT USING (auth_role() = 'client_manager' AND EXISTS (
  SELECT 1 FROM bespoke_services s WHERE s.id = bundle_sjt_results.bespoke_service_id AND s.organization_id = cm_org_id()));
