alter table public.leagues
  add column if not exists join_fee_cents integer not null default 0,
  add column if not exists join_fee_currency text not null default 'usd';

update public.leagues
set join_fee_cents = 500,
    join_fee_currency = 'usd'
where league_tier = 'PAID'
  and join_fee_cents < 500;

update public.leagues
set join_fee_cents = 0,
    join_fee_currency = 'usd'
where league_tier = 'FREE';

alter table public.leagues
  drop constraint if exists leagues_join_fee_tier_check;

alter table public.leagues
  add constraint leagues_join_fee_tier_check
  check (
    (league_tier = 'FREE' and join_fee_cents = 0)
    or
    (league_tier = 'PAID' and join_fee_cents >= 500 and join_fee_currency = 'usd')
  );

insert into public.site_settings (key, value, description)
values (
  'PAID_LEAGUE_JOIN_FEE_MAX_CENTS',
  '5000'::jsonb,
  'Maximum paid league join fee in cents. Defaults to $50.'
)
on conflict (key) do nothing;
