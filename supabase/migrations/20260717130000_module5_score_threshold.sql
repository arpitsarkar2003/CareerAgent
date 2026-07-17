-- Module 5: editable score threshold, stored alongside search_configs.
-- Default 80 per docs/modules/05-scoring.md. Below-threshold postings are
-- stored, never deleted — this only controls the default UI filter.

alter table public.search_configs
  add column if not exists score_threshold numeric not null default 80;

alter table public.search_configs
  drop constraint if exists search_configs_score_threshold_check;

alter table public.search_configs
  add constraint search_configs_score_threshold_check check (
    score_threshold >= 0 and score_threshold <= 100
  );
