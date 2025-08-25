-- TCIS (Ting Chat Insight System) Complete Database Schema
-- This creates all tables, types, functions, and security policies

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";

-- Custom types
create type platform_role as enum ('super_admin', 'backend', 'admin', 'manager', 'user');
create type user_role as enum ('admin', 'manager', 'user');
create type job_status as enum ('pending', 'processing', 'completed', 'failed', 'cancelled');
create type room_type as enum ('internal', 'external');
create type evaluation_scale as enum ('1-5', '1-10', 'pass_fail', 'custom');

-- Admin Settings Table (for platform configuration)
create table admin_settings (
    id serial primary key,
    platform_name text default 'TCIS',
    platform_logo_url text,
    favicon_url text,
    primary_color text default '#ffe600',
    secondary_color text default '#000000',
    enable_signups boolean default false,
    require_email_verification boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert default settings
insert into admin_settings (platform_name, primary_color, secondary_color, enable_signups, require_email_verification) 
values ('TCIS', '#ffe600', '#000000', false, true);

-- Platform Users Table (extends Supabase auth.users)
create table platform_users (
    id uuid references auth.users(id) on delete cascade primary key,
    email text unique not null,
    full_name text,
    platform_role platform_role default 'user' not null,
    is_active boolean default true,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Clients Table
create table clients (
    id serial primary key,
    name text not null,
    description text,
    logo_url text,
    is_active boolean default true,
    created_by uuid references platform_users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User Client Access Table (for role-based access to specific clients)
create table user_client_access (
    id serial primary key,
    user_id uuid references platform_users(id) on delete cascade,
    client_id integer references clients(id) on delete cascade,
    role user_role not null,
    granted_by uuid references platform_users(id),
    granted_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, client_id)
);

-- Rooms Table (Chat Groups - internal/external)
create table rooms (
    id serial primary key,
    client_id integer references clients(id) on delete cascade not null,
    name text not null,
    description text,
    room_type room_type not null,
    is_active boolean default true,
    created_by uuid references platform_users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Uploads Table
create table uploads (
    id serial primary key,
    client_id integer references clients(id) on delete cascade not null,
    room_id integer references rooms(id) on delete cascade not null,
    filename text not null,
    original_filename text not null,
    file_size bigint not null,
    file_type text not null,
    storage_path text not null,
    uploaded_by uuid references platform_users(id) not null,
    status text default 'uploaded' not null,
    metadata jsonb default '{}',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Jobs Table (for processing uploads)
create table jobs (
    id serial primary key,
    upload_id integer references uploads(id) on delete cascade not null,
    client_id integer references clients(id) on delete cascade not null,
    room_id integer references rooms(id) on delete cascade not null,
    status job_status default 'pending' not null,
    job_type text not null,
    progress integer default 0,
    total_items integer,
    processed_items integer default 0,
    error_message text,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Chunks Table (processed chat segments)
create table chunks (
    id serial primary key,
    client_id integer references clients(id) on delete cascade not null,
    room_id integer references rooms(id) on delete cascade not null,
    upload_id integer references uploads(id) on delete cascade,
    content text not null,
    metadata jsonb default '{}',
    chunk_index integer,
    token_count integer,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Embeddings Table (vector embeddings for chunks)
create table embeddings (
    id serial primary key,
    chunk_id integer references chunks(id) on delete cascade not null,
    client_id integer references clients(id) on delete cascade not null,
    room_id integer references rooms(id) on delete cascade not null,
    embedding vector(1536), -- OpenAI/Vertex AI embedding dimension
    model_name text not null default 'text-embedding-ada-002',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Conversations Table
create table conversations (
    id serial primary key,
    client_id integer references clients(id) on delete cascade not null,
    title text not null,
    description text,
    created_by uuid references platform_users(id) not null,
    is_active boolean default true,
    metadata jsonb default '{}',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Queries Table
create table queries (
    id serial primary key,
    conversation_id integer references conversations(id) on delete cascade not null,
    client_id integer references clients(id) on delete cascade not null,
    query_text text not null,
    response_text text,
    context_chunks jsonb default '[]',
    evaluation_enabled boolean default false,
    processing_time_ms integer,
    created_by uuid references platform_users(id) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Feedback Table
create table feedback (
    id serial primary key,
    query_id integer references queries(id) on delete cascade not null,
    rating integer check (rating >= 1 and rating <= 5),
    feedback_text text,
    is_helpful boolean,
    created_by uuid references platform_users(id) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Drivers Table (evaluation rubrics)
create table drivers (
    id serial primary key,
    name text not null,
    description text,
    criteria text not null,
    weight numeric(3,2) default 1.0,
    is_active boolean default true,
    created_by uuid references platform_users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Driver Behaviors Table (exemplars for drivers)
create table driver_behaviors (
    id serial primary key,
    driver_id integer references drivers(id) on delete cascade not null,
    behavior_text text not null,
    is_positive boolean not null,
    example_text text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Evaluation Policies Table
create table evaluation_policies (
    id serial primary key,
    name text not null,
    scale evaluation_scale not null,
    min_evidence_required integer default 1,
    red_lines text[], -- Array of red line criteria
    is_active boolean default true,
    created_by uuid references platform_users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Evaluations Table (audit log of scored assessments)
create table evaluations (
    id serial primary key,
    query_id integer references queries(id) on delete cascade not null,
    driver_id integer references drivers(id) on delete cascade not null,
    policy_id integer references evaluation_policies(id) on delete cascade not null,
    score numeric(5,2) not null,
    evidence_text text,
    confidence_level numeric(3,2),
    red_line_triggered boolean default false,
    evaluated_by uuid references platform_users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for performance
create index idx_platform_users_user_id on platform_users(id);
create index idx_platform_users_email on platform_users(email);
create index idx_platform_users_platform_role on platform_users(platform_role);
create index idx_user_client_access_user_id on user_client_access(user_id);
create index idx_user_client_access_client_id on user_client_access(client_id);
create index idx_rooms_client_id on rooms(client_id);
create index idx_uploads_client_id on uploads(client_id);
create index idx_uploads_room_id on uploads(room_id);
create index idx_jobs_upload_id on jobs(upload_id);
create index idx_jobs_status on jobs(status);
create index idx_chunks_client_id on chunks(client_id);
create index idx_chunks_room_id on chunks(room_id);
create index idx_embeddings_chunk_id on embeddings(chunk_id);
create index idx_conversations_client_id on conversations(client_id);
create index idx_conversations_created_by on conversations(created_by);
create index idx_queries_conversation_id on queries(conversation_id);
create index idx_queries_client_id on queries(client_id);

-- Vector similarity search index
create index on embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Functions
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into platform_users (id, email, full_name, platform_role)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', 'user');
  return new;
end;
$$ language plpgsql security definer;

-- Get user's platform role
create or replace function get_user_platform_role(user_id uuid)
returns platform_role as $$
declare
  user_platform_role platform_role;
begin
  select platform_role into user_platform_role
  from platform_users
  where id = user_id;
  
  return coalesce(user_platform_role, 'user'::platform_role);
end;
$$ language plpgsql security definer;

-- Check if user is super admin
create or replace function is_super_admin(user_id uuid)
returns boolean as $$
begin
  return get_user_platform_role(user_id) = 'super_admin';
end;
$$ language plpgsql security definer;

-- Check if user has access to client
create or replace function has_client_access(user_id uuid, client_id integer)
returns boolean as $$
declare
  user_platform_role platform_role;
  has_access boolean := false;
begin
  -- Get user's platform role
  select platform_role into user_platform_role
  from platform_users
  where id = user_id;
  
  -- Super admin and backend have access to all clients
  if user_platform_role in ('super_admin', 'backend') then
    return true;
  end if;
  
  -- Check specific client access
  select exists(
    select 1 from user_client_access
    where user_client_access.user_id = has_client_access.user_id
    and user_client_access.client_id = has_client_access.client_id
  ) into has_access;
  
  return has_access;
end;
$$ language plpgsql security definer;

-- Triggers
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
alter table platform_users enable row level security;
alter table clients enable row level security;
alter table user_client_access enable row level security;
alter table rooms enable row level security;
alter table uploads enable row level security;
alter table jobs enable row level security;
alter table chunks enable row level security;
alter table embeddings enable row level security;
alter table conversations enable row level security;
alter table queries enable row level security;
alter table feedback enable row level security;
alter table drivers enable row level security;
alter table driver_behaviors enable row level security;
alter table evaluation_policies enable row level security;
alter table evaluations enable row level security;
alter table admin_settings enable row level security;

-- Platform Users Policies
create policy "Users can view own profile" on platform_users
  for select using (auth.uid() = id);

create policy "Users can update own profile" on platform_users
  for update using (auth.uid() = id);

create policy "Super admins can view all users" on platform_users
  for select using (is_super_admin(auth.uid()));

create policy "Super admins can manage all users" on platform_users
  for all using (is_super_admin(auth.uid()));

-- Clients Policies
create policy "Super admins can manage all clients" on clients
  for all using (is_super_admin(auth.uid()));

create policy "Backend users can view all clients" on clients
  for select using (get_user_platform_role(auth.uid()) = 'backend');

create policy "Backend users can create/update clients" on clients
  for insert with check (get_user_platform_role(auth.uid()) = 'backend');

create policy "Backend users can update clients" on clients
  for update using (get_user_platform_role(auth.uid()) = 'backend');

create policy "Users can view accessible clients" on clients
  for select using (has_client_access(auth.uid(), id));

-- User Client Access Policies
create policy "Super admins can manage all access" on user_client_access
  for all using (is_super_admin(auth.uid()));

create policy "Users can view own access" on user_client_access
  for select using (auth.uid() = user_id);

-- Rooms Policies
create policy "Users can view accessible rooms" on rooms
  for select using (has_client_access(auth.uid(), client_id));

create policy "Admins and managers can manage rooms" on rooms
  for all using (
    has_client_access(auth.uid(), client_id) and
    exists(
      select 1 from user_client_access
      where user_id = auth.uid() and client_id = rooms.client_id
      and role in ('admin', 'manager')
    )
  );

-- Similar policies for other tables...
-- (Adding basic policies for key tables, can be extended)

create policy "Users can view accessible uploads" on uploads
  for select using (has_client_access(auth.uid(), client_id));

create policy "Users can view accessible conversations" on conversations
  for select using (has_client_access(auth.uid(), client_id));

create policy "Users can create conversations for accessible clients" on conversations
  for insert with check (has_client_access(auth.uid(), client_id));

-- Admin Settings Policies
create policy "Everyone can view admin settings" on admin_settings
  for select using (true);

create policy "Super admins can manage admin settings" on admin_settings
  for all using (is_super_admin(auth.uid()));

-- Grant permissions
grant usage on schema public to authenticated, anon;
grant all on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Success message
select 'TCIS database schema created successfully' as status;
