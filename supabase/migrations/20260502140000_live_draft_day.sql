alter table public.drafts
  add column if not exists start timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

create table if not exists public.draft_board_items (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  league_member_id uuid not null references public.league_members(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  rank integer not null,
  created_date timestamptz not null default now(),
  updated_date timestamptz,
  unique (draft_id, league_member_id, player_id),
  unique (draft_id, league_member_id, rank)
);

create index if not exists idx_draft_board_items_member_rank
on public.draft_board_items (draft_id, league_member_id, rank);

create unique index if not exists idx_draft_picks_unique_overall
on public.draft_picks (draft_id, overall_pick)
where overall_pick is not null;

create unique index if not exists idx_draft_picks_unique_player
on public.draft_picks (draft_id, player_id);

create unique index if not exists idx_draft_rooms_unique_draft
on public.draft_rooms (draft_id);

drop trigger if exists set_draft_board_items_updated_date on public.draft_board_items;
create trigger set_draft_board_items_updated_date
  before update on public.draft_board_items
  for each row execute function public.set_updated_date();

alter table public.draft_board_items enable row level security;

drop policy if exists "draft boards readable by league participants" on public.draft_board_items;
create policy "draft boards readable by league participants"
on public.draft_board_items for select
to authenticated
using (
  exists (
    select 1
    from public.drafts d
    where d.id = draft_id
      and (public.is_league_member(d.league_id) or public.is_commissioner(d.league_id) or public.is_admin())
  )
);

drop policy if exists "members manage their own draft board" on public.draft_board_items;
create policy "members manage their own draft board"
on public.draft_board_items for all
to authenticated
using (public.owns_league_member(league_member_id) or public.is_admin())
with check (public.owns_league_member(league_member_id) or public.is_admin());
