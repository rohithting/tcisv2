-- Fix the table schema issue in create_platform_user function
-- The function needs to reference public.platform_users explicitly

-- Check where the platform_users table actually exists
SELECT 
    table_schema,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'platform_users';

-- Drop and recreate the create_platform_user function with explicit schema
DROP FUNCTION IF EXISTS create_platform_user(UUID, TEXT, TEXT) CASCADE;

-- Create the function with explicit table schema qualification
CREATE OR REPLACE FUNCTION create_platform_user(
    user_id UUID,
    user_email TEXT,
    user_full_name TEXT DEFAULT ''
)
RETURNS VOID AS $$
BEGIN
    -- Try to insert new user with explicit schema qualification
    INSERT INTO public.platform_users (id, email, full_name, platform_role, is_active)
    VALUES (
        user_id, 
        user_email, 
        COALESCE(NULLIF(TRIM(user_full_name), ''), 'User'), 
        'user'::public.platform_role, 
        true
    )
    ON CONFLICT (id) DO NOTHING;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail
        RAISE LOG 'Error creating platform user: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION create_platform_user(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_platform_user(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_platform_user(UUID, TEXT, TEXT) TO authenticator;

-- Test the updated function
DO $$
DECLARE
    test_uuid UUID := gen_random_uuid();
BEGIN
    RAISE LOG 'Testing updated create_platform_user with schema qualification...';
    PERFORM create_platform_user(test_uuid, 'test3@example.com', 'Test User 3');
    RAISE LOG 'Function test succeeded - checking if user was created...';
    
    -- Check if the user was actually created
    IF EXISTS (SELECT 1 FROM public.platform_users WHERE id = test_uuid) THEN
        RAISE LOG 'SUCCESS: User was created in public.platform_users';
        -- Clean up test
        DELETE FROM public.platform_users WHERE id = test_uuid;
    ELSE
        RAISE LOG 'FAILURE: User was not found in public.platform_users';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'Function test failed: % - %', SQLSTATE, SQLERRM;
END $$;

SELECT 'Function updated to use public.platform_users explicitly!' as message;
