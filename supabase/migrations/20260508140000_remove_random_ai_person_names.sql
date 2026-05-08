delete from public.ai_team_name_parts
where part_type in ('Random_FirstName', 'Random_LastName');

delete from public.ai_team_name_parts
where upper(regexp_replace(coalesce(part_type, ''), '[^A-Za-z0-9]+', '_', 'g')) in (
  'RANDOM_FIRSTNAME',
  'RANDOM_FIRST_NAME',
  'RANDOM_LASTNAME',
  'RANDOM_LAST_NAME'
);

notify pgrst, 'reload schema';
