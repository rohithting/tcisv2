# Quick Signup Fix

## The Problem
You're getting this error: `type "platform_users" does not exist` because the database migrations haven't been applied yet.

## Quick Solution

**Copy and paste this SQL into your Supabase SQL Editor:**

```sql
-- End any pending transactions
COMMIT;

-- Create platform_role enum (safe to run multiple times)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_role') THEN
        CREATE TYPE platform_role AS ENUM ('super_admin', 'backend', 'admin', 'manager', 'user');
    END IF;
END $$;

-- Create platform_users table (safe to run multiple times)
CREATE TABLE IF NOT EXISTS platform_users (
    id uuid references auth.users(id) on delete cascade primary key,
    email text unique not null,
    full_name text,
    platform_role platform_role default 'user' not null,
    is_active boolean default true,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
ALTER TABLE platform_users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own profile" ON platform_users;
DROP POLICY IF EXISTS "Users can update their own profile" ON platform_users;

-- Create simple RLS policies (without utility functions)
CREATE POLICY "Users can view their own profile" ON platform_users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON platform_users
  FOR UPDATE USING (auth.uid() = id);

-- Grant permissions
GRANT ALL ON platform_users TO authenticated;
GRANT ALL ON platform_users TO service_role;
GRANT ALL ON platform_users TO anon;

-- Drop existing functions to avoid conflicts
DROP FUNCTION IF EXISTS create_platform_user(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create signup function
CREATE OR REPLACE FUNCTION create_platform_user(
    user_id UUID,
    user_email TEXT,
    user_full_name TEXT DEFAULT ''
)
RETURNS platform_users AS $$
DECLARE
    new_user platform_users;
BEGIN
    -- Try to insert new user
    INSERT INTO platform_users (id, email, full_name, platform_role, is_active)
    VALUES (
        user_id, 
        user_email, 
        COALESCE(NULLIF(TRIM(user_full_name), ''), 'User'), 
        'user'::platform_role, 
        true
    )
    RETURNING * INTO new_user;
    
    RETURN new_user;
EXCEPTION
    WHEN unique_violation THEN
        -- User already exists, return existing user
        SELECT * INTO new_user FROM platform_users WHERE id = user_id;
        RETURN new_user;
    WHEN OTHERS THEN
        -- Log error and re-raise
        RAISE LOG 'Error creating platform user: %', SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant function permissions
GRANT EXECUTE ON FUNCTION create_platform_user(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_platform_user(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_platform_user(UUID, TEXT, TEXT) TO anon;

-- Create trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
    user_full_name TEXT;
    result platform_users;
BEGIN
    -- Extract full name from metadata
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'fullName',
        ''
    );
    
    -- Create platform user
    SELECT create_platform_user(NEW.id, NEW.email, user_full_name) INTO result;
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Don't fail the auth.users insert if platform_users creation fails
        RAISE LOG 'Error in handle_new_user trigger: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant trigger function permissions
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;

-- Create trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create utility functions for later use (optional)
CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM platform_users 
        WHERE id = user_id 
        AND platform_role = 'super_admin'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_backend_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM platform_users 
        WHERE id = user_id 
        AND platform_role IN ('super_admin', 'backend')
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions on utility functions
GRANT EXECUTE ON FUNCTION is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_backend_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin(UUID) TO anon;
GRANT EXECUTE ON FUNCTION is_backend_user(UUID) TO anon;

-- Success message
SELECT 'Signup fixed! Try registering a new user now.' as message;
```

## Test It

1. **Apply the SQL above** in Supabase SQL Editor
2. **Try signing up** a new user
3. **Check the platform_users table** - you should see the new user there

## What This Does

- ✅ Creates the `platform_users` table
- ✅ Creates the `platform_role` enum type
- ✅ Sets up the signup trigger to automatically create platform users
- ✅ Handles errors gracefully so signup always works
- ✅ Sets proper permissions and security policies

The signup should work immediately after applying this SQL!
