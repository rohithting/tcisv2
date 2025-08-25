-- Debug and fix the signup trigger
-- Let's check what's happening and fix any issues

-- First, let's check if the trigger exists and is firing
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%user%' 
AND event_object_table = 'users'
AND event_object_schema = 'auth';

-- Check if the function exists
SELECT 
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines 
WHERE routine_name IN ('create_platform_user', 'handle_new_user_v2');

-- Let's create a more robust trigger with better logging
DROP TRIGGER IF EXISTS handle_new_user_v2 ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_v2() CASCADE;

-- Create an improved trigger function with detailed logging
CREATE OR REPLACE FUNCTION handle_new_user_v2()
RETURNS trigger AS $$
DECLARE
    user_full_name TEXT;
    insert_result INTEGER;
BEGIN
    -- Log that trigger is firing
    RAISE LOG 'Trigger handle_new_user_v2 firing for user: %', NEW.id;
    
    -- Extract full name from metadata
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'fullName',
        NEW.email,
        'User'
    );
    
    RAISE LOG 'Extracted full name: %', user_full_name;
    
    -- Try to insert directly in the trigger (more reliable)
    BEGIN
        INSERT INTO platform_users (id, email, full_name, platform_role, is_active, created_at, updated_at)
        VALUES (
            NEW.id,
            NEW.email,
            user_full_name,
            'user'::platform_role,
            true,
            NOW(),
            NOW()
        );
        
        GET DIAGNOSTICS insert_result = ROW_COUNT;
        RAISE LOG 'Successfully inserted platform_user. Rows affected: %', insert_result;
        
    EXCEPTION
        WHEN unique_violation THEN
            RAISE LOG 'User already exists in platform_users: %', NEW.id;
        WHEN OTHERS THEN
            RAISE LOG 'Error inserting platform_user: % - %', SQLSTATE, SQLERRM;
            -- Don't fail the auth.users insert
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION handle_new_user_v2() TO service_role;
GRANT EXECUTE ON FUNCTION handle_new_user_v2() TO authenticated;

-- Create the trigger
CREATE TRIGGER handle_new_user_v2
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_v2();

-- Test query - check recent auth.users entries
SELECT 
    id,
    email,
    created_at,
    raw_user_meta_data
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- Test query - check recent platform_users entries  
SELECT 
    id,
    email,
    full_name,
    platform_role,
    created_at
FROM platform_users 
ORDER BY created_at DESC 
LIMIT 5;

SELECT 'Trigger updated with better logging. Check the logs after your next signup attempt!' as message;
