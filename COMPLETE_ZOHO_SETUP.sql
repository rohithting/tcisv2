-- Complete Zoho Integration Setup
-- Run this in Supabase SQL Editor to create all Zoho tables

-- First, create the missing is_backend_user function
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION is_backend_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_backend_user(UUID) TO anon;

-- Create Zoho authentication table (system-wide)
CREATE TABLE IF NOT EXISTS zoho_auth (
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_zoho_auth_single ON zoho_auth ((1));

-- Create Zoho channel mappings table
CREATE TABLE IF NOT EXISTS zoho_channel_mappings (
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

-- Create sync job tracking table
CREATE TABLE IF NOT EXISTS zoho_sync_jobs (
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

-- Add zoho_mapping_id column to rooms table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'rooms' AND column_name = 'zoho_mapping_id'
    ) THEN
        ALTER TABLE rooms 
        ADD COLUMN zoho_mapping_id uuid references zoho_channel_mappings(id) on delete set null;
    END IF;
END $$;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_zoho_channel_mappings_client ON zoho_channel_mappings(client_id);
CREATE INDEX IF NOT EXISTS idx_zoho_channel_mappings_room ON zoho_channel_mappings(room_id);
CREATE INDEX IF NOT EXISTS idx_zoho_channel_mappings_sync_status ON zoho_channel_mappings(sync_status);
CREATE INDEX IF NOT EXISTS idx_zoho_sync_jobs_mapping ON zoho_sync_jobs(mapping_id);
CREATE INDEX IF NOT EXISTS idx_zoho_sync_jobs_status ON zoho_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_zoho_sync_jobs_created ON zoho_sync_jobs(created_at);

-- Enable RLS on all tables
ALTER TABLE zoho_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoho_channel_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE zoho_sync_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Zoho auth - only super admins can manage
CREATE POLICY IF NOT EXISTS "Super admins can manage zoho auth" ON zoho_auth
  FOR ALL USING (is_super_admin(auth.uid()));

-- Zoho channel mappings - admins with client access can manage
CREATE POLICY IF NOT EXISTS "Platform users can view zoho mappings for their clients" ON zoho_channel_mappings
  FOR SELECT USING (
    is_super_admin(auth.uid()) OR 
    is_backend_user(auth.uid()) OR
    has_client_access(auth.uid(), client_id)
  );

CREATE POLICY IF NOT EXISTS "Admins can create zoho mappings for their clients" ON zoho_channel_mappings
  FOR INSERT WITH CHECK (
    (is_super_admin(auth.uid()) OR is_backend_user(auth.uid()) OR has_client_access(auth.uid(), client_id))
    AND created_by = auth.uid()
  );

CREATE POLICY IF NOT EXISTS "Admins can update zoho mappings for their clients" ON zoho_channel_mappings
  FOR UPDATE USING (
    is_super_admin(auth.uid()) OR 
    is_backend_user(auth.uid()) OR
    has_client_access(auth.uid(), client_id)
  );

CREATE POLICY IF NOT EXISTS "Admins can delete zoho mappings for their clients" ON zoho_channel_mappings
  FOR DELETE USING (
    is_super_admin(auth.uid()) OR 
    is_backend_user(auth.uid()) OR
    has_client_access(auth.uid(), client_id)
  );

-- Zoho sync jobs - same access as mappings
CREATE POLICY IF NOT EXISTS "Platform users can view zoho sync jobs for their client mappings" ON zoho_sync_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM zoho_channel_mappings zcm 
      WHERE zcm.id = mapping_id 
      AND (
        is_super_admin(auth.uid()) OR 
        is_backend_user(auth.uid()) OR
        has_client_access(auth.uid(), zcm.client_id)
      )
    )
  );

-- Grant permissions
GRANT ALL ON zoho_auth TO authenticated;
GRANT ALL ON zoho_channel_mappings TO authenticated;
GRANT ALL ON zoho_sync_jobs TO authenticated;

SELECT 'Complete Zoho integration setup completed successfully!' as message;
