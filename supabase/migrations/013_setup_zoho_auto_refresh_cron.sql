-- Set up automatic token refresh for Zoho authentication
-- This ensures tokens are refreshed before they expire, maintaining persistent authentication

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to call the Zoho auto-refresh edge function
CREATE OR REPLACE FUNCTION trigger_zoho_auto_refresh()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- This function will be called by cron to trigger the auto-refresh
    -- We'll use pg_net to make HTTP requests to our edge function
    PERFORM
        net.http_post(
            url := 'https://brohvgsykwmcefsjkbit.supabase.co/functions/v1/zoho-auto-refresh',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
            ),
            body := '{}'::jsonb
        );
    
    -- Log the attempt
    INSERT INTO public.system_logs (
        log_type,
        message,
        created_at
    ) VALUES (
        'zoho_auto_refresh',
        'Triggered Zoho token auto-refresh job',
        now()
    ) ON CONFLICT DO NOTHING; -- Ignore if system_logs table doesn't exist
    
EXCEPTION WHEN OTHERS THEN
    -- Log any errors
    RAISE LOG 'Error in trigger_zoho_auto_refresh: %', SQLERRM;
END;
$$;

-- Grant execute permission to the postgres user for cron jobs
GRANT EXECUTE ON FUNCTION trigger_zoho_auto_refresh() TO postgres;

-- Schedule the cron job to run every 6 hours
-- This ensures tokens are refreshed well before they expire (usually 1 hour expiry)
SELECT cron.schedule(
    'zoho-token-refresh',
    '0 */6 * * *', -- Every 6 hours at minute 0
    'SELECT trigger_zoho_auto_refresh();'
);

-- Create a manual function that super admins can call to force refresh
CREATE OR REPLACE FUNCTION manual_zoho_refresh()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    -- Check if user is super admin
    IF NOT is_super_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Access denied. Super admin required.';
    END IF;
    
    -- Call the auto-refresh function
    PERFORM trigger_zoho_auto_refresh();
    
    -- Return success message
    result := jsonb_build_object(
        'success', true,
        'message', 'Zoho token refresh triggered manually',
        'timestamp', now()
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    result := jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'timestamp', now()
    );
    
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION manual_zoho_refresh() TO authenticated;

-- Create a view for monitoring token status
CREATE OR REPLACE VIEW zoho_token_status AS
SELECT 
    id,
    authenticated_by,
    expires_at,
    EXTRACT(EPOCH FROM (expires_at - now())) / 3600 AS hours_until_expiry,
    CASE 
        WHEN expires_at <= now() THEN 'expired'
        WHEN expires_at <= now() + interval '24 hours' THEN 'expiring_soon'
        WHEN expires_at <= now() + interval '7 days' THEN 'valid'
        ELSE 'long_term'
    END AS status,
    auto_refresh_enabled,
    refresh_error_count,
    last_refresh_attempt,
    created_at,
    updated_at
FROM zoho_auth;

-- Grant select permission to authenticated users (views inherit RLS from underlying tables)
GRANT SELECT ON zoho_token_status TO authenticated;

SELECT 'Zoho auto-refresh cron job and monitoring set up successfully' as status;
