create table if not exists public.manager_player_source_week_locks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  segment text not null check (segment in ('regular_1_4', 'regular_5_8', 'playoffs')),
  source_week integer not null,
  locked_by_week integer not null,
  lock_reason text not null check (lock_reason in ('win_lower', 'loss_higher', 'tie_lower')),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  unique (league_id, league_member_id, player_id, segment, source_week)
);

create index if not exists manager_player_source_week_locks_lookup_idx
on public.manager_player_source_week_locks (league_id, segment, league_member_id, player_id);

drop trigger if exists set_manager_player_source_week_locks_updated_date on public.manager_player_source_week_locks;
create trigger set_manager_player_source_week_locks_updated_date
before update on public.manager_player_source_week_locks
for each row execute function public.set_updated_date();

alter table public.manager_player_source_week_locks enable row level security;

create policy "source week locks readable by league participants"
on public.manager_player_source_week_locks for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

create policy "source week locks service managed"
on public.manager_player_source_week_locks for all
to service_role
using (true)
with check (true);
