-- Manual user creation function as fallback

-- Create a function to manually create platform users
CREATE OR REPLACE FUNCTION create_platform_user(
    user_id UUID,
    user_email TEXT,
    user_full_name TEXT DEFAULT ''
)
RETURNS platform_users AS $$
DECLARE
    new_user platform_users;
BEGIN
    -- Insert the new platform user
    INSERT INTO platform_users (id, email, full_name, platform_role)
    VALUES (user_id, user_email, user_full_name, 'user'::platform_role)
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_platform_user(UUID, TEXT, TEXT) TO authenticated;

-- Create a simpler trigger function that's more robust
CREATE OR REPLACE FUNCTION handle_new_user_v2()
RETURNS trigger AS $$
BEGIN
    -- Use the manual creation function
    PERFORM create_platform_user(
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log the error but don't fail the auth.users insert
        RAISE LOG 'Error in handle_new_user_v2 trigger: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the old trigger and create a new one
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created_v2
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user_v2();

SELECT 'Manual user creation function and improved trigger created' as status;
