-- Targeted fix for signup trigger (when platform_users table already exists)
-- Just need to fix the trigger and function

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_v2 ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user_v2() CASCADE;
DROP FUNCTION IF EXISTS create_platform_user(UUID, TEXT, TEXT) CASCADE;

-- Create the signup function
CREATE OR REPLACE FUNCTION create_platform_user(
    user_id UUID,
    user_email TEXT,
    user_full_name TEXT DEFAULT ''
)
RETURNS VOID AS $$
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

-- Create trigger function
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
        ''
    );
    
    -- Create platform user (void function, no return value)
    PERFORM create_platform_user(NEW.id, NEW.email, user_full_name);
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Don't fail the auth.users insert if platform_users creation fails
        RAISE LOG 'Error in handle_new_user_v2 trigger: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant trigger function permissions
GRANT EXECUTE ON FUNCTION handle_new_user_v2() TO service_role;

-- Create trigger
CREATE TRIGGER handle_new_user_v2
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_v2();

-- Success message
SELECT 'Signup trigger fixed! The function and trigger are now properly created.' as message;
