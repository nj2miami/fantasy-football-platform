alter table public.league_week_results
  add column if not exists scoring_details jsonb not null default '[]'::jsonb;

alter table public.leagues
  add column if not exists commissioner_message_of_day text;

create table if not exists public.league_news_items (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  title text not null,
  body text not null default '',
  news_type text not null default 'AI_ARTICLE',
  status text not null default 'PUBLISHED' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  published_at timestamptz not null default now(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create table if not exists public.manager_messages (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  sender_member_id uuid references public.league_members(id) on delete set null,
  recipient_member_id uuid not null references public.league_members(id) on delete cascade,
  subject text not null default 'League Message',
  body text not null default '',
  read_at timestamptz,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now()
);

create index if not exists idx_league_news_items_league_published
on public.league_news_items (league_id, status, published_at desc);

create index if not exists idx_manager_messages_recipient
on public.manager_messages (league_id, recipient_member_id, created_date desc);

drop trigger if exists set_league_news_items_updated_date on public.league_news_items;
create trigger set_league_news_items_updated_date
before update on public.league_news_items
for each row execute function public.set_updated_date();

drop trigger if exists set_manager_messages_updated_date on public.manager_messages;
create trigger set_manager_messages_updated_date
before update on public.manager_messages
for each row execute function public.set_updated_date();

alter table public.league_news_items enable row level security;
alter table public.manager_messages enable row level security;

create policy "league news readable by participants"
on public.league_news_items for select
to authenticated
using (public.is_league_member(league_id) or public.is_commissioner(league_id) or public.is_admin());

create policy "league news managed by commissioners"
on public.league_news_items for all
to authenticated
using (public.is_commissioner(league_id) or public.is_admin())
with check (public.is_commissioner(league_id) or public.is_admin());

create policy "manager messages readable by recipient and commissioners"
on public.manager_messages for select
to authenticated
using (
  public.owns_league_member(recipient_member_id)
  or public.is_commissioner(league_id)
  or public.is_admin()
);

create policy "manager messages writable by commissioners"
on public.manager_messages for all
to authenticated
using (public.is_commissioner(league_id) or public.is_admin())
with check (public.is_commissioner(league_id) or public.is_admin());

create policy "manager messages service managed"
on public.manager_messages for all
to service_role
using (true)
with check (true);
