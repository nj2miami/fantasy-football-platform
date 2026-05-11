alter table public.league_player_durability
  drop constraint if exists league_player_durability_durability_check,
  drop constraint if exists league_player_durability_initial_durability_check;

alter table public.league_player_durability
  alter column durability type numeric(6, 2) using durability::numeric,
  alter column durability set default 100,
  alter column initial_durability type numeric(6, 2) using initial_durability::numeric,
  alter column initial_durability set default 100;

update public.league_player_durability
set
  durability = 100,
  initial_durability = 100;

alter table public.league_player_durability
  add constraint league_player_durability_durability_check check (durability between 0 and 110),
  add constraint league_player_durability_initial_durability_check check (initial_durability between 0 and 110);

alter table public.league_game_schedule
  add column if not exists game_conditions jsonb not null default '{}'::jsonb,
  add column if not exists durability_loss_percent numeric(6, 2) not null default 0;

alter table public.league_game_schedule
  drop constraint if exists league_game_schedule_durability_loss_percent_check,
  add constraint league_game_schedule_durability_loss_percent_check check (durability_loss_percent between 0 and 100);

notify pgrst, 'reload schema';
