-- Module 4: job_postings v2 columns, dedupe keys, search_configs.
-- Canonical shape from docs/DATA_MODEL.md. Score left null until Module 5.

-- ---------------------------------------------------------------------------
-- job_postings: Agent-1 discovery columns
-- ---------------------------------------------------------------------------
alter table public.job_postings
  add column if not exists source text,
  add column if not exists score numeric,
  add column if not exists score_reasoning jsonb,
  add column if not exists auto_apply_eligible boolean not null default false,
  add column if not exists discovered_at timestamptz,
  -- Source-native stable id (Greenhouse job id, Lever posting id, Ashby id).
  -- Used as dedupe fallback when url is null/unstable.
  add column if not exists external_id text;

alter table public.job_postings
  drop constraint if exists job_postings_source_check;

alter table public.job_postings
  add constraint job_postings_source_check check (
    source is null
    or source in (
      'manual',
      'linkedin',
      'wellfound',
      'greenhouse',
      'lever',
      'ashby',
      'naukri',
      'instahyre',
      'company_page'
    )
  );

-- Primary dedupe: same user + source + url must not duplicate.
-- Partial: only when url is present (manual paste may omit url).
create unique index if not exists job_postings_user_source_url_uidx
  on public.job_postings (user_id, source, url)
  where url is not null and source is not null;

-- Fallback dedupe: same user + source + external_id when url is absent.
create unique index if not exists job_postings_user_source_external_id_uidx
  on public.job_postings (user_id, source, external_id)
  where external_id is not null and source is not null and url is null;

-- Review-queue / New Postings list support (DATA_MODEL.md).
create index if not exists job_postings_user_source_score_idx
  on public.job_postings (user_id, source, score);

create index if not exists job_postings_user_discovered_at_idx
  on public.job_postings (user_id, discovered_at desc nulls last);

-- ---------------------------------------------------------------------------
-- search_configs: editable role/location/experience + board tokens per user
-- ---------------------------------------------------------------------------
create table if not exists public.search_configs (
  user_id text primary key,
  role_keywords text[] not null default '{}'::text[],
  locations text[] not null default '{}'::text[],
  experience_levels text[] not null default '{}'::text[],
  -- Public board tokens / company slugs (no secrets; Job Board APIs are public).
  greenhouse_boards text[] not null default '{}'::text[],
  lever_companies text[] not null default '{}'::text[],
  ashby_boards text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.search_configs enable row level security;

create policy search_configs_deny_anon
  on public.search_configs
  for all
  to anon
  using (false)
  with check (false);

create policy search_configs_deny_authenticated
  on public.search_configs
  for all
  to authenticated
  using (false)
  with check (false);
