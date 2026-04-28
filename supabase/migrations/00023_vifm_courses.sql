-- ============================================================
-- VIFM Courses catalogue + recommender mapping
--
-- Bridges the diagnostic side of the portal (AC engagements,
-- ARA assessments) to VIFM's actual revenue-generating offering:
-- training courses. Each course is a PDF outline today with
-- six building blocks (overview / target competencies / target
-- audience / course objectives / methodology / outline). This
-- migration adds:
--
--   vifm_courses                    — one row per course, all 6 blocks
--                                     stored both verbatim and structured
--   vifm_course_competency_tags     — course → AC behavioural competency
--                                     (the 38 from migration 00002),
--                                     with a relevance weight
--   vifm_course_pillar_tags         — course → ARA pillar (the 8),
--                                     with a relevance weight
--
-- Two-axis tagging (behavioural via AC, topical via ARA pillars)
-- because the PDF's own "Target Competencies" block is topical
-- (e.g., "Bookkeeping Automation", "Lease Administration"), while
-- the AC framework is behavioural (e.g., "Strategic Thinking").
-- The recommender ranks courses by gap severity × relevance on
-- whichever axis the diagnostic produced.
--
-- RLS: admins get full access; authenticated users (consultants,
-- assessors, candidates, clients) get read-only so the recommender
-- can surface course names + descriptions on the relevant reports.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Courses
-- ──────────────────────────────────────────────────────────────

CREATE TABLE vifm_courses (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable short code surfaced on reports + URLs (e.g., "CAIP", "CAPA",
  -- "PMP", "AML-CAMS"). Optional — falls back to a slug of title_en.
  code                   text UNIQUE,

  -- Identity (bilingual)
  title_en               text NOT NULL,
  title_ar               text,

  -- Categorisation
  vertical               text NOT NULL CHECK (vertical IN (
    'finance', 'investment', 'treasury', 'accounting', 'banking', 'tax',
    'analytics', 'business_intelligence', 'artificial_intelligence',
    'business_reporting', 'leadership', 'strategy', 'project_management',
    'real_estate'
  )),
  level                  text NOT NULL DEFAULT 'intermediate'
    CHECK (level IN ('foundation', 'intermediate', 'advanced')),
  certification_code     text,                    -- e.g., 'CAIP', 'CAPA', 'CAMS', 'PMP'

  -- Duration model — public courses default to 5 days; corporate /
  -- in-house can be 2-5. Stored as a band so the recommender can
  -- show a flexible range to the consultant.
  default_duration_days  numeric(4,1) NOT NULL DEFAULT 5,
  min_duration_days      numeric(4,1) NOT NULL DEFAULT 2,
  max_duration_days      numeric(4,1) NOT NULL DEFAULT 5,
  CHECK (min_duration_days <= default_duration_days
     AND default_duration_days <= max_duration_days),

  -- Delivery
  delivery_modes         text[] NOT NULL DEFAULT ARRAY['classroom', 'virtual']::text[],
  languages              text[] NOT NULL DEFAULT ARRAY['en']::text[],

  -- Six building blocks (bilingual where applicable). The "_raw"
  -- variants preserve the PDF's literal text for audit/QA; the
  -- structured variants drive the UI.
  -- Block 1 — Overview
  overview_en            text,
  overview_ar            text,
  -- Block 2 — Target competencies (topical, NOT behavioural — the
  -- PDF's own list, e.g. "Detection Capabilities", "Bookkeeping
  -- Automation"). Map separately to AC behavioural competencies via
  -- vifm_course_competency_tags.
  target_competencies_raw_en  text[],
  target_competencies_raw_ar  text[],
  -- Block 3 — Target audience
  audience_en            text,
  audience_ar            text,
  -- Block 4 — Course objectives (bullet list)
  objectives_en          text[],
  objectives_ar          text[],
  -- Block 5 — Methodology
  methodology_en         text,
  methodology_ar         text,
  -- Block 6 — Detailed outline (structured: array of {title, bullets[]})
  outline_en             jsonb,
  outline_ar             jsonb,

  -- Provenance — where the PDF lives, for re-extraction / audit
  source_pdf_path        text,
  -- AI extraction confidence (0-1) populated when the course was
  -- ingested via the AI pipeline; null on manual entries.
  extraction_confidence  numeric(3,2),

  -- Lifecycle
  is_active              boolean NOT NULL DEFAULT true,
  created_by             uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_vifm_courses_vertical ON vifm_courses(vertical);
CREATE INDEX idx_vifm_courses_level ON vifm_courses(level);
CREATE INDEX idx_vifm_courses_active ON vifm_courses(is_active) WHERE is_active = true;
CREATE INDEX idx_vifm_courses_certification ON vifm_courses(certification_code) WHERE certification_code IS NOT NULL;

CREATE TRIGGER vifm_courses_updated_at
  BEFORE UPDATE ON vifm_courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ──────────────────────────────────────────────────────────────
-- Course → AC competency tagging (behavioural axis)
-- ──────────────────────────────────────────────────────────────
-- Maps each course to one or more of the 38 VIFM AC behavioural
-- competencies (from migration 00002) with a relevance weight:
--   1 = tangential (course touches it lightly)
--   2 = related (course develops it as a secondary outcome)
--   3 = core (course primarily develops this competency)
-- The rationale field captures why the AI proposed the mapping
-- (or what the admin's reasoning was on a manual edit) — useful
-- both for QA and for showing on the recommender card.

CREATE TABLE vifm_course_competency_tags (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         uuid NOT NULL REFERENCES vifm_courses(id) ON DELETE CASCADE,
  competency_id     uuid NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  relevance_weight  smallint NOT NULL DEFAULT 2 CHECK (relevance_weight IN (1, 2, 3)),
  rationale         text,
  source            text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai_proposed', 'ai_accepted')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, competency_id)
);

CREATE INDEX idx_vifm_course_comp_tags_course ON vifm_course_competency_tags(course_id);
CREATE INDEX idx_vifm_course_comp_tags_competency ON vifm_course_competency_tags(competency_id);


-- ──────────────────────────────────────────────────────────────
-- Course → ARA pillar tagging (topical axis)
-- ──────────────────────────────────────────────────────────────
-- Maps each course to one or more of the 8 ARA pillars (strategy,
-- data, technology, talent, culture, governance, operations,
-- model_management). Pillar IDs are text, matching the convention
-- used throughout ara_questions etc.

CREATE TABLE vifm_course_pillar_tags (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id         uuid NOT NULL REFERENCES vifm_courses(id) ON DELETE CASCADE,
  pillar_id         text NOT NULL CHECK (pillar_id IN (
    'strategy', 'data', 'technology', 'talent', 'culture',
    'governance', 'operations', 'model_management'
  )),
  relevance_weight  smallint NOT NULL DEFAULT 2 CHECK (relevance_weight IN (1, 2, 3)),
  rationale         text,
  source            text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'ai_proposed', 'ai_accepted')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, pillar_id)
);

CREATE INDEX idx_vifm_course_pillar_tags_course ON vifm_course_pillar_tags(course_id);
CREATE INDEX idx_vifm_course_pillar_tags_pillar ON vifm_course_pillar_tags(pillar_id);


-- ──────────────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────────────
ALTER TABLE vifm_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE vifm_course_competency_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE vifm_course_pillar_tags ENABLE ROW LEVEL SECURITY;

-- Admins get full access on everything
CREATE POLICY vifm_courses_admin_all ON vifm_courses
  FOR ALL USING (auth_role() = 'admin');
CREATE POLICY vifm_course_comp_tags_admin_all ON vifm_course_competency_tags
  FOR ALL USING (auth_role() = 'admin');
CREATE POLICY vifm_course_pillar_tags_admin_all ON vifm_course_pillar_tags
  FOR ALL USING (auth_role() = 'admin');

-- Authenticated read so the recommender can surface course names
-- on the relevant reports/dashboards. We're NOT exposing the
-- `code`/`source_pdf_path`/`extraction_confidence` to non-admins
-- via this policy because the reader-facing UI selects the safe
-- columns explicitly; the table-level read is sufficient since
-- prices / commercial data isn't stored here yet.
CREATE POLICY vifm_courses_authed_read ON vifm_courses
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = true);
CREATE POLICY vifm_course_comp_tags_authed_read ON vifm_course_competency_tags
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY vifm_course_pillar_tags_authed_read ON vifm_course_pillar_tags
  FOR SELECT USING (auth.uid() IS NOT NULL);
