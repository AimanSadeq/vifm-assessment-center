-- The self lever. 'standalone' = each instrument keeps its own self-rating.
-- 'combined' = behavioral assessment carries self; the 360 self-rater is suppressed.
-- (Renumbered from handover 00081.)
CREATE TYPE engagement_assessment_mode AS ENUM ('standalone', 'combined');

ALTER TABLE engagements
  ADD COLUMN assessment_mode engagement_assessment_mode NOT NULL DEFAULT 'standalone';
