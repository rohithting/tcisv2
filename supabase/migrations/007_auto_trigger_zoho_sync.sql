-- Migration to set up auto-triggering of zoho-sync on channel mapping
-- and cron scheduling functions

-- 1. Create function to automatically trigger zoho-sync when channel is mapped
CREATE OR REPLACE FUNCTION auto_trigger_zoho_sync()
RETURNS TRIGGER AS $$
DECLARE
    supabase_url text;
    service_role_key text;
    response_status integer;
    response_body text;
BEGIN
    -- Only trigger for new active mappings
    IF NEW.sync_status = 'active' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.sync_status != 'active')) THEN
        
        -- Get Supabase configuration from environment
        supabase_url := current_setting('app.settings.supabase_url', true);
        service_role_key := current_setting('app.settings.service_role_key', true);
        
        -- If environment variables not set, use default values
        IF supabase_url IS NULL THEN
            supabase_url := 'https://brohvgsykwmcefsjkbit.supabase.co';
        END IF;
        
        -- Make HTTP request to zoho-sync-trigger
        SELECT 
            status,
            content
        INTO 
            response_status,
            response_body
        FROM 
            net.http_post(
                url := supabase_url || '/functions/v1/zoho-sync-trigger',
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || service_role_key
                ),
                body := jsonb_build_object(
                    'manual', false,
                    'mapping_id', NEW.id,
                    'full_sync', true
                )
            );
        
        -- Log the trigger attempt
        INSERT INTO zoho_sync_jobs (
            job_type,
            status,
            metadata,
            created_by
        ) VALUES (
            'auto_trigger',
            CASE 
                WHEN response_status = 200 THEN 'triggered'
                ELSE 'failed'
            END,
            jsonb_build_object(
                'mapping_id', NEW.id,
                'channel_name', NEW.zoho_channel_name,
                'response_status', response_status,
                'response_body', response_body,
                'triggered_at', now()
            ),
            NEW.created_by
        );
        
        RAISE NOTICE 'Auto-triggered zoho-sync for channel % (ID: %). Response: % - %', 
            NEW.zoho_channel_name, NEW.id, response_status, response_body;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create trigger to call the function on channel mapping changes
DROP TRIGGER IF EXISTS trigger_auto_zoho_sync ON zoho_channel_mappings;
CREATE TRIGGER trigger_auto_zoho_sync
    AFTER INSERT OR UPDATE ON zoho_channel_mappings
    FOR EACH ROW
    EXECUTE FUNCTION auto_trigger_zoho_sync();

-- 3. Create cron scheduling functions
CREATE OR REPLACE FUNCTION schedule_zoho_sync_cron(
    cron_expression text DEFAULT '0 */6 * * *', -- Every 6 hours by default
    mapping_id uuid DEFAULT NULL -- Specific mapping or NULL for all active
)
RETURNS text AS $$
DECLARE
    job_id bigint;
    cron_name text;
BEGIN
    -- Generate unique cron job name
    cron_name := 'zoho_sync_' || COALESCE(mapping_id::text, 'all_active') || '_' || extract(epoch from now())::bigint;
    
    -- Schedule the cron job
    SELECT cron.schedule(
        job_name := cron_name,
        schedule := cron_expression,
        command := format(
            'SELECT trigger_zoho_sync_cron(%L, %L)',
            COALESCE(mapping_id::text, ''),
            cron_expression
        )
    ) INTO job_id;
    
    RETURN format('Cron job scheduled: %s (ID: %s)', cron_name, job_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Create function to be called by cron
CREATE OR REPLACE FUNCTION trigger_zoho_sync_cron(
    mapping_id text DEFAULT '',
    cron_schedule text DEFAULT ''
)
RETURNS text AS $$
DECLARE
    supabase_url text;
    service_role_key text;
    response_status integer;
    response_body text;
    mapping_record record;
    success_count integer := 0;
    total_count integer := 0;
BEGIN
    -- Get Supabase configuration
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_role_key := current_setting('app.settings.service_role_key', true);
    
    IF supabase_url IS NULL THEN
        supabase_url := 'https://brohvgsykwmcefsjkbit.supabase.co';
    END IF;
    
    -- If specific mapping_id provided, sync only that one
    IF mapping_id != '' THEN
        SELECT * INTO mapping_record 
        FROM zoho_channel_mappings 
        WHERE id::text = mapping_id AND sync_status = 'active';
        
        IF FOUND THEN
            total_count := 1;
            -- Trigger sync for specific mapping
            SELECT 
                status,
                content
            INTO 
                response_status,
                response_body
            FROM 
                net.http_post(
                    url := supabase_url || '/functions/v1/zoho-sync-trigger',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || service_role_key
                    ),
                    body := jsonb_build_object(
                        'manual', false,
                        'mapping_id', mapping_record.id,
                        'full_sync', false
                    )
                );
            
            IF response_status = 200 THEN
                success_count := 1;
            END IF;
            
            -- Log the cron-triggered sync
            INSERT INTO zoho_sync_jobs (
                job_type,
                status,
                metadata,
                created_by
            ) VALUES (
                'cron_sync',
                CASE 
                    WHEN response_status = 200 THEN 'triggered'
                    ELSE 'failed'
                END,
                jsonb_build_object(
                    'mapping_id', mapping_record.id,
                    'channel_name', mapping_record.zoho_channel_name,
                    'response_status', response_status,
                    'response_body', response_body,
                    'cron_schedule', cron_schedule,
                    'triggered_at', now()
                ),
                mapping_record.created_by
            );
        END IF;
    ELSE
        -- Sync all active mappings
        FOR mapping_record IN 
            SELECT * FROM zoho_channel_mappings 
            WHERE sync_status = 'active'
        LOOP
            total_count := total_count + 1;
            
            -- Trigger sync for each mapping
            SELECT 
                status,
                content
            INTO 
                response_status,
                response_body
            FROM 
                net.http_post(
                    url := supabase_url || '/functions/v1/zoho-sync-trigger',
                    headers := jsonb_build_object(
                        'Content-Type', 'application/json',
                        'Authorization', 'Bearer ' || service_role_key
                    ),
                    body := jsonb_build_object(
                        'manual', false,
                        'mapping_id', mapping_record.id,
                        'full_sync', false
                    )
                );
            
            IF response_status = 200 THEN
                success_count := success_count + 1;
            END IF;
            
            -- Log each cron-triggered sync
            INSERT INTO zoho_sync_jobs (
                job_type,
                status,
                metadata,
                created_by
            ) VALUES (
                'cron_sync',
                CASE 
                    WHEN response_status = 200 THEN 'triggered'
                    ELSE 'failed'
                END,
                jsonb_build_object(
                    'mapping_id', mapping_record.id,
                    'channel_name', mapping_record.zoho_channel_name,
                    'response_status', response_status,
                    'response_body', response_body,
                    'cron_schedule', cron_schedule,
                    'triggered_at', now()
                ),
                mapping_record.created_by
            );
        END LOOP;
    END IF;
    
    RETURN format('Cron sync completed: %s/%s successful (schedule: %s)', 
                  success_count, total_count, cron_schedule);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Create function to manage cron jobs
CREATE OR REPLACE FUNCTION manage_zoho_sync_crons(
    action text DEFAULT 'list', -- 'list', 'create', 'delete', 'pause', 'resume'
    job_name text DEFAULT '',
    cron_expression text DEFAULT '0 */6 * * *',
    mapping_id uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
    result jsonb;
    job_id bigint;
    cron_name text;
BEGIN
    CASE action
        WHEN 'list' THEN
            -- List all zoho sync cron jobs
            SELECT jsonb_agg(
                jsonb_build_object(
                    'job_id', jobid,
                    'job_name', jobname,
                    'schedule', schedule,
                    'command', command,
                    'active', active,
                    'nodename', nodename,
                    'database', database,
                    'username', username
                )
            ) INTO result
            FROM cron.job
            WHERE command LIKE '%trigger_zoho_sync_cron%';
            
            RETURN COALESCE(result, '[]'::jsonb);
            
        WHEN 'create' THEN
            -- Create new cron job
            cron_name := 'zoho_sync_' || COALESCE(mapping_id::text, 'all_active') || '_' || extract(epoch from now())::bigint;
            
            SELECT cron.schedule(
                job_name := cron_name,
                schedule := cron_expression,
                command := format(
                    'SELECT trigger_zoho_sync_cron(%L, %L)',
                    COALESCE(mapping_id::text, ''),
                    cron_expression
                )
            ) INTO job_id;
            
            RETURN jsonb_build_object(
                'status', 'created',
                'job_name', cron_name,
                'job_id', job_id,
                'schedule', cron_expression
            );
            
        WHEN 'delete' THEN
            -- Delete cron job by name
            IF job_name = '' THEN
                RETURN jsonb_build_object('error', 'Job name is required for deletion');
            END IF;
            
            SELECT cron.unschedule(job_name) INTO job_id;
            
            RETURN jsonb_build_object(
                'status', 'deleted',
                'job_name', job_name,
                'result', job_id
            );
            
        WHEN 'pause' THEN
            -- Pause cron job
            IF job_name = '' THEN
                RETURN jsonb_build_object('error', 'Job name is required for pause');
            END IF;
            
            PERFORM cron.alter_job(job_name, enabled := false);
            
            RETURN jsonb_build_object(
                'status', 'paused',
                'job_name', job_name
            );
            
        WHEN 'resume' THEN
            -- Resume cron job
            IF job_name = '' THEN
                RETURN jsonb_build_object('error', 'Job name is required for resume');
            END IF;
            
            PERFORM cron.alter_job(job_name, enabled := true);
            
            RETURN jsonb_build_object(
                'status', 'resumed',
                'job_name', job_name
            );
            
        ELSE
            RETURN jsonb_build_object('error', 'Invalid action. Use: list, create, delete, pause, resume');
    END CASE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Create default cron job for all active mappings (every 6 hours)
SELECT schedule_zoho_sync_cron('0 */6 * * *', NULL);

-- 7. Grant necessary permissions
GRANT EXECUTE ON FUNCTION auto_trigger_zoho_sync() TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_zoho_sync_cron(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION trigger_zoho_sync_cron(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION manage_zoho_sync_crons(text, text, text, uuid) TO authenticated;

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_zoho_sync_jobs_job_type ON zoho_sync_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_zoho_sync_jobs_status ON zoho_sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_zoho_sync_jobs_created_at ON zoho_sync_jobs(created_at);

-- 9. Create Zoho token refresh functions
CREATE OR REPLACE FUNCTION refresh_zoho_tokens()
RETURNS jsonb AS $$
DECLARE
    auth_record record;
    refresh_token text;
    client_id text;
    client_secret text;
    response_status integer;
    response_body text;
    new_access_token text;
    new_refresh_token text;
    expires_in integer;
    updated_count integer := 0;
    total_count integer := 0;
BEGIN
    -- Get Zoho OAuth configuration
    client_id := current_setting('app.settings.zoho_client_id', true);
    client_secret := current_setting('app.settings.zoho_client_secret', true);
    
    IF client_id IS NULL OR client_secret IS NULL THEN
        RETURN jsonb_build_object(
            'error', 'Zoho OAuth credentials not configured',
            'status', 'failed'
        );
    END IF;
    
    -- Process all Zoho auth records that need refresh
    FOR auth_record IN 
        SELECT 
            id,
            authenticated_by as user_id,
            refresh_token as zoho_refresh_token,
            access_token as zoho_access_token,
            expires_at as zoho_token_expires_at
        FROM zoho_auth
        WHERE refresh_token IS NOT NULL
        AND (
            expires_at IS NULL 
            OR expires_at <= (now() + interval '1 hour')
        )
    LOOP
        total_count := total_count + 1;
        
        -- Make refresh token request to Zoho
        SELECT 
            status,
            content
        INTO 
            response_status,
            response_body
        FROM 
            net.http_post(
                url := 'https://accounts.zoho.in/oauth/v2/token',
                headers := jsonb_build_object(
                    'Content-Type', 'application/x-www-form-urlencoded'
                ),
                body := format(
                    'refresh_token=%s&client_id=%s&client_secret=%s&grant_type=refresh_token',
                    auth_record.zoho_refresh_token,
                    client_id,
                    client_secret
                )
            );
        
        IF response_status = 200 THEN
            -- Parse successful response
            BEGIN
                new_access_token := (response_body::jsonb->>'access_token');
                new_refresh_token := COALESCE(response_body::jsonb->>'refresh_token', auth_record.zoho_refresh_token);
                expires_in := (response_body::jsonb->>'expires_in')::integer;
                
                -- Update the auth record
                UPDATE zoho_auth SET
                    access_token = new_access_token,
                    refresh_token = new_refresh_token,
                    expires_at = now() + (expires_in || ' seconds')::interval,
                    updated_at = now()
                WHERE id = auth_record.id;
                
                updated_count := updated_count + 1;
                
                -- Log successful refresh
                INSERT INTO zoho_sync_jobs (
                    job_type,
                    status,
                    metadata,
                    created_by
                ) VALUES (
                    'token_refresh',
                    'success',
                    jsonb_build_object(
                        'user_id', auth_record.user_id,
                        'expires_in', expires_in,
                        'new_expires_at', now() + (expires_in || ' seconds')::interval,
                        'refreshed_at', now()
                    ),
                    auth_record.user_id
                );
                
            EXCEPTION WHEN OTHERS THEN
                -- Log parsing error
                INSERT INTO zoho_sync_jobs (
                    job_type,
                    status,
                    metadata,
                    created_by
                ) VALUES (
                    'token_refresh',
                    'failed',
                    jsonb_build_object(
                        'user_id', auth_record.user_id,
                        'error', 'Failed to parse response: ' || SQLERRM,
                        'response_body', response_body,
                        'failed_at', now()
                    ),
                    auth_record.user_id
                );
            END;
        ELSE
            -- Log failed refresh
            INSERT INTO zoho_sync_jobs (
                job_type,
                status,
                metadata,
                created_by
            ) VALUES (
                'token_refresh',
                'failed',
                jsonb_build_object(
                    'user_id', auth_record.user_id,
                    'http_status', response_status,
                    'error_response', response_body,
                    'failed_at', now()
                ),
                auth_record.user_id
            );
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'status', 'completed',
        'total_processed', total_count,
        'successfully_refreshed', updated_count,
        'failed', total_count - updated_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create function to check token expiry status
CREATE OR REPLACE FUNCTION check_zoho_token_status()
RETURNS jsonb AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'user_id', za.user_id,
            'email', pu.email,
            'access_token', CASE 
                WHEN za.zoho_access_token IS NOT NULL THEN 'present'
                ELSE 'missing'
            END,
            'refresh_token', CASE 
                WHEN za.zoho_refresh_token IS NOT NULL THEN 'present'
                ELSE 'missing'
            END,
            'expires_at', za.expires_at,
            'status', CASE 
                            WHEN za.expires_at IS NULL THEN 'unknown'
            WHEN za.expires_at <= now() THEN 'expired'
            WHEN za.expires_at <= (now() + interval '1 hour') THEN 'expiring_soon'
                ELSE 'valid'
            END,
            'hours_until_expiry', CASE 
                            WHEN za.expires_at IS NOT NULL 
            THEN extract(epoch from (za.expires_at - now()))/3600
                ELSE NULL
            END
        )
    ) INTO result
    FROM zoho_auth za
    LEFT JOIN platform_users pu ON za.authenticated_by = pu.id
    ORDER BY za.expires_at ASC;
    
    RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Create cron job for automatic token refresh (every 12 hours)
SELECT cron.schedule(
    'zoho_token_refresh',
    '0 */12 * * *', -- Every 12 hours
    'SELECT refresh_zoho_tokens()'
);

-- 12. Grant permissions for new functions
GRANT EXECUTE ON FUNCTION refresh_zoho_tokens() TO authenticated;
GRANT EXECUTE ON FUNCTION check_zoho_token_status() TO authenticated;

-- 13. Create indexes for token refresh monitoring
CREATE INDEX IF NOT EXISTS idx_zoho_sync_jobs_token_refresh ON zoho_sync_jobs(job_type, status) WHERE job_type = 'token_refresh';
CREATE INDEX IF NOT EXISTS idx_zoho_auth_token_expiry ON zoho_auth(expires_at);

-- 14. Verification queries
SELECT 'Auto-trigger function created' as status
UNION ALL
SELECT 'Cron scheduling functions created' as status
UNION ALL
SELECT 'Default cron job scheduled (every 6 hours)' as status
UNION ALL
SELECT 'Trigger created on zoho_channel_mappings' as status
UNION ALL
SELECT 'Zoho token refresh functions created' as status
UNION ALL
SELECT 'Token refresh cron job scheduled (every 12 hours)' as status;
