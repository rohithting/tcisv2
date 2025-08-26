-- Add client credentials to zoho_auth table for auto-refresh functionality
-- This is needed to automatically refresh tokens without manual intervention

DO $$
BEGIN
    -- Add client_id and client_secret columns if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zoho_auth' AND column_name = 'client_id'
    ) THEN
        ALTER TABLE zoho_auth ADD COLUMN client_id text;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zoho_auth' AND column_name = 'client_secret'
    ) THEN
        ALTER TABLE zoho_auth ADD COLUMN client_secret text;
    END IF;

    -- Add auto_refresh_enabled flag
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zoho_auth' AND column_name = 'auto_refresh_enabled'
    ) THEN
        ALTER TABLE zoho_auth ADD COLUMN auto_refresh_enabled boolean DEFAULT true;
    END IF;

    -- Add last_refresh_attempt timestamp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zoho_auth' AND column_name = 'last_refresh_attempt'
    ) THEN
        ALTER TABLE zoho_auth ADD COLUMN last_refresh_attempt timestamp with time zone;
    END IF;

    -- Add refresh_error_count for tracking failed refresh attempts
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zoho_auth' AND column_name = 'refresh_error_count'
    ) THEN
        ALTER TABLE zoho_auth ADD COLUMN refresh_error_count integer DEFAULT 0;
    END IF;

    RAISE NOTICE 'Added client credentials and auto-refresh columns to zoho_auth table';
END $$;

SELECT 'Zoho auto-refresh support added' as status;
