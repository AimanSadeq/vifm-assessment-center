-- Partner English-language course catalogue (pluggable recommendation source).
--
-- Holds curated English / communication development programmes from training
-- partners (e.g. SE Training Academy) so they can appear on the Fluent English
-- placement report's recommendations alongside VIFM's own catalogue. The source
-- stays dark (empty) until a partner's course list is added, so nothing changes
-- on the report until a row exists. Admin-managed; the recommender reads it via
-- the service client (server-side only).

create table if not exists public.partner_courses (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'se_academy',          -- 'se_academy' | 'vifm' | future partners
  provider_label text,                                   -- display name, e.g. 'SE Training Academy'
  code text,
  title_en text not null,
  title_ar text,
  description_en text,
  description_ar text,
  -- Which CEFR bands the course suits, e.g. {A2,B1,B2}. Empty array = suits all levels.
  cefr_levels text[] not null default '{}',
  -- Optional skill focus so a recommendation can target the candidate's weakest skill.
  focus_skill text check (focus_skill is null or focus_skill in ('reading','listening','writing','speaking','general')),
  url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_courses_active_idx on public.partner_courses (is_active, provider);

alter table public.partner_courses enable row level security;

-- Admin manages the catalogue; the recommender reads via the service client.
drop policy if exists partner_courses_admin_all on public.partner_courses;
create policy partner_courses_admin_all on public.partner_courses
  FOR ALL USING (auth_role() = 'admin') WITH CHECK (auth_role() = 'admin');

-- Keep updated_at fresh on edit (shared trigger function).
drop trigger if exists partner_courses_set_updated_at on public.partner_courses;
create trigger partner_courses_set_updated_at
  before update on public.partner_courses
  for each row execute function update_updated_at();
