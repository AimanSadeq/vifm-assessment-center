-- ============================================================
-- VIFM ARA (AI Readiness Assessment) — Enums & Role
-- Migration 00006: Add consultant role + ARA-specific enums
--
-- Non-breaking: only adds new enum values and new enum types.
-- No existing tables, policies, or columns are modified.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Add 'consultant' to the existing user_role enum
-- ────────────────────────────────────────────────────────────
-- ALTER TYPE ... ADD VALUE is safe and non-breaking. Existing
-- rows keep their current role. New role becomes available for
-- ARA-module users.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'consultant';


-- ────────────────────────────────────────────────────────────
-- ARA-specific enums (prefixed to avoid any future collision)
-- ────────────────────────────────────────────────────────────

CREATE TYPE ara_region AS ENUM ('uae', 'saudi');

CREATE TYPE ara_sector AS ENUM ('government', 'banking', 'general');

CREATE TYPE ara_language AS ENUM ('en', 'ar');

CREATE TYPE ara_report_language AS ENUM ('en', 'ar', 'bilingual');

CREATE TYPE ara_assessment_status AS ENUM (
  'draft',
  'active',
  'completed',
  'frozen',
  'archived'
);

CREATE TYPE ara_assessment_phase AS ENUM (
  'phase1',
  'phase2',
  'report'
);

CREATE TYPE ara_question_type AS ENUM (
  'rating',
  'multiple_choice',
  'yes_no',
  'open_text'
);

CREATE TYPE ara_material_type AS ENUM (
  'url',
  'word',
  'pdf',
  'powerpoint'
);

CREATE TYPE ara_framework_category AS ENUM (
  'ai_governance',
  'data_privacy',
  'cybersecurity',
  'strategy',
  'ethics',
  'transparency'
);

CREATE TYPE ara_severity AS ENUM (
  'mandatory',
  'recommended',
  'advisory'
);

CREATE TYPE ara_compliance_status AS ENUM (
  'met',
  'partial',
  'not_met',
  'unknown'
);

CREATE TYPE ara_document_processing_status AS ENUM (
  'pending',
  'processing',
  'review',
  'approved',
  'rejected'
);
