alter table public.leagues
  add column if not exists team_tier_cap integer not null default 25,
  add column if not exists manager_points_starting integer not null default 0;

create table if not exists public.player_position_tiers (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players(id) on delete cascade,
  season_year integer not null,
  position text not null,
  position_rank integer not null,
  tier_value integer not null check (tier_value between 1 and 5),
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (player_id, season_year)
);

create table if not exists public.league_player_durability (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  durability integer not null check (durability between -3 and 3),
  initial_durability integer not null check (initial_durability between 0 and 3),
  revealed_at timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id, player_id)
);

create table if not exists public.manager_point_accounts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  season_id uuid references public.league_seasons(id) on delete cascade,
  starting_points integer not null default 0,
  current_points integer not null default 0,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id, league_member_id, season_id)
);

create table if not exists public.manager_point_transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.manager_point_accounts(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  points_delta integer not null,
  action_key text not null,
  target_player_id uuid references public.players(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now()
);

create index if not exists idx_player_position_tiers_season_position_rank
on public.player_position_tiers (season_year, position, position_rank);

create index if not exists idx_league_player_durability_league_player
on public.league_player_durability (league_id, player_id);

create index if not exists idx_manager_point_accounts_league_member
on public.manager_point_accounts (league_id, league_member_id);

create or replace function public.refresh_player_position_tiers(p_season_year integer)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.player_position_tiers (player_id, season_year, position, position_rank, tier_value)
  select
    ranked.id,
    ranked.source_season_year,
    ranked.position,
    ranked.position_rank,
    case
      when ranked.position_rank <= 6 then 5
      when ranked.position_rank <= 12 then 4
      when ranked.position_rank <= 18 then 3
      when ranked.position_rank <= 24 then 2
      else 1
    end as tier_value
  from (
    select
      p.id,
      p.source_season_year,
      p.position,
      row_number() over (
        partition by p.source_season_year, p.position
        order by coalesce(p.avg_points, 0) desc, coalesce(p.total_points, 0) desc, p.full_name asc
      ) as position_rank
    from public.players p
    where p.source_season_year = p_season_year
  ) ranked
  on conflict (player_id, season_year)
  do update set
    position = excluded.position,
    position_rank = excluded.position_rank,
    tier_value = excluded.tier_value,
    updated_date = now();
$$;

insert into public.player_position_tiers (player_id, season_year, position, position_rank, tier_value)
select
  ranked.id,
  ranked.source_season_year,
  ranked.position,
  ranked.position_rank,
  case
    when ranked.position_rank <= 6 then 5
    when ranked.position_rank <= 12 then 4
    when ranked.position_rank <= 18 then 3
    when ranked.position_rank <= 24 then 2
    else 1
  end
from (
  select
    p.id,
    p.source_season_year,
    p.position,
    row_number() over (
      partition by p.source_season_year, p.position
      order by coalesce(p.avg_points, 0) desc, coalesce(p.total_points, 0) desc, p.full_name asc
    ) as position_rank
  from public.players p
) ranked
on conflict (player_id, season_year) do nothing;

drop trigger if exists set_player_position_tiers_updated_date on public.player_position_tiers;
create trigger set_player_position_tiers_updated_date
  before update on public.player_position_tiers
  for each row execute function public.set_updated_date();

drop trigger if exists set_league_player_durability_updated_date on public.league_player_durability;
create trigger set_league_player_durability_updated_date
  before update on public.league_player_durability
  for each row execute function public.set_updated_date();

drop trigger if exists set_manager_point_accounts_updated_date on public.manager_point_accounts;
create trigger set_manager_point_accounts_updated_date
  before update on public.manager_point_accounts
  for each row execute function public.set_updated_date();

alter table public.player_position_tiers enable row level security;
alter table public.league_player_durability enable row level security;
alter table public.manager_point_accounts enable row level security;
alter table public.manager_point_transactions enable row level security;

drop policy if exists "player tiers readable by everyone" on public.player_position_tiers;
create policy "player tiers readable by everyone"
on public.player_position_tiers for select
to anon, authenticated
using (true);

drop policy if exists "durability readable by league participants" on public.league_player_durability;
create policy "durability readable by league participants"
on public.league_player_durability for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

drop policy if exists "manager point accounts readable by participants" on public.manager_point_accounts;
create policy "manager point accounts readable by participants"
on public.manager_point_accounts for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

drop policy if exists "manager point transactions readable by participants" on public.manager_point_transactions;
create policy "manager point transactions readable by participants"
on public.manager_point_transactions for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

notify pgrst, 'reload schema';
