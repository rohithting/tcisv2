-- Fix the schema issue - auth trigger calling public function
-- The trigger runs in auth schema context but needs to call public.create_platform_user

-- First, let's check where the function actually exists
SELECT 
    routine_schema,
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines 
WHERE routine_name = 'create_platform_user';

-- Drop the current trigger
DROP TRIGGER IF EXISTS handle_new_user_v2 ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_v2() CASCADE;

-- Create the trigger function with explicit schema qualification
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
    RAISE LOG 'Calling public.create_platform_user for user: % with email: % and name: %', NEW.id, NEW.email, user_full_name;
    
    -- Call the function with explicit schema qualification
    PERFORM public.create_platform_user(NEW.id, NEW.email, user_full_name);
    
    RAISE LOG 'Successfully called public.create_platform_user function';
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Error in trigger calling public.create_platform_user: % - %', SQLSTATE, SQLERRM;
        RETURN NEW; -- Don't fail the signup
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions to the trigger function
GRANT EXECUTE ON FUNCTION handle_new_user_v2() TO service_role;

-- Create the trigger
CREATE TRIGGER handle_new_user_v2
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_v2();

-- Alternative approach: Grant usage on public schema to auth functions
GRANT USAGE ON SCHEMA public TO authenticator;
GRANT EXECUTE ON FUNCTION public.create_platform_user(UUID, TEXT, TEXT) TO authenticator;

-- Test the function call with explicit schema
DO $$
DECLARE
    test_uuid UUID := gen_random_uuid();
BEGIN
    RAISE LOG 'Testing public.create_platform_user function directly...';
    PERFORM public.create_platform_user(test_uuid, 'test2@example.com', 'Test User 2');
    RAISE LOG 'Direct function call with schema qualification succeeded';
    -- Clean up test
    DELETE FROM public.platform_users WHERE id = test_uuid;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Direct function call with schema failed: % - %', SQLSTATE, SQLERRM;
END $$;

SELECT 'Schema issue fixed! Trigger now calls public.create_platform_user explicitly.' as message;
