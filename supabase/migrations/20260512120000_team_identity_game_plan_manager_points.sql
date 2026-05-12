alter table public.lineups
  add column if not exists game_plan_type text not null default 'balanced',
  add column if not exists game_plan jsonb not null default '{"type": "balanced", "details": {}}'::jsonb;

alter table public.lineups
  drop constraint if exists lineups_game_plan_type_check,
  add constraint lineups_game_plan_type_check check (game_plan_type in ('balanced', 'aggressive', 'conservative', 'counter'));

create table if not exists public.league_team_identities (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  season_id uuid references public.league_seasons(id) on delete cascade,
  identity_type text not null,
  identity jsonb not null default '{}'::jsonb,
  selected_at timestamptz not null default now(),
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id, league_member_id, season_id)
);

create table if not exists public.league_game_plans (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  lineup_id uuid references public.lineups(id) on delete set null,
  week_number integer not null,
  game_plan_type text not null default 'balanced' check (game_plan_type in ('balanced', 'aggressive', 'conservative', 'counter')),
  game_plan jsonb not null default '{"type": "balanced", "details": {}}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id, league_member_id, week_number)
);

create table if not exists public.manager_point_skills (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete cascade,
  skill_key text not null,
  label text not null,
  description text,
  point_cost integer not null default 1 check (point_cost >= 0),
  active boolean not null default false,
  timing text not null default 'between_games' check (timing in ('between_games', 'lineup_submission', 'commissioner_grant')),
  metadata jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (league_id, skill_key)
);

create table if not exists public.manager_point_grants (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.manager_point_accounts(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  season_id uuid references public.league_seasons(id) on delete cascade,
  points_delta integer not null check (points_delta > 0),
  grant_type text not null default 'commissioner',
  week_number integer,
  metadata jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now()
);

create index if not exists idx_league_team_identities_league_member
on public.league_team_identities (league_id, league_member_id);

create index if not exists idx_league_game_plans_league_week
on public.league_game_plans (league_id, week_number);

create index if not exists idx_manager_point_skills_league_active
on public.manager_point_skills (league_id, active);

create index if not exists idx_manager_point_grants_league_member
on public.manager_point_grants (league_id, league_member_id);

drop trigger if exists set_league_team_identities_updated_date on public.league_team_identities;
create trigger set_league_team_identities_updated_date
  before update on public.league_team_identities
  for each row execute function public.set_updated_date();

drop trigger if exists set_league_game_plans_updated_date on public.league_game_plans;
create trigger set_league_game_plans_updated_date
  before update on public.league_game_plans
  for each row execute function public.set_updated_date();

drop trigger if exists set_manager_point_skills_updated_date on public.manager_point_skills;
create trigger set_manager_point_skills_updated_date
  before update on public.manager_point_skills
  for each row execute function public.set_updated_date();

alter table public.league_team_identities enable row level security;
alter table public.league_game_plans enable row level security;
alter table public.manager_point_skills enable row level security;
alter table public.manager_point_grants enable row level security;

drop policy if exists "team identities readable by league participants" on public.league_team_identities;
create policy "team identities readable by league participants"
on public.league_team_identities for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

drop policy if exists "members manage their own team identity" on public.league_team_identities;
create policy "members manage their own team identity"
on public.league_team_identities for all
to authenticated
using (
  public.is_admin()
  or public.is_commissioner(league_id)
  or exists (
    select 1 from public.league_members lm
    where lm.id = league_team_identities.league_member_id
      and lm.profile_id = auth.uid()
      and lm.is_active = true
  )
)
with check (
  public.is_admin()
  or public.is_commissioner(league_id)
  or exists (
    select 1 from public.league_members lm
    where lm.id = league_team_identities.league_member_id
      and lm.profile_id = auth.uid()
      and lm.is_active = true
  )
);

drop policy if exists "game plans readable by league participants" on public.league_game_plans;
create policy "game plans readable by league participants"
on public.league_game_plans for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

drop policy if exists "members manage their own game plans" on public.league_game_plans;
create policy "members manage their own game plans"
on public.league_game_plans for all
to authenticated
using (
  public.is_admin()
  or public.is_commissioner(league_id)
  or exists (
    select 1 from public.league_members lm
    where lm.id = league_game_plans.league_member_id
      and lm.profile_id = auth.uid()
      and lm.is_active = true
  )
)
with check (
  public.is_admin()
  or public.is_commissioner(league_id)
  or exists (
    select 1 from public.league_members lm
    where lm.id = league_game_plans.league_member_id
      and lm.profile_id = auth.uid()
      and lm.is_active = true
  )
);

drop policy if exists "manager point skills readable by participants" on public.manager_point_skills;
create policy "manager point skills readable by participants"
on public.manager_point_skills for select
to authenticated
using (league_id is null or public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

drop policy if exists "commissioners manage manager point skills" on public.manager_point_skills;
create policy "commissioners manage manager point skills"
on public.manager_point_skills for all
to authenticated
using (league_id is null and public.is_admin() or league_id is not null and (public.is_commissioner(league_id) or public.is_admin()))
with check (league_id is null and public.is_admin() or league_id is not null and (public.is_commissioner(league_id) or public.is_admin()));

drop policy if exists "manager point grants readable by participants" on public.manager_point_grants;
create policy "manager point grants readable by participants"
on public.manager_point_grants for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

drop policy if exists "commissioners create manager point grants" on public.manager_point_grants;
create policy "commissioners create manager point grants"
on public.manager_point_grants for insert
to authenticated
with check (public.is_commissioner(league_id) or public.is_admin());

insert into public.manager_point_skills (league_id, skill_key, label, description, point_cost, active, timing, metadata)
values
  (null, 'treat_bench_player', 'Treat Bench Player', 'Restore a benched player to full durability during lineup submission.', 1, false, 'lineup_submission', '{}'::jsonb),
  (null, 'player_enhance', 'Player Enhance', 'Placeholder for future production boosts.', 1, false, 'between_games', '{}'::jsonb),
  (null, 'stat_reveal', 'Stat Reveal', 'Placeholder for future information reveal actions.', 1, false, 'between_games', '{}'::jsonb),
  (null, 'bench_productivity', 'Bench Productivity', 'Placeholder for future bench scoring actions.', 1, false, 'between_games', '{}'::jsonb)
on conflict (league_id, skill_key) do nothing;

notify pgrst, 'reload schema';
