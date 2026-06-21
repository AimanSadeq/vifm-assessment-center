-- Camera proctoring (Phase 1): consented webcam snapshots during a test + an
-- admin proctoring report. Per-administration (OFF by default); 90-day
-- retention with a scheduled purge. Generic across contexts (fluent / prehire)
-- via (context, ref_id). All writes go through service-role API routes (the
-- taker has no account); admin-only reads.

create table if not exists public.proctor_sessions (
  id uuid primary key default gen_random_uuid(),
  context text not null,                       -- 'fluent' | 'prehire' | ...
  ref_id text,                                 -- administration ref (fluent session id, prehire candidate id, ...)
  candidate_id uuid,                           -- optional link to a candidate record
  subject_name text,                           -- denormalized for the report
  subject_email text,
  consent_at timestamptz,                      -- when the taker consented to camera proctoring
  consent_text text,                           -- exact consent copy shown (audit)
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  snapshot_count integer not null default 0,
  status text not null default 'active',       -- 'active' | 'ended'
  expires_at timestamptz not null default (now() + interval '90 days'),  -- 90-day retention
  created_at timestamptz not null default now()
);

create table if not exists public.proctor_snapshots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.proctor_sessions(id) on delete cascade,
  storage_path text not null,                  -- path in the private 'proctor' bucket
  sequence integer not null default 0,
  captured_at timestamptz not null default now(),
  flags jsonb,                                 -- Phase 2: no-face / multiple-faces / off-screen / movement
  created_at timestamptz not null default now()
);

create index if not exists proctor_snapshots_session_idx on public.proctor_snapshots (session_id, sequence);
create index if not exists proctor_sessions_expiry_idx on public.proctor_sessions (expires_at);
create index if not exists proctor_sessions_context_idx on public.proctor_sessions (context, ref_id);

alter table public.proctor_sessions enable row level security;
alter table public.proctor_snapshots enable row level security;

-- Admin-only reads; all writes via service-role API routes.
create policy proctor_sessions_admin_all on public.proctor_sessions
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');
create policy proctor_snapshots_admin_all on public.proctor_snapshots
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

-- Private bucket for snapshot images (service-role uploads; signed URLs for the
-- admin report). Never public.
insert into storage.buckets (id, name, public)
  values ('proctor', 'proctor', false)
  on conflict (id) do nothing;
