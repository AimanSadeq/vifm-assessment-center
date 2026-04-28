-- ARA M6 + AC G7: explicit links from a successor assessment/engagement back
-- to the prior one it was seeded from. All nullable so existing rows are
-- untouched; ON DELETE SET NULL so dropping the prior never blocks deleting
-- the successor's bookkeeping.
--
-- ARA: prior_assessment_id powers the consultant-side breadcrumb on a
-- year-N reassessment ("← Year N-1 baseline"). The existing year-on-year
-- compute in src/lib/ara/year-on-year.ts uses org_id + major version to
-- find the comparison baseline today and continues to work without this
-- column; the column is purely an explicit audit trail + UI link.
--
-- AC: prior_engagement_id + prior_candidate_id power the re-engagement
-- delta UI. consensus_ratings is keyed by candidate_id (per-engagement
-- row), so to show "OAR Δ +0.6 vs prior" we need to know which prior
-- candidate row to compare against. Storing the link on the new
-- candidates row (rather than reusing the old one) keeps RLS, deletes,
-- and per-engagement scoping unchanged.

ALTER TABLE ara_assessments
  ADD COLUMN prior_assessment_id uuid REFERENCES ara_assessments(id) ON DELETE SET NULL;

CREATE INDEX idx_ara_assessments_prior ON ara_assessments(prior_assessment_id)
  WHERE prior_assessment_id IS NOT NULL;

ALTER TABLE engagements
  ADD COLUMN prior_engagement_id uuid REFERENCES engagements(id) ON DELETE SET NULL;

CREATE INDEX idx_engagements_prior ON engagements(prior_engagement_id)
  WHERE prior_engagement_id IS NOT NULL;

ALTER TABLE candidates
  ADD COLUMN prior_candidate_id uuid REFERENCES candidates(id) ON DELETE SET NULL;

CREATE INDEX idx_candidates_prior ON candidates(prior_candidate_id)
  WHERE prior_candidate_id IS NOT NULL;
