alter table public.league_player_durability
  drop constraint if exists league_player_durability_durability_check,
  drop constraint if exists league_player_durability_initial_durability_check;

alter table public.league_player_durability
  alter column durability set default 100,
  alter column initial_durability set default 100;

update public.league_player_durability
set
  durability = 100,
  initial_durability = 100;

alter table public.league_player_durability
  add constraint league_player_durability_durability_check check (durability between 0 and 110),
  add constraint league_player_durability_initial_durability_check check (initial_durability between 0 and 110);

notify pgrst, 'reload schema';
