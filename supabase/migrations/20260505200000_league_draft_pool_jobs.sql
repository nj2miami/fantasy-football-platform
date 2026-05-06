create table if not exists public.league_draft_pool_jobs (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  status text not null default 'PENDING',
  progress integer not null default 0,
  processed_players integer not null default 0,
  total_players integer not null default 0,
  scoring_rules_hash text,
  error_details text,
  summary text,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id)
);

create table if not exists public.league_draft_pool_candidates (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  source_season_year integer not null,
  position text not null,
  total_points numeric not null default 0,
  expected_avg_points numeric not null default 0,
  weeks_played integer not null default 0,
  scoring_rules_hash text not null,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id, player_id)
);

create index if not exists idx_league_draft_pool_jobs_league_status
on public.league_draft_pool_jobs (league_id, status);

create index if not exists idx_league_draft_pool_candidates_league_position
on public.league_draft_pool_candidates (league_id, position, total_points desc);

drop trigger if exists set_league_draft_pool_jobs_updated_date on public.league_draft_pool_jobs;
create trigger set_league_draft_pool_jobs_updated_date
  before update on public.league_draft_pool_jobs
  for each row execute function public.set_updated_date();

drop trigger if exists set_league_draft_pool_candidates_updated_date on public.league_draft_pool_candidates;
create trigger set_league_draft_pool_candidates_updated_date
  before update on public.league_draft_pool_candidates
  for each row execute function public.set_updated_date();

alter table public.league_draft_pool_jobs enable row level security;
alter table public.league_draft_pool_candidates enable row level security;

drop policy if exists "draft pool jobs readable by league participants" on public.league_draft_pool_jobs;
create policy "draft pool jobs readable by league participants"
on public.league_draft_pool_jobs for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

drop policy if exists "draft pool jobs service managed" on public.league_draft_pool_jobs;
create policy "draft pool jobs service managed"
on public.league_draft_pool_jobs for all
to service_role
using (true)
with check (true);

drop policy if exists "draft pool candidates service managed" on public.league_draft_pool_candidates;
create policy "draft pool candidates service managed"
on public.league_draft_pool_candidates for all
to service_role
using (true)
with check (true);
