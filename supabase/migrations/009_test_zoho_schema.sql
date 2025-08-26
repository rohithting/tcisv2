-- Test migration to verify Zoho schema compatibility
-- This will test if the functions can work with your existing zoho_auth table

-- Test 1: Check if zoho_auth table exists and has correct columns
DO $$
DECLARE
    table_exists boolean;
    column_count integer;
BEGIN
    -- Check if table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'zoho_auth'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE '✅ zoho_auth table exists';
        
        -- Check column count
        SELECT COUNT(*) INTO column_count
        FROM information_schema.columns 
        WHERE table_name = 'zoho_auth';
        
        RAISE NOTICE '✅ zoho_auth table has % columns', column_count;
        
        -- List all columns
        RAISE NOTICE 'Columns in zoho_auth:';
        FOR col IN 
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'zoho_auth'
            ORDER BY ordinal_position
        LOOP
            RAISE NOTICE '  - % (%s, nullable: %)', col.column_name, col.data_type, col.is_nullable;
        END LOOP;
        
    ELSE
        RAISE NOTICE '❌ zoho_auth table does not exist';
    END IF;
END $$;

-- Test 2: Check if required columns exist
DO $$
DECLARE
    has_access_token boolean;
    has_refresh_token boolean;
    has_expires_at boolean;
    has_authenticated_by boolean;
BEGIN
    -- Check required columns
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zoho_auth' AND column_name = 'access_token'
    ) INTO has_access_token;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zoho_auth' AND column_name = 'refresh_token'
    ) INTO has_refresh_token;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zoho_auth' AND column_name = 'expires_at'
    ) INTO has_expires_at;
    
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'zoho_auth' AND column_name = 'authenticated_by'
    ) INTO has_authenticated_by;
    
    RAISE NOTICE 'Column check results:';
    RAISE NOTICE '  - access_token: %', CASE WHEN has_access_token THEN '✅' ELSE '❌' END;
    RAISE NOTICE '  - refresh_token: %', CASE WHEN has_refresh_token THEN '✅' ELSE '❌' END;
    RAISE NOTICE '  - expires_at: %', CASE WHEN has_expires_at THEN '✅' ELSE '❌' END;
    RAISE NOTICE '  - authenticated_by: %', CASE WHEN has_authenticated_by THEN '✅' ELSE '❌' END;
    
    -- If all required columns exist, we can proceed
    IF has_access_token AND has_refresh_token AND has_expires_at AND has_authenticated_by THEN
        RAISE NOTICE '✅ All required columns exist - schema is compatible!';
    ELSE
        RAISE NOTICE '❌ Missing required columns - schema is NOT compatible!';
    END IF;
END $$;

-- Test 3: Check if we can query the table
DO $$
DECLARE
    record_count integer;
BEGIN
    BEGIN
        SELECT COUNT(*) INTO record_count FROM zoho_auth;
        RAISE NOTICE '✅ Can query zoho_auth table - found % records', record_count;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Cannot query zoho_auth table: %', SQLERRM;
    END;
END $$;

-- Test 4: Check if cron extension is available
DO $$
DECLARE
    cron_available boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) INTO cron_available;
    
    IF cron_available THEN
        RAISE NOTICE '✅ pg_cron extension is available';
    ELSE
        RAISE NOTICE '❌ pg_cron extension is NOT available - cron functions will not work';
    END IF;
END $$;

-- Test 5: Check if net extension is available (for HTTP requests)
DO $$
DECLARE
    net_available boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'net'
    ) INTO net_available;
    
    IF net_available THEN
        RAISE NOTICE '✅ net extension is available - HTTP functions will work';
    ELSE
        RAISE NOTICE '❌ net extension is NOT available - HTTP functions will NOT work';
    END IF;
END $$;

-- Summary
SELECT 'Schema compatibility test completed' as status;
