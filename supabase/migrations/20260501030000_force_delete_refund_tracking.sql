alter table public.leagues
  add column if not exists refund_status text,
  add column if not exists refund_required_at timestamptz,
  add column if not exists refund_reason text;

alter table public.leagues
  drop constraint if exists leagues_refund_status_check;

alter table public.leagues
  add constraint leagues_refund_status_check
  check (refund_status is null or refund_status in ('PENDING', 'COMPLETED', 'NOT_REQUIRED'));
