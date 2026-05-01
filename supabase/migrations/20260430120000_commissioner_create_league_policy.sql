create or replace function public.can_create_leagues()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(role) in ('commissioner', 'admin')
  );
$$;

drop policy if exists "authenticated users create leagues" on public.leagues;
drop policy if exists "commissioners and admins create leagues" on public.leagues;
create policy "commissioners and admins create leagues"
on public.leagues for insert
to authenticated
with check (
  public.can_create_leagues()
  and coalesce(commissioner_id, auth.uid()) = auth.uid()
  and coalesce(commissioner_email, public.current_user_email()) = public.current_user_email()
);
