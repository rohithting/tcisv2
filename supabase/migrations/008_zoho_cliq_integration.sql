-- Zoho Cliq Integration Schema
-- This migration adds support for Zoho Cliq channel integration

-- First, create the missing is_backend_user function that's needed for RLS policies
CREATE OR REPLACE FUNCTION is_backend_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM platform_users 
        WHERE id = user_id 
        AND platform_role IN ('super_admin', 'backend')
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions on the utility function
GRANT EXECUTE ON FUNCTION is_backend_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_backend_user(UUID) TO anon;

-- Zoho authentication table (system-wide)
create table zoho_auth (
    id serial primary key,
    access_token text not null,
    refresh_token text not null,
    expires_at timestamp with time zone not null,
    scope text not null,
    authenticated_by uuid references platform_users(id) on delete cascade,
    organization_id text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Only one active Zoho auth at a time
create unique index idx_zoho_auth_single on zoho_auth ((1));

-- Zoho channel mappings (which channels are mapped to which clients)
create table zoho_channel_mappings (
    id uuid primary key default gen_random_uuid(),
    client_id integer not null references clients(id) on delete cascade,
    room_id integer not null references rooms(id) on delete cascade,
    
    -- Zoho channel details
    zoho_channel_id text not null,
    zoho_chat_id text not null,
    zoho_channel_name text not null,
    zoho_unique_name text,
    zoho_organization_id text,
    
    -- Sync tracking
    last_sync_at timestamp with time zone,
    last_message_time bigint, -- milliseconds timestamp from Zoho
    sync_status text default 'active' check (sync_status in ('active', 'paused', 'error')),
    sync_error text,
    
    -- Metadata
    created_by uuid not null references platform_users(id),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    
    -- Prevent same channel from being mapped to multiple clients
    unique(zoho_channel_id)
);

-- Sync job tracking
create table zoho_sync_jobs (
    id uuid primary key default gen_random_uuid(),
    mapping_id uuid not null references zoho_channel_mappings(id) on delete cascade,
    
    -- Job details
    job_type text not null check (job_type in ('manual', 'scheduled', 'retry')),
    status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
    
    -- Progress tracking
    messages_fetched integer default 0,
    messages_processed integer default 0,
    from_time bigint, -- milliseconds timestamp
    to_time bigint,   -- milliseconds timestamp
    
    -- Results
    error_message text,
    processing_time_ms integer,
    
    -- Timestamps
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Update rooms table to support Zoho mapping
alter table rooms 
add column zoho_mapping_id uuid references zoho_channel_mappings(id) on delete set null;

-- Add index for efficient queries
create index idx_zoho_channel_mappings_client on zoho_channel_mappings(client_id);
create index idx_zoho_channel_mappings_room on zoho_channel_mappings(room_id);
create index idx_zoho_channel_mappings_sync_status on zoho_channel_mappings(sync_status);
create index idx_zoho_sync_jobs_mapping on zoho_sync_jobs(mapping_id);
create index idx_zoho_sync_jobs_status on zoho_sync_jobs(status);
create index idx_zoho_sync_jobs_created on zoho_sync_jobs(created_at);

-- RLS Policies

-- Zoho auth - only super admins can manage
create policy "Super admins can manage zoho auth" on zoho_auth
  for all using (is_super_admin(auth.uid()));

-- Zoho channel mappings - admins with client access can manage
create policy "Platform users can view zoho mappings for their clients" on zoho_channel_mappings
  for select using (
    is_super_admin(auth.uid()) or 
    is_backend_user(auth.uid()) or
    has_client_access(auth.uid(), client_id)
  );

create policy "Admins can create zoho mappings for their clients" on zoho_channel_mappings
  for insert with check (
    (is_super_admin(auth.uid()) or is_backend_user(auth.uid()) or has_client_access(auth.uid(), client_id))
    and created_by = auth.uid()
  );

create policy "Admins can update zoho mappings for their clients" on zoho_channel_mappings
  for update using (
    is_super_admin(auth.uid()) or 
    is_backend_user(auth.uid()) or
    has_client_access(auth.uid(), client_id)
  );

create policy "Admins can delete zoho mappings for their clients" on zoho_channel_mappings
  for delete using (
    is_super_admin(auth.uid()) or 
    is_backend_user(auth.uid()) or
    has_client_access(auth.uid(), client_id)
  );

-- Zoho sync jobs - same access as mappings
create policy "Platform users can view zoho sync jobs for their client mappings" on zoho_sync_jobs
  for select using (
    exists (
      select 1 from zoho_channel_mappings zcm 
      where zcm.id = mapping_id 
      and (
        is_super_admin(auth.uid()) or 
        is_backend_user(auth.uid()) or
        has_client_access(auth.uid(), zcm.client_id)
      )
    )
  );

-- Enable RLS
alter table zoho_auth enable row level security;
alter table zoho_channel_mappings enable row level security;
alter table zoho_sync_jobs enable row level security;

-- Grant permissions
grant usage on schema public to authenticated;
grant all on zoho_auth to authenticated;
grant all on zoho_channel_mappings to authenticated;
grant all on zoho_sync_jobs to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Success message
select 'Zoho Cliq integration schema created successfully' as status;
