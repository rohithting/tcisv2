-- Quick Zoho Integration Setup
-- Copy and paste this into Supabase SQL Editor

-- Create the missing is_backend_user function
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

-- Create Zoho auth table
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_zoho_auth_single on zoho_auth ((1));

-- Enable RLS
ALTER TABLE zoho_auth ENABLE ROW LEVEL SECURITY;

-- Create policy for zoho_auth
CREATE POLICY IF NOT EXISTS "Super admins can manage zoho auth" ON zoho_auth
  FOR ALL USING (is_super_admin(auth.uid()));

-- Grant permissions
GRANT ALL ON zoho_auth TO authenticated;

SELECT 'Zoho integration tables created successfully!' as message;
