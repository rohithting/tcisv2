-- Debug script to check user creation issues

-- 1. Check if the trigger exists
select 
  trigger_name, 
  event_manipulation, 
  event_object_table,
  action_timing,
  action_statement
from information_schema.triggers 
where trigger_name = 'on_auth_user_created';

-- 2. Check if the function exists
select 
  routine_name, 
  routine_type, 
  security_type
from information_schema.routines 
where routine_name = 'handle_new_user';

-- 3. Check RLS policies on platform_users
select 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
from pg_policies 
where tablename = 'platform_users';

-- 4. Check if platform_users table exists and its structure
select 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
from information_schema.columns 
where table_name = 'platform_users' 
order by ordinal_position;

-- 5. Test manual insert (this should work if RLS is configured correctly)
-- Note: This will only work if you run it as a user with proper permissions
-- INSERT INTO platform_users (id, email, full_name, platform_role) 
-- VALUES ('00000000-0000-0000-0000-000000000000', 'test@example.com', 'Test User', 'user');

select 'Debug queries completed' as status;
