create table if not exists public.manager_profile_badges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  league_id uuid references public.leagues(id) on delete cascade,
  league_member_id uuid references public.league_members(id) on delete set null,
  badge_key text not null,
  badge_name text not null,
  description text,
  awarded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (profile_id, league_id, badge_key)
);

create table if not exists public.league_player_awards (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_member_id uuid references public.league_members(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  award_key text not null,
  award_name text not null,
  position_group text not null,
  total_points numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  awarded_at timestamptz not null default now(),
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id, award_key)
);

create unique index if not exists idx_league_news_items_end_season_recap_unique
on public.league_news_items (league_id, news_type)
where news_type = 'AI_END_SEASON_RECAP';

drop trigger if exists set_manager_profile_badges_updated_date on public.manager_profile_badges;
create trigger set_manager_profile_badges_updated_date
before update on public.manager_profile_badges
for each row execute function public.set_updated_date();

drop trigger if exists set_league_player_awards_updated_date on public.league_player_awards;
create trigger set_league_player_awards_updated_date
before update on public.league_player_awards
for each row execute function public.set_updated_date();

alter table public.manager_profile_badges enable row level security;
alter table public.league_player_awards enable row level security;

drop policy if exists "manager badges publicly readable" on public.manager_profile_badges;
create policy "manager badges publicly readable"
on public.manager_profile_badges for select
to anon, authenticated
using (true);

drop policy if exists "manager badges service managed" on public.manager_profile_badges;
create policy "manager badges service managed"
on public.manager_profile_badges for all
to service_role
using (true)
with check (true);

drop policy if exists "player awards readable by league participants" on public.league_player_awards;
create policy "player awards readable by league participants"
on public.league_player_awards for select
to authenticated
using (
  public.is_league_member(league_id)
  or public.is_commissioner(league_id)
  or public.is_admin()
);

drop policy if exists "player awards service managed" on public.league_player_awards;
create policy "player awards service managed"
on public.league_player_awards for all
to service_role
using (true)
with check (true);

notify pgrst, 'reload schema';
