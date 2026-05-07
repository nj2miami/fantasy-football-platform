alter table public.leagues
  add column if not exists scoring_overrides_enabled boolean not null default false,
  add column if not exists scoring_rules_locked_at timestamptz,
  add column if not exists scoring_rules_lock_source text,
  add column if not exists scoring_rules_source_updated_at timestamptz,
  add column if not exists scoring_rules_synced_at timestamptz;

alter table public.leagues
  drop constraint if exists leagues_scoring_rules_lock_source_check,
  add constraint leagues_scoring_rules_lock_source_check
  check (scoring_rules_lock_source is null or scoring_rules_lock_source in ('commissioner', 'draft_start'));
