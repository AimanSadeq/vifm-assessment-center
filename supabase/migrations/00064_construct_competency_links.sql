-- ════════════════════════════════════════════════════════════════
-- Unified construct → competency bridge (the "golden thread", typed)
--
-- Generalises the single-purpose technical_domain_competencies (00054) into one
-- model-correct link table. Every measured construct relates to the behavioural
-- 38 (the spine) through a TYPED relationship + the LAYER it sits in:
--
--   relation : manifests | enables | predicts   (rising evidence strength)
--   layer    : foundations | attainments | competencies
--
--   • foundations (cognitive ability, personality)  → PREDICTS competencies
--   • attainments (technical knowledge, language)    → ENABLES  competencies
--   • competencies (AC/CBI/360)                      → MANIFEST (are the score)
--
-- This is the forward home for the psychometrics modules: cognitive + personality
-- register as `predicts`/`foundations` links and surface on the candidate profile
-- the same principled way Fluent + Technical already do. Seeded from the existing
-- technical bridge so nothing is lost. Additive; technical_domain_competencies
-- stays (unified-profile reads this table first, falls back to it).
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS construct_competency_links (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- the instrument family + its app-resolved key (domain key / skill key / scale id)
  source_kind   text NOT NULL CHECK (source_kind IN ('technical','language','cognitive','personality','ara','reflect','prehire')),
  source_key    text NOT NULL,
  competency_id uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  relation      text NOT NULL DEFAULT 'enables'     CHECK (relation IN ('manifests','enables','predicts')),
  layer         text NOT NULL DEFAULT 'attainments' CHECK (layer IN ('foundations','attainments','competencies')),
  weight        smallint NOT NULL DEFAULT 2 CHECK (weight BETWEEN 1 AND 3),
  -- `predicts` links should be validated (criterion evidence) before high-stakes use.
  validated     boolean NOT NULL DEFAULT false,
  rationale     text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_kind, source_key, competency_id)
);

CREATE INDEX IF NOT EXISTS construct_links_competency_idx ON construct_competency_links (competency_id);
CREATE INDEX IF NOT EXISTS construct_links_source_idx ON construct_competency_links (source_kind, source_key);

ALTER TABLE construct_competency_links ENABLE ROW LEVEL SECURITY;

-- Framework metadata (not candidate data): admin manages it; any authenticated
-- user may read it (it drives the profile rendering).
DROP POLICY IF EXISTS construct_links_admin_all ON construct_competency_links;
CREATE POLICY construct_links_admin_all ON construct_competency_links
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

DROP POLICY IF EXISTS construct_links_read ON construct_competency_links;
CREATE POLICY construct_links_read ON construct_competency_links
  FOR SELECT USING (true);

-- ── Seed from the existing technical bridge (00054) ──────────────
-- Technical domains ENABLE behavioural competencies; attainments layer.
INSERT INTO construct_competency_links (source_kind, source_key, competency_id, relation, layer, weight, rationale)
SELECT 'technical', tdc.domain_key, tdc.competency_id, 'enables', 'attainments',
       COALESCE(tdc.weight, 2),
       'Seeded from technical_domain_competencies (00054).'
FROM technical_domain_competencies tdc
ON CONFLICT (source_kind, source_key, competency_id) DO NOTHING;
