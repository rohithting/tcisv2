-- Fix zoho_auth table to make refresh_token nullable
-- This addresses the issue where Zoho doesn't always return refresh tokens

-- Check if zoho_auth table exists and modify refresh_token column
DO $$
BEGIN
    -- Check if the table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'zoho_auth') THEN
        -- Make refresh_token nullable if it's currently NOT NULL
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'zoho_auth' 
            AND column_name = 'refresh_token' 
            AND is_nullable = 'NO'
        ) THEN
            ALTER TABLE zoho_auth ALTER COLUMN refresh_token DROP NOT NULL;
            RAISE NOTICE 'Made refresh_token nullable in zoho_auth table';
        END IF;
    ELSE
        -- Create the zoho_auth table if it doesn't exist
        CREATE TABLE zoho_auth (
            id uuid primary key default gen_random_uuid(),
            access_token text not null,
            refresh_token text, -- Made nullable since Zoho doesn't always return it
            expires_at timestamp with time zone not null,
            scope text,
            authenticated_by uuid not null references platform_users(id),
            created_at timestamp with time zone default timezone('utc'::text, now()) not null,
            updated_at timestamp with time zone default timezone('utc'::text, now()) not null
        );

        -- Enable RLS
        ALTER TABLE zoho_auth ENABLE ROW LEVEL SECURITY;

        -- Create policies
        CREATE POLICY "Authenticated users can view zoho auth" ON zoho_auth
          FOR SELECT USING (auth.role() = 'authenticated');

        CREATE POLICY "Super admins can manage zoho auth" ON zoho_auth
          FOR ALL USING (is_super_admin(auth.uid()));

        -- Grant permissions
        GRANT ALL ON zoho_auth TO authenticated;
        
        RAISE NOTICE 'Created zoho_auth table with nullable refresh_token';
    END IF;
END $$;

SELECT 'Zoho auth refresh_token nullability fixed' as status;
