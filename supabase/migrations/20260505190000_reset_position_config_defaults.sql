insert into public.global_settings (key, value, description)
values (
  'POSITION_CONFIG',
  '[
    {"position":"QB","group":"QB","enabled":true},
    {"position":"OFF","group":"OFFENSE","enabled":true},
    {"position":"RB","group":"OFFENSE","enabled":true},
    {"position":"FB","group":"OFFENSE","enabled":true},
    {"position":"WR","group":"OFFENSE","enabled":true},
    {"position":"TE","group":"OFFENSE","enabled":true},
    {"position":"OL","group":"OFFENSE","enabled":false},
    {"position":"C","group":"OFFENSE","enabled":false},
    {"position":"G","group":"OFFENSE","enabled":false},
    {"position":"OT","group":"OFFENSE","enabled":false},
    {"position":"K","group":"K","enabled":true},
    {"position":"P","group":"OFFENSE","enabled":false},
    {"position":"LS","group":"OFFENSE","enabled":false},
    {"position":"DEF","group":"DEFENSE","enabled":true},
    {"position":"DST","group":"DEFENSE","enabled":true},
    {"position":"D/ST","group":"DEFENSE","enabled":true},
    {"position":"DL","group":"DEFENSE","enabled":true},
    {"position":"DE","group":"DEFENSE","enabled":true},
    {"position":"DT","group":"DEFENSE","enabled":true},
    {"position":"NT","group":"DEFENSE","enabled":true},
    {"position":"LB","group":"DEFENSE","enabled":true},
    {"position":"ILB","group":"DEFENSE","enabled":true},
    {"position":"MLB","group":"DEFENSE","enabled":true},
    {"position":"OLB","group":"DEFENSE","enabled":true},
    {"position":"DB","group":"DEFENSE","enabled":true},
    {"position":"CB","group":"DEFENSE","enabled":true},
    {"position":"S","group":"DEFENSE","enabled":true},
    {"position":"SAF","group":"DEFENSE","enabled":true},
    {"position":"FS","group":"DEFENSE","enabled":true}
  ]'::jsonb,
  'Raw backend player position grouping used by import, scoring, draft eligibility, and roster limits.'
)
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_date = now();
