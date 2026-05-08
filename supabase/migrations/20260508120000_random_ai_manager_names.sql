insert into public.ai_team_name_parts (part_type, value)
select 'Random_FirstName', value
from unnest(array[
  'Avery', 'Blake', 'Casey', 'Dakota', 'Emerson', 'Finley', 'Harper', 'Jordan', 'Kendall', 'Logan',
  'Morgan', 'Parker', 'Quinn', 'Reese', 'Riley', 'Rowan', 'Sawyer', 'Skyler', 'Taylor', 'Terry',
  'Alex', 'Bailey', 'Cameron', 'Drew', 'Elliot', 'Hayden', 'Jamie', 'Micah', 'Payton', 'Shawn'
]) as value
on conflict (part_type, value) do nothing;

insert into public.ai_team_name_parts (part_type, value)
select 'Random_LastName', value
from unnest(array[
  'Anderson', 'Bennett', 'Brooks', 'Campbell', 'Carter', 'Collins', 'Cooper', 'Davis', 'Foster', 'Gray',
  'Hayes', 'Henderson', 'Jackson', 'Johnson', 'Kelly', 'Lewis', 'Marshall', 'Miller', 'Morgan', 'Parker',
  'Reed', 'Robinson', 'Russell', 'Simmons', 'Stewart', 'Taylor', 'Thompson', 'Walker', 'Williams', 'Young'
]) as value
on conflict (part_type, value) do nothing;
