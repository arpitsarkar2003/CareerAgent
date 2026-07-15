-- Switch embedding dimension 1536 → 1024 for Cloudflare Workers AI
-- (@cf/baai/bge-large-en-v1.5). Existing vectors are incompatible — truncate.

truncate table public.knowledge_chunks;

drop index if exists public.knowledge_chunks_embedding_hnsw_idx;

alter table public.knowledge_chunks
  drop column embedding;

alter table public.knowledge_chunks
  add column embedding extensions.vector(1024) not null;

create index knowledge_chunks_embedding_hnsw_idx
  on public.knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

-- Recreate replace RPC with 1024-dim cast
create or replace function public.replace_knowledge_source(
  p_user_id text,
  p_source_type text,
  p_source_name text,
  p_chunks jsonb
)
returns setof public.knowledge_chunks
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  chunk jsonb;
  inserted public.knowledge_chunks;
begin
  if p_user_id is null or length(trim(p_user_id)) = 0 then
    raise exception 'p_user_id is required';
  end if;
  if p_source_type not in ('resume', 'cover_letter', 'project', 'note') then
    raise exception 'invalid p_source_type';
  end if;
  if p_source_name is null or length(trim(p_source_name)) = 0 then
    raise exception 'p_source_name is required';
  end if;
  if p_chunks is null or jsonb_typeof(p_chunks) <> 'array' then
    raise exception 'p_chunks must be a jsonb array';
  end if;

  delete from public.knowledge_chunks
  where user_id = p_user_id
    and source_type = p_source_type
    and source_name = p_source_name;

  for chunk in select * from jsonb_array_elements(p_chunks)
  loop
    insert into public.knowledge_chunks (
      user_id,
      source_type,
      source_name,
      content,
      embedding,
      metadata
    )
    values (
      p_user_id,
      p_source_type,
      p_source_name,
      chunk->>'content',
      (chunk->'embedding')::text::extensions.vector(1024),
      coalesce(chunk->'metadata', '{}'::jsonb)
    )
    returning * into inserted;

    return next inserted;
  end loop;

  return;
end;
$$;

revoke all on function public.replace_knowledge_source(text, text, text, jsonb) from public;
grant execute on function public.replace_knowledge_source(text, text, text, jsonb) to service_role;
