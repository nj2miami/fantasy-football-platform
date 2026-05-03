alter table public.draft_board_items
  add column if not exists league_id uuid references public.leagues(id) on delete cascade;

update public.draft_board_items dbi
set league_id = d.league_id
from public.drafts d
where dbi.draft_id = d.id
  and dbi.league_id is null;

alter table public.draft_board_items
  alter column draft_id drop not null,
  alter column league_id set not null;

delete from public.draft_board_items dbi
using (
  select
    id,
    row_number() over (
      partition by league_id, league_member_id, player_id
      order by created_date, id
    ) as duplicate_number
  from public.draft_board_items
) duplicates
where dbi.id = duplicates.id
  and duplicates.duplicate_number > 1;

create index if not exists idx_draft_board_items_league_member_rank
on public.draft_board_items (league_id, league_member_id, rank);

create unique index if not exists idx_draft_board_items_unique_league_player
on public.draft_board_items (league_id, league_member_id, player_id);

drop policy if exists "draft boards readable by league participants" on public.draft_board_items;
create policy "draft boards readable by league participants"
on public.draft_board_items for select
to authenticated
using (
  public.is_league_member(league_id)
  or public.is_commissioner(league_id)
  or public.is_admin()
);

drop policy if exists "members manage their own draft board" on public.draft_board_items;
create policy "members manage their own draft board"
on public.draft_board_items for all
to authenticated
using (
  public.owns_league_member(league_member_id)
  and public.member_league_id(league_member_id) = league_id
)
with check (
  public.owns_league_member(league_member_id)
  and public.member_league_id(league_member_id) = league_id
);

notify pgrst, 'reload schema';
