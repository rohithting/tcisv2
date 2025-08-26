-- Fix missing columns in zoho_auth table
-- This ensures all required columns exist for proper OAuth functionality

DO $$
BEGIN
    -- Add client_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zoho_auth' AND column_name = 'client_id'
    ) THEN
        ALTER TABLE zoho_auth ADD COLUMN client_id text;
        RAISE NOTICE 'Added client_id column to zoho_auth table';
    END IF;

    -- Add client_secret column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zoho_auth' AND column_name = 'client_secret'
    ) THEN
        ALTER TABLE zoho_auth ADD COLUMN client_secret text;
        RAISE NOTICE 'Added client_secret column to zoho_auth table';
    END IF;

    -- Add auto_refresh_enabled column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zoho_auth' AND column_name = 'auto_refresh_enabled'
    ) THEN
        ALTER TABLE zoho_auth ADD COLUMN auto_refresh_enabled boolean DEFAULT true;
        RAISE NOTICE 'Added auto_refresh_enabled column to zoho_auth table';
    END IF;

    -- Add refresh_error_count column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zoho_auth' AND column_name = 'refresh_error_count'
    ) THEN
        ALTER TABLE zoho_auth ADD COLUMN refresh_error_count integer DEFAULT 0;
        RAISE NOTICE 'Added refresh_error_count column to zoho_auth table';
    END IF;

    -- Add last_refresh_attempt column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zoho_auth' AND column_name = 'last_refresh_attempt'
    ) THEN
        ALTER TABLE zoho_auth ADD COLUMN last_refresh_attempt timestamp with time zone;
        RAISE NOTICE 'Added last_refresh_attempt column to zoho_auth table';
    END IF;

    RAISE NOTICE 'All required columns for Zoho OAuth have been added to zoho_auth table';
END $$;

-- Verify the table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'zoho_auth' 
ORDER BY ordinal_position;
