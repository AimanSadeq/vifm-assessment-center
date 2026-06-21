-- Fluent voucher: per-voucher camera-proctoring requirement.
--
-- When a voucher is marked proctored, the candidate's test enables camera
-- proctoring server-side (the consent gate + periodic snapshots) for whoever
-- redeems it - no fragile ?proctor=1 URL param that a taker could strip. Off by
-- default, so existing vouchers are unchanged.

alter table public.eng_fluent_vouchers
  add column if not exists proctor_enabled boolean not null default false;
