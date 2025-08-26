// Zoho Cliq Connection Test Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors, createCorsResponse } from '../_shared/cors.ts';
import { assertAuth, assertRoleIn } from '../_shared/auth.ts';

interface ZohoAuthRecord {
  id: number;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string;
  authenticated_by: string;
  organization_id?: string;
}

async function testZohoConnection(authRecord: ZohoAuthRecord): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    console.log('Starting real Zoho API connection test...');
    
    // Test 1: Get user's channels (basic API access)
    console.log('Test 1: Testing channels API endpoint...');
    const channelsResponse = await fetch('https://cliq.zoho.com/api/v2/channels?limit=1&level=organization&joined=true', {
      headers: {
        'Authorization': `Zoho-oauthtoken ${authRecord.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!channelsResponse.ok) {
      const errorText = await channelsResponse.text();
      console.error('Channels API test failed:', channelsResponse.status, errorText);
      return { 
        success: false, 
        error: `Channels API test failed: ${channelsResponse.status} - ${errorText}` 
      };
    }

    const channelsData = await channelsResponse.json();
    console.log('Channels API test passed:', {
      status: channelsResponse.status,
      channels_count: channelsData.channels?.length || 0
    });

    // Test 2: Get user's profile (authentication verification)
    console.log('Test 2: Testing user profile API endpoint...');
    const profileResponse = await fetch('https://cliq.zoho.com/api/v2/users/me', {
      headers: {
        'Authorization': `Zoho-oauthtoken ${authRecord.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error('Profile API test failed:', profileResponse.status, errorText);
      return { 
        success: false, 
        error: `Profile API test failed: ${profileResponse.status} - ${errorText}` 
      };
    }

    const profileData = await profileResponse.json();
    console.log('Profile API test passed:', {
      status: profileResponse.status,
      user_id: profileData.user_id,
      name: profileData.name
    });

    // Test 3: Get organization info (scope verification)
    console.log('Test 3: Testing organization API endpoint...');
    const orgResponse = await fetch('https://cliq.zoho.com/api/v2/organizations', {
      headers: {
        'Authorization': `Zoho-oauthtoken ${authRecord.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!orgResponse.ok) {
      const errorText = await orgResponse.text();
      console.error('Organization API test failed:', orgResponse.status, errorText);
      return { 
        success: false, 
        error: `Organization API test failed: ${orgResponse.status} - ${errorText}` 
      };
    }

    const orgData = await orgResponse.json();
    console.log('Organization API test passed:', {
      status: orgResponse.status,
      org_count: orgData.organizations?.length || 0
    });
    
    console.log('All API tests passed! Zoho connection is working.');
    return { 
      success: true, 
      message: 'Real Zoho Cliq API connection test successful',
      test_results: {
        channels_api: 'PASSED',
        profile_api: 'PASSED', 
        organization_api: 'PASSED'
      },
      channels_count: channelsData.channels?.length || 0,
      user_info: {
        user_id: profileData.user_id,
        name: profileData.name
      },
      organization_count: orgData.organizations?.length || 0,
      test_timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Connection test failed with exception:', error);
    return { 
      success: false, 
      error: `Connection test failed: ${error.message}` 
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  const corsResponse = handleCors(req);
  if (corsResponse) {
    return corsResponse;
  }

  try {
    // Authenticate request and check permissions
    const { user, supabase } = await assertAuth(req);
    await assertRoleIn(supabase, user.id, ['super_admin']);

    if (req.method !== 'POST') {
      return createCorsResponse({ error: 'Method not allowed' }, 405);
    }

    // Get Zoho auth record
    console.log('Fetching Zoho auth record...');
    const { data: authRecord, error: authError } = await supabase
      .from('zoho_auth')
      .select('*')
      .single();

    if (authError || !authRecord) {
      console.error('Auth record error:', authError);
      return createCorsResponse({ error: 'No Zoho authentication found' }, 404);
    }

    console.log('Auth record found:', {
      id: authRecord.id,
      has_access_token: !!authRecord.access_token,
      has_refresh_token: !!authRecord.refresh_token,
      expires_at: authRecord.expires_at,
      is_expired: new Date() >= new Date(authRecord.expires_at)
    });

    // Test the connection
    const testResult = await testZohoConnection(authRecord);

    return createCorsResponse(testResult, testResult.success ? 200 : 400);

  } catch (error) {
    console.error('Error in zoho-test-connection:', error);
    return createCorsResponse({ error: 'Internal server error' }, 500);
  }
});
