-- Fix Signup Flow - Ensure platform user creation works properly
-- This migration fixes the "function create_platform_user does not exist" error

-- First, drop existing trigger to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_v2 ON auth.users;

-- Drop existing functions to recreate them properly
DROP FUNCTION IF EXISTS handle_new_user_v2() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS create_platform_user(UUID, TEXT, TEXT) CASCADE;

-- Create the platform user creation function with proper signature
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
        RETURN new_user;
    END IF;
    
    -- Insert the new platform user
    INSERT INTO platform_users (id, email, full_name, platform_role, is_active)
    VALUES (
        user_id, 
        user_email, 
        COALESCE(user_full_name, ''), 
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

-- Grant proper permissions
GRANT EXECUTE ON FUNCTION create_platform_user(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION create_platform_user(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION create_platform_user(UUID, TEXT, TEXT) TO anon;

-- Create the trigger function with better error handling
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

-- Verify the setup by checking if functions exist
DO $$
BEGIN
    -- Check if create_platform_user function exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname = 'create_platform_user'
    ) THEN
        RAISE EXCEPTION 'create_platform_user function was not created properly';
    END IF;
    
    -- Check if handle_new_user function exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' 
        AND p.proname = 'handle_new_user'
    ) THEN
        RAISE EXCEPTION 'handle_new_user function was not created properly';
    END IF;
    
    -- Check if trigger exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'on_auth_user_created'
    ) THEN
        RAISE EXCEPTION 'on_auth_user_created trigger was not created properly';
    END IF;
    
    RAISE LOG 'Signup flow verification completed successfully';
END $$;

-- Success message
SELECT 'Signup flow fixed - platform user creation should now work properly' as status;
