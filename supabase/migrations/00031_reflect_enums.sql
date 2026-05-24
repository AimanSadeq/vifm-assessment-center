-- ============================================================
-- VIFM Reflect 360 (Leadership Feedback) - Enums
-- Migration 00031: Reflect-specific enums
--
-- Non-breaking: only adds new enum types. The 'consultant'
-- user_role value already exists from 00006 (ARA), so we
-- reuse it without modification.
-- ============================================================

-- Engagement lifecycle
CREATE TYPE reflect_engagement_status AS ENUM (
  'draft',      -- consultant is configuring
  'live',       -- raters can submit
  'scoring',    -- field window closed, scoring + report generation in progress
  'complete',   -- reports released
  'archived'    -- past engagement, read-only
);

-- Rater roles. Self + Manager + Peer + Direct Report cover the
-- standard 360° pool. skip_level and other are optional add-ons.
CREATE TYPE reflect_rater_role AS ENUM (
  'self',
  'manager',
  'peer',
  'direct_report',
  'skip_level',
  'other'
);

-- Leadership-level tiers used both on the participant and on
-- behaviours (so executive variants of a behaviour can be
-- swapped in for the executive tier). 'all' means a single
-- behaviour applies regardless of level.
CREATE TYPE reflect_level_tier AS ENUM (
  'exec',
  'senior_mgr',
  'manager',
  'individual_contributor',
  'all'
);

-- Rating scale shape. We ship one default ('frequency_5pt' =
-- Almost never -> Almost always with N/A option). New shapes
-- can be added later without breaking existing engagements.
CREATE TYPE reflect_scale_type AS ENUM (
  'frequency_5pt'
);

-- Source of a framework instance: a one-off custom framework
-- built for a specific engagement, or a clone of a library
-- template.
CREATE TYPE reflect_framework_source AS ENUM (
  'custom',
  'template'
);

-- Participant lifecycle through the engagement.
CREATE TYPE reflect_participant_status AS ENUM (
  'invited',         -- participant added, raters not yet invited
  'raters_invited',  -- rater invitations sent
  'in_progress',     -- at least one rater has started
  'closed',          -- field window closed for this participant
  'report_released'  -- participant has received their report
);

-- Rater lifecycle.
CREATE TYPE reflect_rater_status AS ENUM (
  'pending',
  'started',
  'completed',
  'declined'
);

-- Lightweight debrief-session tracking. The portal owns the
-- status flag; Outlook owns the actual calendar invitation.
CREATE TYPE reflect_debrief_status AS ENUM (
  'not_scheduled',
  'scheduled',
  'completed',
  'no_show'
);

-- IDP status. 'draft' -> consultant is preparing; 'agreed' ->
-- participant has signed off; lifecycle continues post-debrief.
CREATE TYPE reflect_idp_status AS ENUM (
  'draft',
  'agreed',
  'in_progress',
  'reviewed',
  'closed'
);

-- Source of a behaviour item. 'ai_proposed' = Claude generated
-- it; 'ai_accepted' = consultant approved without rewording;
-- 'manual' = consultant wrote it (either from scratch or after
-- a substantive rewrite of an AI proposal).
CREATE TYPE reflect_behavior_source AS ENUM (
  'manual',
  'ai_proposed',
  'ai_accepted'
);
