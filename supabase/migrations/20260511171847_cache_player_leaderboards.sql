create table if not exists public.league_player_leaderboards (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  leaders jsonb not null default '{}'::jsonb,
  generated_through_week integer not null default 0,
  generated_at timestamptz not null default now(),
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

alter table public.league_player_leaderboards enable row level security;

drop policy if exists "player leaderboards readable by visible league" on public.league_player_leaderboards;
create policy "player leaderboards readable by visible league"
on public.league_player_leaderboards for select
to anon, authenticated
using (
  exists (
    select 1
    from public.leagues
    where id = league_player_leaderboards.league_id
      and (
        is_public = true
        or public.is_league_member(id)
        or public.is_commissioner(id)
        or public.is_admin()
      )
  )
);

drop policy if exists "player leaderboards service managed" on public.league_player_leaderboards;
create policy "player leaderboards service managed"
on public.league_player_leaderboards for all
to service_role
using (true)
with check (true);

drop trigger if exists set_league_player_leaderboards_updated_date on public.league_player_leaderboards;
create trigger set_league_player_leaderboards_updated_date
before update on public.league_player_leaderboards
for each row execute function public.set_updated_date();

notify pgrst, 'reload schema';
