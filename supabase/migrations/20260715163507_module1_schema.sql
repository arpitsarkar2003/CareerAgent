-- Module 1: Career Agent schema
-- Clerk user_id (text). Supabase = Postgres + pgvector only.
-- Elevated API secret bypasses RLS; anon/authenticated denied.

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------------
-- knowledge_chunks
-- ---------------------------------------------------------------------------
create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  source_type text not null,
  source_name text not null,
  content text not null,
  embedding extensions.vector(1536) not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint knowledge_chunks_source_type_check check (
    source_type in ('resume', 'cover_letter', 'project', 'note')
  )
);

create index knowledge_chunks_embedding_hnsw_idx
  on public.knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

-- ---------------------------------------------------------------------------
-- job_postings
-- ---------------------------------------------------------------------------
create table public.job_postings (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  company text not null,
  title text not null,
  url text,
  raw_text text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  job_posting_id uuid not null references public.job_postings (id) on delete restrict,
  status text not null,
  resume_draft text,
  cover_letter text,
  notes text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_status_check check (
    status in ('drafted', 'applied', 'interview', 'rejected', 'offer')
  )
);

create index applications_user_id_status_idx
  on public.applications (user_id, status);

-- ---------------------------------------------------------------------------
-- emails
-- ---------------------------------------------------------------------------
create table public.emails (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  application_id uuid references public.applications (id) on delete set null,
  direction text not null,
  subject text not null,
  body text not null,
  from_address text not null,
  received_at timestamptz,
  created_at timestamptz not null default now(),
  constraint emails_direction_check check (
    direction in ('inbound', 'outbound_draft', 'sent')
  )
);

create index emails_application_id_idx
  on public.emails (application_id);

-- ---------------------------------------------------------------------------
-- RLS: deny anon + authenticated (API uses secret/service_role, bypasses RLS)
-- ---------------------------------------------------------------------------
alter table public.knowledge_chunks enable row level security;
alter table public.job_postings enable row level security;
alter table public.applications enable row level security;
alter table public.emails enable row level security;

create policy knowledge_chunks_deny_anon
  on public.knowledge_chunks
  for all
  to anon
  using (false)
  with check (false);

create policy knowledge_chunks_deny_authenticated
  on public.knowledge_chunks
  for all
  to authenticated
  using (false)
  with check (false);

create policy job_postings_deny_anon
  on public.job_postings
  for all
  to anon
  using (false)
  with check (false);

create policy job_postings_deny_authenticated
  on public.job_postings
  for all
  to authenticated
  using (false)
  with check (false);

create policy applications_deny_anon
  on public.applications
  for all
  to anon
  using (false)
  with check (false);

create policy applications_deny_authenticated
  on public.applications
  for all
  to authenticated
  using (false)
  with check (false);

create policy emails_deny_anon
  on public.emails
  for all
  to anon
  using (false)
  with check (false);

create policy emails_deny_authenticated
  on public.emails
  for all
  to authenticated
  using (false)
  with check (false);
