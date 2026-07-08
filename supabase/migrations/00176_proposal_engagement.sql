-- Adds the third pricing mode 'engagement' (bespoke professional-services quote,
-- e.g. Assessment Center: design + per-participant + assessor-days + per-delegate
-- feedback + cohort report) and its snapshot column. Additive + idempotent.
-- Code reads/writes engagement_model tolerantly, so an un-applied migration only
-- disables engagement-mode SAVES (existing per-project / licence proposals are
-- unaffected).

alter table proposals drop constraint if exists proposals_pricing_mode_check;
alter table proposals
  add constraint proposals_pricing_mode_check
  check (pricing_mode in ('per_project', 'licence', 'engagement'));

alter table proposals
  add column if not exists engagement_model jsonb; -- normalized EngagementModelInput snapshot
