create or replace function public.set_updated_date()
returns trigger
language plpgsql
as $$
begin
  new := jsonb_populate_record(
    new,
    jsonb_build_object(
      'updated_date', now(),
      'updated_at', now()
    )
  );
  return new;
end;
$$;
