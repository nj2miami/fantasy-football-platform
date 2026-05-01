alter table public.leagues
  add column if not exists league_status text not null default 'RECRUITING',
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists paused_at timestamptz;

create table if not exists public.league_invites (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  code text unique not null,
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz,
  max_uses integer,
  used_count integer not null default 0,
  is_active boolean not null default true,
  created_date timestamptz not null default now(),
  updated_date timestamptz
);

create index if not exists idx_league_invites_league on public.league_invites (league_id);
create index if not exists idx_league_invites_code on public.league_invites (code);
create index if not exists idx_leagues_archived on public.leagues (archived_at);

alter table public.league_invites enable row level security;

create policy "commissioners manage league invites"
on public.league_invites for all
to authenticated
using (public.is_commissioner(league_id) or public.is_admin())
with check (public.is_commissioner(league_id) or public.is_admin());

create policy "active invite codes are redeemable"
on public.league_invites for select
to authenticated
using (is_active = true);

create policy "used ai names inserted by commissioners"
on public.used_ai_team_names for insert
to authenticated
with check (league_id is null or public.is_commissioner(league_id) or public.is_admin());

insert into public.ai_team_name_parts (part_type, value)
select 'FIRST', value
from unnest(array[
  'Blitz', 'Redzone', 'Iron', 'Gridiron', 'Goal Line', 'Fourth Down', 'Two Minute', 'Wildcat', 'Pigskin', 'Audible',
  'Hail Mary', 'End Zone', 'Sideline', 'Playbook', 'Hashmark', 'Sunday', 'Primetime', 'Turbo', 'Smashmouth', 'Nickel',
  'Power', 'Dynasty', 'Rumble', 'Rocket', 'Phantom', 'Thunder', 'Victory', 'Signal', 'Turf', 'Helmet'
]) as value
on conflict (part_type, value) do nothing;

insert into public.ai_team_name_parts (part_type, value)
select 'LAST', value
from unnest(array[
  'Bruisers', 'Blitzers', 'Maulers', 'Crushers', 'Punishers', 'Hit Squad', 'Ball Hawks', 'Sack Masters', 'Chain Movers', 'Playmakers',
  'Road Graders', 'Linebackers', 'Safeties', 'Generals', 'Captains', 'Warriors', 'Gladiators', 'Bombers', 'Rushers', 'Defenders',
  'Marauders', 'Outlaws', 'Renegades', 'Stampede', 'Avalanche', 'Cyclones', 'Firebirds', 'Ironclads', 'Night Shift', 'Endzones'
]) as value
on conflict (part_type, value) do nothing;
