-- Manual fix for signup issue
-- Execute this in Supabase SQL Editor to fix the platform_users type error

-- First, end any pending transactions
COMMIT;

-- Check if platform_users table exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'platform_users') THEN
        -- Create the platform_users table if it doesn't exist
        RAISE LOG 'Creating platform_users table...';
        
        -- Create platform_role enum if it doesn't exist
        DO $enum$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'platform_role') THEN
                CREATE TYPE platform_role AS ENUM ('super_admin', 'backend', 'admin', 'manager', 'user');
            END IF;
        END $enum$;
        
        -- Create platform_users table
        CREATE TABLE platform_users (
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
        
        -- Create RLS policies
        CREATE POLICY "Users can view their own profile" ON platform_users
          FOR SELECT USING (auth.uid() = id);
          
        CREATE POLICY "Users can update their own profile" ON platform_users
          FOR UPDATE USING (auth.uid() = id);
          
        -- Grant permissions
        GRANT ALL ON platform_users TO authenticated;
        GRANT ALL ON platform_users TO service_role;
        
        RAISE LOG 'platform_users table created successfully';
    ELSE
        RAISE LOG 'platform_users table already exists';
    END IF;
END $$;

-- Drop any existing functions and triggers to recreate them
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_v2 ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_v2() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS create_platform_user(UUID, TEXT, TEXT) CASCADE;

-- Create the platform user creation function
CREATE OR REPLACE FUNCTION create_platform_user(
    user_id UUID,
    user_email TEXT,
    user_full_name TEXT DEFAULT ''
)
RETURNS platform_users AS $$
DECLARE
    new_user platform_users;
BEGIN
    -- Check if user already exists
    SELECT * INTO new_user FROM platform_users WHERE id = user_id;
    
    IF FOUND THEN
        -- User already exists, return existing user
        RAISE LOG 'Platform user already exists: % (%)', user_email, user_id;
        RETURN new_user;
    END IF;
    
    -- Insert the new platform user
    INSERT INTO platform_users (id, email, full_name, platform_role, is_active)
    VALUES (
        user_id, 
        user_email, 
        COALESCE(NULLIF(user_full_name, ''), 'User'), 
        'user'::platform_role,
        true
    )
    RETURNING * INTO new_user;
    
    RAISE LOG 'Successfully created platform user: % (%)', user_email, user_id;
    RETURN new_user;
    
EXCEPTION
    WHEN unique_violation THEN
        -- Handle race condition - user was created by another process
        SELECT * INTO new_user FROM platform_users WHERE id = user_id;
        IF FOUND THEN
            RAISE LOG 'Platform user created by another process: % (%)', user_email, user_id;
            RETURN new_user;
        ELSE
            RAISE EXCEPTION 'Unique violation but user not found: %', user_id;
        END IF;
    WHEN OTHERS THEN
        -- Log error details and re-raise
        RAISE LOG 'Error creating platform user % (%): % - %', user_email, user_id, SQLSTATE, SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant proper permissions on the function
GRANT EXECUTE ON FUNCTION create_platform_user(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_platform_user(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_platform_user(UUID, TEXT, TEXT) TO anon;

-- Create the trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
    user_full_name TEXT;
    result platform_users;
BEGIN
    -- Extract full name from metadata, handle various formats
    user_full_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'fullName',
        ''
    );
    
    RAISE LOG 'Processing new user signup: % (%) with name: %', NEW.email, NEW.id, user_full_name;
    
    -- Create the platform user
    SELECT create_platform_user(NEW.id, NEW.email, user_full_name) INTO result;
    
    RAISE LOG 'Platform user created successfully for: %', NEW.email;
    RETURN NEW;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the auth.users insert
        RAISE LOG 'Error in handle_new_user trigger for % (%): % - %', NEW.email, NEW.id, SQLSTATE, SQLERRM;
        -- Return NEW so the auth.users insert still succeeds
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions on the trigger function
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create some utility functions for RLS policies
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

-- Grant execute permissions on utility functions
GRANT EXECUTE ON FUNCTION is_super_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_backend_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_super_admin(UUID) TO anon;
GRANT EXECUTE ON FUNCTION is_backend_user(UUID) TO anon;

-- Verify the setup
DO $$
DECLARE
    table_exists BOOLEAN;
    function_exists BOOLEAN;
    trigger_exists BOOLEAN;
BEGIN
    -- Check if platform_users table exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'platform_users'
    ) INTO table_exists;
    
    -- Check if create_platform_user function exists
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname = 'create_platform_user'
    ) INTO function_exists;
    
    -- Check if trigger exists
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
    ) INTO trigger_exists;
    
    IF table_exists AND function_exists AND trigger_exists THEN
        RAISE LOG 'SUCCESS: All signup components created successfully';
    ELSE
        RAISE EXCEPTION 'FAILED: Missing components - Table: %, Function: %, Trigger: %', 
            table_exists, function_exists, trigger_exists;
    END IF;
END $$;

-- Final success message
SELECT 'Signup flow fixed successfully! You can now test user registration.' as status;
