// Zoho Cliq Token Refresh Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { assertAuth, assertRoleIn } from '../_shared/auth.ts';
async function refreshZohoTokens(refreshToken, clientId, clientSecret) {
  console.log('Making token refresh request to Zoho...');
  const response = await fetch('https://accounts.zoho.in/oauth/v2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret
    })
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Token refresh failed: ${response.status} - ${errorText}`);
    throw new Error(`Token refresh failed: ${response.status}`);
  }
  const data = await response.json();
  console.log('Token refresh successful');
  return data;
}
serve(async (req)=>{
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }
  try {
    // Authenticate request and check permissions
    const { user, supabase } = await assertAuth(req);
    await assertRoleIn(supabase, user.id, [
      'super_admin'
    ]);
    if (req.method !== 'POST') {
      return createCorsResponse({
        error: 'Method not allowed'
      }, 405);
    }
    const requestData = await req.json();
    const action = requestData.action || 'refresh';
    console.log('Request action:', action);
    console.log('Request data keys:', Object.keys(requestData));
    if (action === 'exchange_code') {
      // Exchange authorization code for initial tokens
      console.log('Exchanging authorization code for tokens...');
      const { grant_type, client_id, client_secret, redirect_uri, code } = requestData;
      if (!client_id || !client_secret || !redirect_uri || !code) {
        return createCorsResponse({
          error: 'Missing required fields for token exchange'
        }, 400);
      }
      const tokenData = {
        grant_type: 'authorization_code',
        client_id,
        client_secret,
        redirect_uri,
        code
      };
      const response = await fetch('https://accounts.zoho.in/oauth/v2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(tokenData)
      });
      const data = await response.json();
      console.log('Token exchange response:', {
        status: response.status,
        has_access_token: !!data.access_token,
        has_refresh_token: !!data.refresh_token,
        error: data.error
      });
      if (!response.ok || data.error) {
        return createCorsResponse({
          error: data.error_description || data.error || 'Token exchange failed'
        }, 400);
      }
      // Save or update the auth record
      const expiresAt = new Date(Date.now() + data.expires_in * 1000);
      const authRecord = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt.toISOString(),
        scope: data.scope,
        client_id,
        client_secret,
        auto_refresh_enabled: true,
        refresh_error_count: 0,
        authenticated_by: user.id,
        updated_at: new Date().toISOString()
      };
      // Use upsert to handle both insert and update cases
      console.log('Upserting Zoho auth record...');
      // First, try to delete any existing records (since we can only have one)
      await supabase.from('zoho_auth').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      // Then insert the new record
      const { error: dbError } = await supabase.from('zoho_auth').insert(authRecord);
      if (dbError) {
        console.error('Database error:', dbError);
        throw dbError;
      }
      return createCorsResponse(data);
    } else {
      // Refresh existing tokens
      console.log('Refreshing existing tokens...');
      // Get current Zoho auth record
      const { data: authRecord, error: authError } = await supabase.from('zoho_auth').select('*').single();
      if (authError || !authRecord) {
        return createCorsResponse({
          error: 'No Zoho authentication found'
        }, 404);
      }
      // Refresh the tokens
      const tokenData = await refreshZohoTokens(authRecord.refresh_token, authRecord.client_id, authRecord.client_secret);
      if (tokenData.error) {
        return createCorsResponse({
          error: tokenData.error_description || tokenData.error
        }, 400);
      }
      // Update the auth record
      const { error: updateError } = await supabase.from('zoho_auth').update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || authRecord.refresh_token,
        expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        scope: tokenData.scope,
        updated_at: new Date().toISOString()
      }).eq('id', authRecord.id);
      if (updateError) {
        throw updateError;
      }
      return createCorsResponse({
        success: true,
        message: 'Tokens refreshed successfully',
        expires_in: tokenData.expires_in
      });
    }
  } catch (error) {
    console.error('Error in zoho-refresh-tokens:', error);
    return createCorsResponse({
      error: error.message || 'Internal server error'
    }, 500);
  }
});
