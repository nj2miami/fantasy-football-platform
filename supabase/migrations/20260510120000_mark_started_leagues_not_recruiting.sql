update public.leagues as league
set
  league_status = 'DRAFTING',
  updated_date = now()
where coalesce(upper(league.league_status), 'RECRUITING') = 'RECRUITING'
  and exists (
    select 1
    from public.drafts as draft
    where draft.league_id = league.id
      and upper(draft.status) in ('OPEN', 'COMPLETED')
  );

update public.leagues as league
set
  league_status = 'ACTIVE',
  updated_date = now()
where coalesce(upper(league.league_status), 'RECRUITING') in ('RECRUITING', 'DRAFTING')
  and exists (
    select 1
    from public.league_seasons as season
    where season.league_id = league.id
      and upper(season.status) in ('ACTIVE', 'PLAYOFFS', 'COMPLETED')
  );
