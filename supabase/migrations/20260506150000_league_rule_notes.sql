alter table public.leagues
  add column if not exists commissioner_message_of_day text,
  add column if not exists league_rule_notes jsonb not null default '{}'::jsonb;
