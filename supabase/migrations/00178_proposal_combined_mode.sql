-- Adds the 'combined' pricing mode: one proposal can hold per-seat services or an
-- annual licence PLUS one or more consultant engagements, itemised together with a
-- single combined total. No new columns - scope / licensing_model / engagement_model
-- already coexist on the row; this only widens the pricing_mode CHECK. Additive +
-- idempotent. Code writes/reads combined tolerantly, so an un-applied migration only
-- means combined-mode SAVES fail loud (existing modes are unaffected).

alter table proposals drop constraint if exists proposals_pricing_mode_check;
alter table proposals
  add constraint proposals_pricing_mode_check
  check (pricing_mode in ('per_project', 'licence', 'engagement', 'combined'));
