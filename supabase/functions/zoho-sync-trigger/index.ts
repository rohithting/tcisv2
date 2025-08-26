// Zoho Cliq Manual Sync Trigger Edge Function
// Allows manual triggering of sync for specific channels
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { assertAuth, assertRoleIn } from '../_shared/auth.ts';

interface SyncTriggerRequest {
  mapping_id: string;
  full_sync?: boolean;
}

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    // Authenticate request and check permissions
    const { user, supabase } = await assertAuth(req);
    await assertRoleIn(supabase, user.id, ['super_admin', 'backend']);

    if (req.method !== 'POST') {
      return createCorsResponse({ error: 'Method not allowed' }, 405);
    }

    const requestData: SyncTriggerRequest = await req.json();

    if (!requestData.mapping_id) {
      return createCorsResponse({ error: 'mapping_id is required' }, 400);
    }

    // Verify the mapping exists and user has access
    const { data: mapping, error: mappingError } = await supabase
      .from('zoho_channel_mappings')
      .select(`
        *,
        clients!inner(*)
      `)
      .eq('id', requestData.mapping_id)
      .single();

    if (mappingError || !mapping) {
      return createCorsResponse({ error: 'Channel mapping not found' }, 404);
    }

    // Check client access
    const { data: clientAccess } = await supabase
      .rpc('has_client_access', { 
        user_id: user.id, 
        client_id: mapping.client_id 
      });

    if (!clientAccess && !['super_admin', 'backend'].includes(user.platform_role)) {
      return createCorsResponse({ error: 'No access to this client' }, 403);
    }

    // Trigger the sync by calling the zoho-sync function
    const syncResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/zoho-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
      },
      body: JSON.stringify({
        manual: true,
        mapping_id: requestData.mapping_id,
        full_sync: requestData.full_sync || false,
      }),
    });

    if (!syncResponse.ok) {
      const errorData = await syncResponse.text();
      throw new Error(`Sync trigger failed: ${syncResponse.status} - ${errorData}`);
    }

    const syncResult = await syncResponse.json();

    return createCorsResponse({
      success: true,
      message: 'Sync triggered successfully',
      result: syncResult,
    });

  } catch (error) {
    console.error('Error in zoho-sync-trigger:', error);
    return createCorsResponse({ error: error.message || 'Internal server error' }, 500);
  }
});
