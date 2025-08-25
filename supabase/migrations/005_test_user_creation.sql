-- Test user creation and debug any issues

-- Check if the trigger exists and is active
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';

-- Check if the function exists
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'handle_new_user';

-- Check current RLS policies on platform_users
SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'platform_users';

-- Test if we can manually insert a platform user
-- (This will help us understand if the issue is with the trigger or RLS)
-- Note: Replace with actual user ID when testing
-- INSERT INTO platform_users (id, email, full_name, platform_role) 
-- VALUES ('test-user-id', 'test@example.com', 'Test User', 'user');

-- Check if there are any platform users
SELECT 
    id,
    email,
    platform_role,
    created_at
FROM platform_users 
ORDER BY created_at DESC 
LIMIT 5;

SELECT 'User creation debug completed' as status;
