-- Adds annual-licence (SaaS) pricing mode + section selection + revisions to
-- proposals, and seeds the rate card with the Talent-Intelligence benchmark unit
-- prices. Additive + idempotent: existing per-project proposals are unaffected
-- (pricing_mode defaults to 'per_project'). Code reads/writes these columns
-- tolerantly, so an un-applied migration only disables licence-mode SAVES.

alter table proposals
  add column if not exists pricing_mode      text  not null default 'per_project'
    check (pricing_mode in ('per_project','licence')),
  add column if not exists licensing_model   jsonb,          -- normalized LicenceModelInput snapshot
  add column if not exists section_selection jsonb,          -- included section keys (null = all)
  add column if not exists revision_of_id    uuid references proposals(id),
  add column if not exists licence_data      jsonb not null default '{}'::jsonb; -- lifecycle: renewal notices etc.

create index if not exists proposals_revision_idx on proposals(revision_of_id);

-- Seed the rate card with the TI benchmark unit prices (planning anchors, still
-- editable per deal on /admin/proposals/rates). Overwrites the current flat test
-- rates so licence build-ups price realistically ($30-$6,000 range) out of the box.
update proposal_rates set unit_rate = 60,   updated_at = now() where service_key = 'prehire';
update proposal_rates set unit_rate = 30,   updated_at = now() where service_key = 'logica';
update proposal_rates set unit_rate = 30,   updated_at = now() where service_key = 'persona';
update proposal_rates set unit_rate = 90,   updated_at = now() where service_key = 'techno';
update proposal_rates set unit_rate = 40,   updated_at = now() where service_key = 'fluent';
update proposal_rates set unit_rate = 6000, updated_at = now() where service_key = 'arc';
update proposal_rates set unit_rate = 180,  updated_at = now() where service_key = 'reflect';
