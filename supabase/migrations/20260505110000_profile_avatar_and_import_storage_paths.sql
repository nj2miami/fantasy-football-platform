insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "authenticated users upload own files" on storage.objects;
drop policy if exists "authenticated users update own files" on storage.objects;
drop policy if exists "authenticated users delete own files" on storage.objects;

drop policy if exists "users manage profile avatar uploads" on storage.objects;
create policy "users manage profile avatar uploads"
on storage.objects for all
to authenticated
using (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = 'profiles'
  and split_part(name, '/', 2) = auth.uid()::text
  and split_part(name, '/', 3) = 'avatar'
)
with check (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = 'profiles'
  and split_part(name, '/', 2) = auth.uid()::text
  and split_part(name, '/', 3) = 'avatar'
);

drop policy if exists "admins manage import uploads" on storage.objects;
create policy "admins manage import uploads"
on storage.objects for all
to authenticated
using (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = 'imports'
  and public.is_admin()
)
with check (
  bucket_id = 'uploads'
  and split_part(name, '/', 1) = 'imports'
  and public.is_admin()
);

notify pgrst, 'reload schema';
