insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "commissioners manage league header uploads" on storage.objects;
create policy "commissioners manage league header uploads"
on storage.objects for all
to authenticated
using (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = 'leagues'
  and split_part(name, '/', 3) = 'header'
  and (
    public.is_commissioner((split_part(name, '/', 2))::uuid)
    or public.is_admin()
  )
)
with check (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = 'leagues'
  and split_part(name, '/', 3) = 'header'
  and (
    public.is_commissioner((split_part(name, '/', 2))::uuid)
    or public.is_admin()
  )
);

notify pgrst, 'reload schema';
