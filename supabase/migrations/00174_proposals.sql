-- Proposal generator: a per-service rate card + proposal records.
--
-- A talent-intelligence proposal is auto-assembled from a selected Bespoke bundle
-- (or a manual service pick) + a headcount per service; pricing derives from
-- seats x a per-service per-seat rate held in proposal_rates. The proposal stores
-- a SNAPSHOT of the scope + computed line items so a later rate change can't
-- retro-alter an issued proposal. Client views the issued PDF via an unguessable
-- access_token (no account), mirroring the course-quote / prehire token model.

-- ── Rate card: one per-seat rate per service (set once, editable) ──
create table if not exists proposal_rates (
  service_key text primary key,
  unit_rate   numeric(12,2) not null default 0,
  currency    text not null default 'USD',
  label       text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);
alter table proposal_rates enable row level security;
do $$ begin
  create policy proposal_rates_admin_all on proposal_rates
    for all using (auth_role() = 'admin') with check (auth_role() = 'admin');
exception when duplicate_object then null; end $$;

insert into proposal_rates (service_key, unit_rate, currency, label) values
  ('fluent',  0, 'USD', 'Fluent'),
  ('logica',  0, 'USD', 'Logica'),
  ('persona', 0, 'USD', 'Persona'),
  ('techno',  0, 'USD', 'Techno'),
  ('prehire', 0, 'USD', 'Pre-Hire'),
  ('arc',     0, 'USD', 'AI Readiness'),
  ('reflect', 0, 'USD', 'Reflect 360')
on conflict (service_key) do nothing;

-- ── Proposals ──
create table if not exists proposals (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  organization_id     uuid,                 -- organizations.id (AC/Pre-Hire store)
  ara_organization_id uuid,                 -- ara_organizations.id (ARA/Reflect store)
  bundle_id           uuid,                 -- bespoke_services.id it was assembled from (nullable)
  client_name         text not null,
  client_region       text,
  client_sector       text,
  contact_name        text,
  contact_email       text,
  currency            text not null default 'USD',
  status              text not null default 'draft'
                        check (status in ('draft','issued','won','lost')),
  -- Snapshot of what was proposed + the computed commercials (immutable once issued):
  scope               jsonb not null default '[]'::jsonb,  -- [{service,label,seats,scopeNote,methodologySlug}]
  line_items          jsonb not null default '[]'::jsonb,  -- [{service,label,seats,unitRate,subtotal}]
  subtotal            numeric(12,2) not null default 0,
  discount_pct        numeric(5,2)  not null default 0,
  total               numeric(12,2) not null default 0,
  valid_until         date,
  intro_note          text,
  terms               text,
  payment_terms       text,
  access_token        uuid not null unique default gen_random_uuid(),
  created_by          uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  issued_at           timestamptz,
  sent_at             timestamptz,
  sent_to             text
);
alter table proposals enable row level security;
-- Admin-only through RLS; the client token view reads via the service-role route
-- (no public SELECT policy - the unguessable token + handler gating protect it).
do $$ begin
  create policy proposals_admin_all on proposals
    for all using (auth_role() = 'admin') with check (auth_role() = 'admin');
exception when duplicate_object then null; end $$;

create index if not exists proposals_org_idx    on proposals(organization_id);
create index if not exists proposals_status_idx on proposals(status);
create index if not exists proposals_created_idx on proposals(created_at desc);
