alter table public.league_draft_pool_jobs
  add column if not exists scoring_rules_snapshot jsonb,
  add column if not exists scoring_rules_source_updated_at timestamptz;
