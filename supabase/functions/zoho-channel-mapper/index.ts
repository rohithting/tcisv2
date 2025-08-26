// Zoho Cliq Channel Mapper Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { assertAuth, assertRoleIn } from '../_shared/auth.ts';

async function getZohoChannels(accessToken, params = {}) {
  // Clean the access token
  const cleanToken = accessToken?.trim();
  console.log('getZohoChannels called with:', {
    token_length: cleanToken?.length,
    token_preview: cleanToken?.substring(0, 30) + '...',
    params: params
  });
  
  const searchParams = new URLSearchParams();
  searchParams.append('level', params.level || 'organization');
  // Only add 'joined' filter if explicitly requested
  if (params.include_joined === 'true') {
    searchParams.append('joined', 'true');
  }
  if (params.status) {
    searchParams.append('status', params.status);
  }
  searchParams.append('limit', (params.limit || 100).toString());
  if (params.next_token) {
    searchParams.append('next_token', params.next_token);
  }
  
  const apiUrl = `https://cliq.zoho.in/api/v2/channels?${searchParams.toString()}`;
  console.log('Making API request to:', apiUrl);
  
  const response = await fetch(apiUrl, {
    headers: {
      'Authorization': `Zoho-oauthtoken ${cleanToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  console.log('Zoho API response:', {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries())
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Zoho API error: ${response.status} - ${errorText}`);
    throw new Error(`Zoho API call failed: ${response.status} - ${errorText}`);
  }
  
  const responseData = await response.json();
  console.log('Zoho API success:', {
    channels_count: responseData.channels?.length || 0,
    has_more: responseData.has_more,
    next_token: responseData.next_token
  });
  
  return responseData;
}

async function getZohoChannelByPermalink(accessToken, permalink) {
  // Clean the access token
  const cleanToken = accessToken?.trim();
  console.log('getZohoChannelByPermalink called with:', {
    token_length: cleanToken?.length,
    token_preview: cleanToken?.substring(0, 30) + '...',
    permalink: permalink
  });
  
  // Extract channel information from permalink
  // Zoho Cliq permalinks look like: https://cliq.ting.in/company/60021694582/channels/announcements
  const permalinkMatch = permalink.match(/https:\/\/cliq\.ting\.in\/company\/(\d+)\/channels\/([^\/\?]+)/);
  if (!permalinkMatch) {
    throw new Error('Invalid Zoho Cliq permalink format. Expected format: https://cliq.ting.in/company/COMPANY_ID/channels/CHANNEL_NAME');
  }
  
  const companyId = permalinkMatch[1];
  const channelName = permalinkMatch[2];
  console.log('Extracted from permalink:', { companyId, channelName });
  
  // First, search for channels by name to find the channel ID
  const searchParams = new URLSearchParams({
    name: channelName,
    level: 'organization',
    limit: 100
  });
  
  const searchUrl = `https://cliq.zoho.in/api/v2/channels?${searchParams.toString()}`;
  console.log('Searching for channel by name:', searchUrl);
  
  const searchResponse = await fetch(searchUrl, {
    headers: {
      'Authorization': `Zoho-oauthtoken ${cleanToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    console.error(`Channel search failed: ${searchResponse.status} - ${errorText}`);
    throw new Error(`Channel search failed: ${searchResponse.status} - ${errorText}`);
  }
  
  const searchData = await searchResponse.json();
  console.log('Search results:', {
    channels_count: searchData.channels?.length || 0
  });
  
  // Find the channel that matches the name
  const matchingChannel = searchData.channels?.find(channel => 
    channel.name.toLowerCase() === channelName.toLowerCase() ||
    channel.unique_name === channelName
  );
  
  if (!matchingChannel) {
    throw new Error(`Channel "${channelName}" not found in your organization`);
  }
  
  console.log('Found matching channel:', {
    channel_id: matchingChannel.channel_id,
    name: matchingChannel.name,
    unique_name: matchingChannel.unique_name
  });
  
  // Return the found channel data
  return matchingChannel;
}

async function refreshZohoToken(supabase, authRecord) {
  try {
    console.log('Attempting to refresh Zoho token...');
    // Check if we have the required data for refresh
    if (!authRecord.refresh_token || !authRecord.client_id || !authRecord.client_secret) {
      console.error('Missing refresh token or client credentials');
      return null;
    }
    
    const tokenData = {
      refresh_token: authRecord.refresh_token.trim(),
      client_id: authRecord.client_id.trim(),
      client_secret: authRecord.client_secret.trim(),
      grant_type: 'refresh_token'
    };
    
    console.log('Token refresh request:', {
      client_id: tokenData.client_id,
      has_refresh_token: !!tokenData.refresh_token,
      refresh_token_length: tokenData.refresh_token.length
    });
    
    const response = await fetch('https://accounts.zoho.in/oauth/v2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(tokenData)
    });
    
    const data = await response.json();
    console.log('Token refresh response:', {
      status: response.status,
      has_access_token: !!data.access_token,
      access_token_length: data.access_token?.length,
      expires_in: data.expires_in,
      error: data.error,
      error_description: data.error_description
    });
    
    if (!response.ok || data.error) {
      console.error(`Token refresh failed: ${response.status}`, data);
      // Increment error count
      await supabase.from('zoho_auth').update({
        refresh_error_count: (authRecord.refresh_error_count || 0) + 1,
        last_refresh_attempt: new Date().toISOString()
      }).eq('id', authRecord.id);
      return null;
    }
    
    if (!data.access_token) {
      console.error('No access token in refresh response');
      return null;
    }
    
    // Validate expires_in before using it
    const expiresIn = parseInt(data.expires_in) || 3600; // Default to 1 hour if invalid
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    
    const { error: updateError } = await supabase.from('zoho_auth').update({
      access_token: data.access_token.trim(),
      refresh_token: data.refresh_token?.trim() || authRecord.refresh_token,
      expires_at: expiresAt.toISOString(),
      refresh_error_count: 0,
      last_refresh_attempt: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', authRecord.id);
    
    if (updateError) {
      console.error('Failed to update auth record:', updateError);
      return null;
    }
    
    console.log('Token refreshed successfully');
    return data.access_token.trim();
  } catch (error) {
    console.error('Token refresh error:', error);
    // Increment error count
    try {
      await supabase.from('zoho_auth').update({
        refresh_error_count: (authRecord.refresh_error_count || 0) + 1,
        last_refresh_attempt: new Date().toISOString()
      }).eq('id', authRecord.id);
    } catch (dbError) {
      console.error('Failed to update error count:', dbError);
    }
    return null;
  }
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
    await assertRoleIn(supabase, user.id, [
      'super_admin',
      'backend'
    ]);
    
    // Get Zoho auth
    const { data: authRecord, error: authError } = await supabase.from('zoho_auth').select('*').single();
    if (authError || !authRecord) {
      console.error('Zoho auth error:', authError);
      return createCorsResponse({
        error: 'Zoho authentication not configured. Please authenticate first.'
      }, 404);
    }
    
    console.log('Zoho auth record found:', {
      id: authRecord.id,
      has_access_token: !!authRecord.access_token,
      has_refresh_token: !!authRecord.refresh_token,
      has_client_credentials: !!(authRecord.client_id && authRecord.client_secret),
      expires_at: authRecord.expires_at,
      is_expired: new Date() >= new Date(authRecord.expires_at),
      scope: authRecord.scope,
      refresh_error_count: authRecord.refresh_error_count || 0
    });
    
    // Check for too many refresh errors
    if ((authRecord.refresh_error_count || 0) >= 5) {
      return createCorsResponse({
        error: 'Too many token refresh failures. Please re-authenticate in Settings > Integrations > Zoho Cliq.'
      }, 401);
    }
    
    // Function to get channels with automatic token refresh
    const getChannelsWithRefresh = async (params) => {
      let accessToken = authRecord.access_token?.trim();
      
      // Check if token is expired or will expire soon (within 5 minutes)
      const expiresAt = new Date(authRecord.expires_at);
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
      
      console.log('Token expiry check:', {
        expires_at: expiresAt.toISOString(),
        current_time: now.toISOString(),
        is_expired: now >= expiresAt,
        expires_soon: fiveMinutesFromNow >= expiresAt
      });
      
      // If token is expired or expires soon, try to refresh
      if (now >= expiresAt || fiveMinutesFromNow >= expiresAt) {
        console.log('Token expired or expires soon, attempting refresh...');
        const newToken = await refreshZohoToken(supabase, authRecord);
        if (newToken) {
          accessToken = newToken;
          console.log('Using refreshed token');
        } else {
          console.log('Token refresh failed, will try with existing token');
        }
      }
      
      try {
        return await getZohoChannels(accessToken, params);
      } catch (error) {
        console.error('API call failed:', error.message);
        // If we get a 401 error, try refreshing the token once
        if (error.message.includes('401') && !error.message.includes('already_refreshed')) {
          console.log('Got 401 error, attempting token refresh...');
          const newToken = await refreshZohoToken(supabase, authRecord);
          if (newToken) {
            console.log('Retry with refreshed token');
            // Mark this error to avoid infinite retry
            error.message += ' (already_refreshed)';
            return await getZohoChannels(newToken, params);
          }
        }
        // If token refresh failed or we still get 401, user needs to re-authenticate
        if (error.message.includes('401')) {
          throw new Error('Zoho authentication has expired or is invalid. Please go to Settings > Integrations > Zoho Cliq and re-authenticate.');
        }
        throw error;
      }
    };
    
    // Function to get specific channel with automatic token refresh
    const getChannelByPermalinkWithRefresh = async (permalink) => {
      let accessToken = authRecord.access_token?.trim();
      
      // Check if token is expired or will expire soon (within 5 minutes)
      const expiresAt = new Date(authRecord.expires_at);
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
      
      console.log('Token expiry check:', {
        expires_at: expiresAt.toISOString(),
        current_time: now.toISOString(),
        is_expired: now >= expiresAt,
        expires_soon: fiveMinutesFromNow >= expiresAt
      });
      
      // If token is expired or expires soon, try to refresh
      if (now >= expiresAt || fiveMinutesFromNow >= expiresAt) {
        console.log('Token expired or expires soon, attempting refresh...');
        const newToken = await refreshZohoToken(supabase, authRecord);
        if (newToken) {
          accessToken = newToken;
          console.log('Using refreshed token');
        } else {
          console.log('Token refresh failed, will try with existing token');
        }
      }
      
      try {
        return await getZohoChannelByPermalink(accessToken, permalink);
      } catch (error) {
        console.error('API call failed:', error.message);
        // If we get a 401 error, try refreshing the token once
        if (error.message.includes('401') && !error.message.includes('already_refreshed')) {
          console.log('Got 401 error, attempting token refresh...');
          const newToken = await refreshZohoToken(supabase, authRecord);
          if (newToken) {
            console.log('Retry with refreshed token');
            // Mark this error to avoid infinite retry
            error.message += ' (already_refreshed)';
            return await getZohoChannelByPermalink(newToken, permalink);
          }
        }
        // If token refresh failed or we still get 401, user needs to re-authenticate
        if (error.message.includes('401')) {
          throw new Error('Zoho authentication has expired or is invalid. Please go to Settings > Integrations > Zoho Cliq and re-authenticate.');
        }
        throw error;
      }
    };
    
    if (req.method === 'POST') {
      const requestData = await req.json();
      console.log('POST request action:', requestData.action);
      
      if (requestData.action === 'list_channels') {
        // List Zoho channels (same as zoho-channels)
        const params = requestData.params || {};
        console.log('POST list_channels params:', params);
        
        const channelsData = await getChannelsWithRefresh(params);
        
        // Get existing mappings to mark which channels are already mapped
        const channelIds = channelsData.channels?.map((c) => c.channel_id) || [];
        const { data: existingMappings } = await supabase.from('zoho_channel_mappings').select('zoho_channel_id, client_id').in('zoho_channel_id', channelIds);
        const mappingMap = new Map(existingMappings?.map((m) => [
          m.zoho_channel_id,
          m.client_id
        ]) || []);
        
        // Transform channels for UI
        const transformedChannels = channelsData.channels?.map((channel) => ({
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
          mapped_to_client: mappingMap.get(channel.channel_id)
        })) || [];
        
        return createCorsResponse({
          channels: transformedChannels,
          has_more: channelsData.has_more || false,
          next_token: channelsData.next_token
        });
        
      } else if (requestData.action === 'get_channel_by_permalink') {
        // Get specific channel by permalink
        const { permalink } = requestData;
        
        if (!permalink) {
          return createCorsResponse({
            error: 'Missing required field: permalink'
          }, 400);
        }
        
        console.log('Getting channel by permalink:', permalink);
        
        try {
          const channelData = await getChannelByPermalinkWithRefresh(permalink);
          
          // Check if channel is already mapped
          const { data: existingMapping } = await supabase.from('zoho_channel_mappings').select('id, client_id').eq('zoho_channel_id', channelData.channel_id).single();
          
          // Transform channel for UI
          const transformedChannel = {
            channel_id: channelData.channel_id,
            chat_id: channelData.chat_id,
            name: channelData.name,
            description: channelData.description,
            level: channelData.level,
            participant_count: channelData.participant_count,
            unique_name: channelData.unique_name,
            creator_name: channelData.creator_name,
            creation_time: channelData.creation_time,
            last_modified_time: channelData.last_modified_time,
            is_mapped: !!existingMapping,
            mapped_to_client: existingMapping?.client_id || null,
            permalink: permalink
          };
          
          return createCorsResponse({
            channel: transformedChannel,
            message: 'Channel retrieved successfully'
          });
          
        } catch (error) {
          console.error('Error getting channel by permalink:', error);
          return createCorsResponse({
            error: error.message || 'Failed to retrieve channel'
          }, 400);
        }
        
      } else {
        return createCorsResponse({
          error: 'Invalid action. Use "list_channels" or "get_channel_by_permalink"'
        }, 400);
      }
      
    } else {
      return createCorsResponse({
        error: 'Method not allowed. Use POST'
      }, 405);
    }
    
  } catch (error) {
    console.error('Error in zoho-channel-mapper:', error);
    return createCorsResponse({
      error: error.message || 'Internal server error'
    }, 500);
  }
});
