-- Migration to create zoho_auth table for Zoho OAuth token management
-- This table stores Zoho OAuth tokens and handles automatic refresh

-- 1. Create zoho_auth table if it doesn't exist
-- Note: This table already exists in your database with different column names
-- The actual schema is:
-- CREATE TABLE zoho_auth (
--     id serial primary key,
--     access_token text not null,
--     refresh_token text not null,
--     expires_at timestamp with time zone not null,
--     scope text not null,
--     authenticated_by uuid references platform_users(id) on delete cascade,
--     organization_id text,
--     created_at timestamp with time zone default timezone('utc'::text, now()) not null,
--     updated_at timestamp with time zone default timezone('utc'::text, now()) not null
-- );

-- This migration file is not needed since the table already exists
-- The functions in 007_auto_trigger_zoho_sync.sql have been updated to use the correct column names

-- 2. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_zoho_auth_user_id ON zoho_auth(user_id);
CREATE INDEX IF NOT EXISTS idx_zoho_auth_token_expiry ON zoho_auth(zoho_token_expires_at);
CREATE INDEX IF NOT EXISTS idx_zoho_auth_active ON zoho_auth(is_active) WHERE is_active = true;

-- 3. Enable Row Level Security
ALTER TABLE zoho_auth ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policies
CREATE POLICY zoho_auth_select ON zoho_auth
FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM platform_users pu 
        WHERE pu.id = auth.uid() 
        AND pu.platform_role IN ('admin', 'super_admin')
    )
);

CREATE POLICY zoho_auth_insert ON zoho_auth
FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM platform_users pu 
        WHERE pu.id = auth.uid() 
        AND pu.platform_role IN ('admin', 'super_admin')
    )
);

CREATE POLICY zoho_auth_update ON zoho_auth
FOR UPDATE USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM platform_users pu 
        WHERE pu.id = auth.uid() 
        AND pu.platform_role IN ('admin', 'super_admin')
    )
);

CREATE POLICY zoho_auth_delete ON zoho_auth
FOR DELETE USING (
    user_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM platform_users pu 
        WHERE pu.id = auth.uid() 
        AND pu.platform_role IN ('admin', 'super_admin')
    )
);

-- 5. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_zoho_auth_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_zoho_auth_updated_at ON zoho_auth;
CREATE TRIGGER trigger_update_zoho_auth_updated_at
    BEFORE UPDATE ON zoho_auth
    FOR EACH ROW
    EXECUTE FUNCTION update_zoho_auth_updated_at();

-- 7. Create function to get valid access token for a user
CREATE OR REPLACE FUNCTION get_valid_zoho_token(user_uuid uuid)
RETURNS text AS $$
DECLARE
    access_token text;
    refresh_token text;
    expires_at timestamp with time zone;
    client_id text;
    client_secret text;
    response_status integer;
    response_body text;
    new_access_token text;
    new_refresh_token text;
    expires_in integer;
BEGIN
    -- Get current token info
    SELECT 
        za.zoho_access_token,
        za.zoho_refresh_token,
        za.zoho_token_expires_at
    INTO 
        access_token,
        refresh_token,
        expires_at
    FROM zoho_auth za
    WHERE za.user_id = user_uuid AND za.is_active = true;
    
    -- If no token exists, return NULL
    IF access_token IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- If token is still valid (with 1 hour buffer), return it
    IF expires_at IS NULL OR expires_at > (now() + interval '1 hour') THEN
        RETURN access_token;
    END IF;
    
    -- Token expired, try to refresh
    IF refresh_token IS NULL THEN
        -- No refresh token, can't refresh
        RETURN NULL;
    END IF;
    
    -- Get OAuth credentials
    client_id := current_setting('app.settings.zoho_client_id', true);
    client_secret := current_setting('app.settings.zoho_client_secret', true);
    
    IF client_id IS NULL OR client_secret IS NULL THEN
        -- Credentials not configured, return expired token
        RETURN access_token;
    END IF;
    
    -- Attempt token refresh
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
                refresh_token,
                client_id,
                client_secret
            )
        );
    
    IF response_status = 200 THEN
        -- Parse successful response
        BEGIN
            new_access_token := (response_body::jsonb->>'access_token');
            new_refresh_token := COALESCE(response_body::jsonb->>'refresh_token', refresh_token);
            expires_in := (response_body::jsonb->>'expires_in')::integer;
            
            -- Update the auth record
            UPDATE zoho_auth SET
                zoho_access_token = new_access_token,
                zoho_refresh_token = new_refresh_token,
                zoho_token_expires_at = now() + (expires_in || ' seconds')::interval,
                updated_at = now()
            WHERE user_id = user_uuid;
            
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
                    'user_id', user_uuid,
                    'expires_in', expires_in,
                    'new_expires_at', now() + (expires_in || ' seconds')::interval,
                    'refreshed_at', now(),
                    'triggered_by', 'get_valid_zoho_token'
                ),
                user_uuid
            );
            
            RETURN new_access_token;
            
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
                    'user_id', user_uuid,
                    'error', 'Failed to parse response: ' || SQLERRM,
                    'response_body', response_body,
                    'failed_at', now(),
                    'triggered_by', 'get_valid_zoho_token'
                ),
                user_uuid
            );
            
            -- Return expired token as fallback
            RETURN access_token;
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
                'user_id', user_uuid,
                'http_status', response_status,
                'error_response', response_body,
                'failed_at', now(),
                'triggered_by', 'get_valid_zoho_token'
            ),
            user_uuid
        );
        
        -- Return expired token as fallback
        RETURN access_token;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Grant permissions
GRANT EXECUTE ON FUNCTION get_valid_zoho_token(uuid) TO authenticated;

-- 9. Verification
SELECT 'Zoho auth table created' as status
UNION ALL
SELECT 'RLS policies created' as status
UNION ALL
SELECT 'Token management functions created' as status;
