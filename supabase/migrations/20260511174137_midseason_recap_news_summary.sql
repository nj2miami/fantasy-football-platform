alter table public.league_news_items
  add column if not exists summary text,
  add column if not exists source_week_number integer;

create unique index if not exists idx_league_news_items_midseason_recap_unique
on public.league_news_items (league_id, news_type, source_week_number)
where news_type = 'AI_MIDSEASON_RECAP' and source_week_number is not null;

notify pgrst, 'reload schema';
