alter table public.leagues
  add column if not exists league_type text not null default 'standard',
  add column if not exists fantasy_points_visibility text not null default 'hidden',
  add column if not exists draft_player_name_visibility text not null default 'shown',
  add column if not exists draft_team_visibility text not null default 'hidden_until_drafted',
  add column if not exists durability_mode text not null default 'hidden_until_drafted',
  add column if not exists manager_points_enabled boolean not null default false,
  add column if not exists manager_point_actions jsonb not null default '{
    "treat_bench_player": { "label": "Treat Bench Player", "active": false, "cost": 1 },
    "player_enhance": { "label": "Player Enhance", "active": false, "cost": 1 },
    "stat_reveal": { "label": "Stat Reveal", "active": false, "cost": 1 },
    "bench_productivity": { "label": "Bench Productivity", "active": false, "cost": 1 }
  }'::jsonb,
  add column if not exists rules_locked_at timestamptz;

alter table public.leagues
  drop constraint if exists leagues_league_type_check,
  add constraint leagues_league_type_check check (league_type in ('standard'));

alter table public.leagues
  drop constraint if exists leagues_fantasy_points_visibility_check,
  add constraint leagues_fantasy_points_visibility_check check (fantasy_points_visibility in ('hidden', 'shown'));

alter table public.leagues
  drop constraint if exists leagues_draft_player_name_visibility_check,
  add constraint leagues_draft_player_name_visibility_check check (draft_player_name_visibility in ('hidden_until_drafted', 'shown'));

alter table public.leagues
  drop constraint if exists leagues_draft_team_visibility_check,
  add constraint leagues_draft_team_visibility_check check (draft_team_visibility in ('hidden_until_drafted', 'shown'));

alter table public.leagues
  drop constraint if exists leagues_durability_mode_check,
  add constraint leagues_durability_mode_check check (durability_mode in ('off', 'revealed_at_draft', 'hidden_until_drafted'));

update public.leagues
set
  league_type = 'standard',
  fantasy_points_visibility = 'hidden',
  draft_player_name_visibility = coalesce(nullif(draft_player_name_visibility, ''), 'shown'),
  draft_team_visibility = coalesce(nullif(draft_team_visibility, ''), 'hidden_until_drafted'),
  durability_mode = coalesce(nullif(durability_mode, ''), 'hidden_until_drafted'),
  manager_points_enabled = coalesce(manager_points_enabled, false),
  manager_points_starting = case when coalesce(manager_points_enabled, false) then greatest(manager_points_starting, 1) else 0 end;

create table if not exists public.league_audit_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  changed_keys text[] not null default '{}',
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  created_date timestamptz not null default now()
);

create table if not exists public.league_audit_feedback (
  id uuid primary key default gen_random_uuid(),
  audit_event_id uuid not null references public.league_audit_events(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  vote text not null check (vote in ('up', 'down')),
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (audit_event_id, profile_id)
);

create index if not exists idx_league_audit_events_league_created
on public.league_audit_events (league_id, created_date desc);

create index if not exists idx_league_audit_feedback_event
on public.league_audit_feedback (audit_event_id);

drop policy if exists "durability readable by league participants" on public.league_player_durability;
create policy "durability readable by league participants"
on public.league_player_durability for select
to authenticated
using (
  (public.is_league_member(league_player_durability.league_id) or public.is_commissioner(league_player_durability.league_id) or public.is_admin())
  and exists (
    select 1
    from public.leagues l
    where l.id = league_player_durability.league_id
      and l.durability_mode <> 'off'
      and (
        l.durability_mode = 'revealed_at_draft'
        or exists (
          select 1
          from public.draft_picks dp
          where dp.league_id = league_player_durability.league_id
            and dp.player_id = league_player_durability.player_id
        )
        or exists (
          select 1
          from public.league_members lm
          join public.roster_slots rs on rs.league_member_id = lm.id
          where lm.league_id = league_player_durability.league_id
            and rs.player_id = league_player_durability.player_id
        )
      )
  )
);

drop trigger if exists set_league_audit_feedback_updated_date on public.league_audit_feedback;
create trigger set_league_audit_feedback_updated_date
  before update on public.league_audit_feedback
  for each row execute function public.set_updated_date();

alter table public.league_audit_events enable row level security;
alter table public.league_audit_feedback enable row level security;

drop policy if exists "league audit events readable by participants" on public.league_audit_events;
create policy "league audit events readable by participants"
on public.league_audit_events for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

drop policy if exists "league audit events service only" on public.league_audit_events;
create policy "league audit events service only"
on public.league_audit_events for all
to service_role
using (true)
with check (true);

drop policy if exists "league audit feedback readable by participants" on public.league_audit_feedback;
create policy "league audit feedback readable by participants"
on public.league_audit_feedback for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

drop policy if exists "league audit feedback writable by own profile" on public.league_audit_feedback;
create policy "league audit feedback writable by own profile"
on public.league_audit_feedback for all
to authenticated
using (profile_id = auth.uid() and public.is_league_member(league_id))
with check (profile_id = auth.uid() and public.is_league_member(league_id));

drop view if exists public.league_player_tier_ranges;
create view public.league_player_tier_ranges
as
select
  league_id,
  position,
  tier_value,
  min(expected_avg_points) as expected_avg_points_min,
  max(expected_avg_points) as expected_avg_points_max,
  min(total_points) as total_points_min,
  max(total_points) as total_points_max,
  count(*)::integer as player_count
from public.league_player_scores
where position_rank <= 30
  and (
    public.is_league_member(league_id)
    or public.is_commissioner(league_id)
    or public.is_admin()
  )
group by league_id, position, tier_value;

grant select on public.league_player_tier_ranges to authenticated;

notify pgrst, 'reload schema';
