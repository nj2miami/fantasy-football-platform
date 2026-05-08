insert into storage.buckets (id, name, public)
values ('league-news', 'league-news', false)
on conflict (id) do update set public = excluded.public;

alter table public.league_news_items
  add column if not exists storage_bucket text,
  add column if not exists storage_path text,
  add column if not exists source_draft_id uuid references public.drafts(id) on delete set null,
  add column if not exists generation_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists idx_league_news_items_draft_recap_unique
on public.league_news_items (league_id, source_draft_id, news_type)
where source_draft_id is not null and news_type = 'AI_DRAFT_RECAP';

notify pgrst, 'reload schema';
