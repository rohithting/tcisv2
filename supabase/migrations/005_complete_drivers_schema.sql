-- Complete Drivers & Values Schema Migration
-- This adds missing tables and updates existing ones to match PRD requirements

-- 1. Add missing driver_instances table
create table if not exists driver_instances (
  id uuid primary key default gen_random_uuid(),
  driver_id integer not null references drivers(id) on delete cascade,
  title text not null,          -- short name: "Respecting Grief Over Celebration"
  narrative text not null,      -- the story (3–6 sentences)
  takeaway text not null,       -- 1–2 line lesson
  tags text[],                  -- optional, e.g., ['culture','decision']
  created_at timestamptz not null default now()
);

-- 2. Update queries table to match PRD schema
alter table queries 
add column if not exists question text,
add column if not exists answer text,
add column if not exists citations_json jsonb default '[]',
add column if not exists evaluation_json jsonb,
add column if not exists filters_json jsonb default '{}',
add column if not exists evaluation_mode boolean default false,
add column if not exists subject_user text,
add column if not exists latency_ms integer;

-- 3. Update drivers table to match PRD schema
alter table drivers 
add column if not exists key text unique,
add column if not exists client_id integer references clients(id) on delete cascade,
add column if not exists negative_indicators text[];

-- 4. Update driver_behaviors table to match PRD schema
alter table driver_behaviors 
add column if not exists positive_examples text[],
add column if not exists negative_examples text[];

-- 5. Update evaluation_policies table to match PRD schema
alter table evaluation_policies 
add column if not exists client_id integer references clients(id) on delete cascade,
add column if not exists guidance text,
add column if not exists min_evidence_items integer default 3,
add column if not exists require_citations boolean default true,
add column if not exists scale_min integer default 1,
add column if not exists scale_max integer default 5;

-- 6. Update evaluations table to match PRD schema
alter table evaluations 
add column if not exists conversation_id integer references conversations(id) on delete cascade,
add column if not exists client_id integer references clients(id) on delete cascade,
add column if not exists subject_user text,
add column if not exists mode text,
add column if not exists inputs_json jsonb,
add column if not exists rubric_json jsonb,
add column if not exists result_json jsonb;

-- 7. Add RLS policies for driver_instances
alter table driver_instances enable row level security;

create policy driver_instances_select on driver_instances
for select using (
  exists (
    select 1 from drivers d
    where d.id = driver_id
      and (d.client_id is null or has_client_access(auth.uid(), d.client_id))
  )
);

create policy driver_instances_insert on driver_instances
for insert with check (
  exists (
    select 1 from drivers d
    where d.id = driver_id
      and (d.client_id is null or has_client_access(auth.uid(), d.client_id))
  )
);

create policy driver_instances_update on driver_instances
for update using (
  exists (
    select 1 from drivers d
    where d.id = driver_id
      and (d.client_id is null or has_client_access(auth.uid(), d.client_id))
  )
) with check (
  exists (
    select 1 from drivers d
    where d.id = driver_id
      and (d.client_id is null or has_client_access(auth.uid(), d.client_id))
  )
);

create policy driver_instances_delete on driver_instances
for delete using (
  exists (
    select 1 from drivers d
    where d.id = driver_id
      and (d.client_id is null or has_client_access(auth.uid(), d.client_id))
  )
);

-- 8. Add indexes for performance
create index if not exists idx_driver_instances_driver_id on driver_instances(driver_id);
create index if not exists idx_drivers_key on drivers(key);
create index if not exists idx_drivers_client_id on drivers(client_id);
create index if not exists idx_evaluation_policies_client_id on evaluation_policies(client_id);
create index if not exists idx_evaluations_conversation_id on evaluations(conversation_id);
create index if not exists idx_evaluations_client_id on evaluations(client_id);

-- 9. Seed example driver instance (Empathy story)
insert into driver_instances (driver_id, title, narrative, takeaway, tags)
select d.id,
       'Respecting Grief Over Celebration',
       'Ahead of the annual party, a Tingster passed away. The team unanimously chose to cancel the celebration, showing respect for the grieving family.',
       'Empathy means people > events; honor collective grief.',
       array['culture','decision']
from drivers d
where d.key = 'empathy' or d.name ilike '%empathy%'
limit 1;

-- 10. Update existing drivers with key field if missing
update drivers set key = lower(replace(name, ' ', '_')) where key is null;

-- 11. Add default evaluation policy if none exists
insert into evaluation_policies (name, scale, guidance, min_evidence_items, require_citations, scale_min, scale_max)
select 'Default Evaluation Policy', '1-5', 'Always provide evidence and cite messages. Use only retrieved chat evidence for scoring.', 3, true, 1, 5
where not exists (select 1 from evaluation_policies where name = 'Default Evaluation Policy');

-- 12. Create vector search function for hybrid search
create or replace function match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter jsonb default '{}'
)
returns table (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    chunks.id,
    chunks.content,
    jsonb_build_object(
      'room_id', chunks.room_id,
      'room_name', rooms.name,
      'client_id', chunks.client_id
    ) as metadata,
    1 - (embeddings.embedding <=> query_embedding) as similarity
  from chunks
  left join rooms on chunks.room_id = rooms.id
  left join embeddings on chunks.id = embeddings.chunk_id
  where 1 - (embeddings.embedding <=> query_embedding) > match_threshold
    and (filter->>'client_id' is null or chunks.client_id = (filter->>'client_id')::integer)
  order by embeddings.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- 13. Create secrets table for storing sensitive configuration
create table if not exists secrets (
  id serial primary key,
  key text unique not null,
  value text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS on secrets table
alter table secrets enable row level security;

-- Only super admins can access secrets
create policy "Super admins can manage secrets" on secrets
  for all using (is_super_admin(auth.uid()));

-- Create index on secrets key
create index if not exists idx_secrets_key on secrets(key);

-- 14. Modify embeddings table to support global driver embeddings
alter table embeddings 
add column if not exists content_type text default 'chunk',
add column if not exists content_id integer,
add column if not exists content_text text,
add column if not exists metadata jsonb default '{}';

-- Update embeddings table to allow NULL values for global embeddings
alter table embeddings 
alter column chunk_id drop not null,
alter column room_id drop not null;

-- Add constraint to ensure either chunk_id or content_id is provided
alter table embeddings 
add constraint embeddings_content_check 
check (
  (chunk_id is not null and content_type = 'chunk') or 
  (content_id is not null and content_type != 'chunk')
);
