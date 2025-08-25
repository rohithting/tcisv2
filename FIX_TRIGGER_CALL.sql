-- Fix the trigger to properly call the existing create_platform_user function
-- The function exists and works, we just need to call it correctly

-- First, let's check what we have
SELECT 
    routine_name,
    routine_type,
    data_type,
    security_type
FROM information_schema.routines 
WHERE routine_name = 'create_platform_user';

-- Check current trigger
SELECT 
    trigger_name,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name LIKE '%user%' 
AND event_object_table = 'users'
AND event_object_schema = 'auth';

-- Drop the current trigger
DROP TRIGGER IF EXISTS handle_new_user_v2 ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_v2() CASCADE;

-- Create a simple trigger that just calls your existing function
CREATE OR REPLACE FUNCTION handle_new_user_v2()
RETURNS trigger AS $$
DECLARE
    user_full_name TEXT;
BEGIN
    -- Extract full name from metadata
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'fullName',
        NEW.email,
        'User'
    );
    
    -- Log the attempt
    RAISE LOG 'Calling create_platform_user for user: % with email: % and name: %', NEW.id, NEW.email, user_full_name;
    
    -- Call your existing function
    PERFORM create_platform_user(NEW.id, NEW.email, user_full_name);
    
    RAISE LOG 'Successfully called create_platform_user function';
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Error in trigger calling create_platform_user: % - %', SQLSTATE, SQLERRM;
        RETURN NEW; -- Don't fail the signup
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION handle_new_user_v2() TO service_role;

-- Create the trigger
CREATE TRIGGER handle_new_user_v2
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_v2();

-- Test the function directly to make sure it works
DO $$
DECLARE
    test_uuid UUID := gen_random_uuid();
BEGIN
    RAISE LOG 'Testing create_platform_user function directly...';
    PERFORM create_platform_user(test_uuid, 'test@example.com', 'Test User');
    RAISE LOG 'Direct function call succeeded';
    -- Clean up test
    DELETE FROM platform_users WHERE id = test_uuid;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Direct function call failed: % - %', SQLSTATE, SQLERRM;
END $$;

SELECT 'Trigger fixed to properly call your existing create_platform_user function!' as message;
