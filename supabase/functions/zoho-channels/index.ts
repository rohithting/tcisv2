// Zoho Cliq Channels Management Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';

interface ZohoChannelListParams {
  limit?: number;
  level?: string;
  status?: string;
  joined?: boolean;
  next_token?: string;
}

interface CreateChannelMappingRequest {
  client_id: number;
  room_id: string;
  zoho_channel_id: string;
  zoho_chat_id: string;
  zoho_channel_name: string;
  zoho_unique_name?: string;
  zoho_organization_id?: string;
}

async function getZohoChannels(accessToken: string, params: ZohoChannelListParams = {}) {
  const searchParams = new URLSearchParams();
  searchParams.append('level', params.level || 'organization');
  searchParams.append('joined', 'true');
  searchParams.append('status', params.status || 'created');
  searchParams.append('limit', (params.limit || 50).toString());
  
  if (params.next_token) {
    searchParams.append('next_token', params.next_token);
  }

  const response = await fetch(`https://cliq.zoho.com/api/v2/channels?${searchParams.toString()}`, {
    headers: {
      'Authorization': `Zoho-oauthtoken ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch channels: ${response.status}`);
  }

  return await response.json();
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

    // Get Zoho auth
    const { data: authRecord, error: authError } = await supabase
      .from('zoho_auth')
      .select('*')
      .single();

    if (authError || !authRecord) {
      return new Response(
        JSON.stringify({ error: 'Zoho authentication not configured' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token is expired
    const expiresAt = new Date(authRecord.expires_at);
    if (new Date() >= expiresAt) {
      return new Response(
        JSON.stringify({ error: 'Zoho authentication has expired. Please refresh tokens.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method === 'GET') {
      // List Zoho channels
      const url = new URL(req.url);
      const params: ZohoChannelListParams = {
        limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!) : undefined,
        level: url.searchParams.get('level') || undefined,
        status: url.searchParams.get('status') || undefined,
        next_token: url.searchParams.get('next_token') || undefined,
      };

      const channelsData = await getZohoChannels(authRecord.access_token, params);

      // Get existing mappings to mark which channels are already mapped
      const { data: existingMappings } = await supabase
        .from('zoho_channel_mappings')
        .select('zoho_channel_id, client_id')
        .in('zoho_channel_id', channelsData.channels?.map((c: any) => c.channel_id) || []);

      const mappingMap = new Map(existingMappings?.map(m => [m.zoho_channel_id, m.client_id]) || []);

      // Transform channels for UI
      const transformedChannels = channelsData.channels?.map((channel: any) => ({
        channel_id: channel.channel_id,
        chat_id: channel.chat_id,
        name: channel.name,
        description: channel.description,
        level: channel.level,
        participant_count: channel.participant_count,
        unique_name: channel.unique_name,
        creator_name: channel.creator_name,
        creation_time: channel.creation_time,
        last_modified_time: channel.last_modified_time,
        is_mapped: mappingMap.has(channel.channel_id),
        mapped_to_client: mappingMap.get(channel.channel_id),
      })) || [];

      return new Response(
        JSON.stringify({
          channels: transformedChannels,
          has_more: channelsData.has_more || false,
          next_token: channelsData.next_token,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (req.method === 'POST') {
      // Create channel mapping
      const requestData: CreateChannelMappingRequest = await req.json();

      // Validate required fields
      if (!requestData.client_id || !requestData.room_id || !requestData.zoho_channel_id || !requestData.zoho_chat_id) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user has access to this client
      const { data: clientAccess } = await supabase
        .rpc('has_client_access', { 
          user_id: authResult.user.id, 
          client_id: requestData.client_id 
        });

      if (!clientAccess && platformUser.platform_role !== 'super_admin' && platformUser.platform_role !== 'backend') {
        return new Response(
          JSON.stringify({ error: 'No access to this client' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if channel is already mapped
      const { data: existingMapping } = await supabase
        .from('zoho_channel_mappings')
        .select('id')
        .eq('zoho_channel_id', requestData.zoho_channel_id)
        .single();

      if (existingMapping) {
        return new Response(
          JSON.stringify({ error: 'This channel is already mapped to another client' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create the mapping
      const { data: mapping, error: mappingError } = await supabase
        .from('zoho_channel_mappings')
        .insert({
          client_id: requestData.client_id,
          room_id: requestData.room_id,
          zoho_channel_id: requestData.zoho_channel_id,
          zoho_chat_id: requestData.zoho_chat_id,
          zoho_channel_name: requestData.zoho_channel_name,
          zoho_unique_name: requestData.zoho_unique_name,
          zoho_organization_id: requestData.zoho_organization_id,
          created_by: authResult.user.id,
          sync_status: 'active',
        })
        .select()
        .single();

      if (mappingError) {
        throw mappingError;
      }

      // Update the room to reference this mapping
      const { error: roomUpdateError } = await supabase
        .from('rooms')
        .update({ zoho_mapping_id: mapping.id })
        .eq('id', requestData.room_id);

      if (roomUpdateError) {
        throw roomUpdateError;
      }

      return new Response(
        JSON.stringify({ success: true, mapping }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in zoho-channels:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
