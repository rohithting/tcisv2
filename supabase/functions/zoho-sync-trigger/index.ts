// Zoho Cliq Manual Sync Trigger Edge Function
// Allows manual triggering of sync for specific channels
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';

interface SyncTriggerRequest {
  mapping_id: string;
  full_sync?: boolean;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Authenticate request
    const authResult = await authenticateRequest(req);
    if (!authResult.success || !authResult.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user has appropriate permissions
    const { data: platformUser } = await supabase
      .from('platform_users')
      .select('platform_role')
      .eq('id', authResult.user.id)
      .single();

    if (!platformUser || !['super_admin', 'backend'].includes(platformUser.platform_role)) {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Super admin or backend access required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestData: SyncTriggerRequest = await req.json();

    if (!requestData.mapping_id) {
      return new Response(
        JSON.stringify({ error: 'mapping_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: 'Channel mapping not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check client access
    const { data: clientAccess } = await supabase
      .rpc('has_client_access', { 
        user_id: authResult.user.id, 
        client_id: mapping.client_id 
      });

    if (!clientAccess && platformUser.platform_role !== 'super_admin' && platformUser.platform_role !== 'backend') {
      return new Response(
        JSON.stringify({ error: 'No access to this client' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Sync triggered successfully',
        result: syncResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in zoho-sync-trigger:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
