import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { handleCors, createCorsResponse } from "../_shared/cors.ts";
import { assertAuth, assertRoleIn } from "../_shared/auth.ts";

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return handleCors(req);
  }

  try {
    // Authenticate and authorize user
    const { user, supabase } = await assertAuth(req);
    await assertRoleIn(supabase, user.id, ['super_admin']);

    // Get the current Zoho auth record
    const { data: authRecord, error: authError } = await supabase
      .from('zoho_auth')
      .select('*')
      .single();

    if (authError || !authRecord) {
      return createCorsResponse({ error: 'No Zoho authentication found' }, 404);
    }

    // Revoke the refresh token with Zoho
    console.log('Revoking Zoho refresh token...');
    
    const revokeResponse = await fetch('https://accounts.zoho.in/oauth/v2/token/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        token: authRecord.refresh_token || authRecord.access_token, // Use refresh token if available, fallback to access token
      }),
    });

    console.log('Zoho revoke response status:', revokeResponse.status);
    
    if (!revokeResponse.ok) {
      const errorText = await revokeResponse.text();
      console.error('Zoho revoke failed:', revokeResponse.status, errorText);
      // Continue with local cleanup even if Zoho revoke fails
    } else {
      console.log('Zoho token revoked successfully');
    }

    // Delete the local auth record
    const { error: deleteError } = await supabase
      .from('zoho_auth')
      .delete()
      .eq('id', authRecord.id);

    if (deleteError) {
      console.error('Failed to delete local auth record:', deleteError);
      return createCorsResponse({ error: 'Failed to delete local authentication' }, 500);
    }

    return createCorsResponse({ 
      success: true, 
      message: 'Zoho access revoked successfully' 
    });

  } catch (error) {
    console.error('Error in zoho-revoke:', error);
    return createCorsResponse({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, 500);
  }
});
