// Zoho Cliq Connection Test Edge Function
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { authenticateRequest } from '../_shared/auth.ts';

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
    // Check if token is expired
    const expiresAt = new Date(authRecord.expires_at);
    const now = new Date();
    
    if (now >= expiresAt) {
      return { success: false, error: 'Access token has expired' };
    }

    // Test API call - get user's channels
    const response = await fetch('https://cliq.zoho.com/api/v2/channels?limit=5&level=organization&joined=true', {
      headers: {
        'Authorization': `Zoho-oauthtoken ${authRecord.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { 
        success: false, 
        error: `API call failed: ${response.status} - ${errorText}` 
      };
    }

    const data = await response.json();
    
    return { 
      success: true, 
      data: {
        channelCount: data.channels?.length || 0,
        hasMore: data.has_more || false,
        testTime: new Date().toISOString()
      }
    };
  } catch (error) {
    return { 
      success: false, 
      error: `Connection test failed: ${error.message}` 
    };
  }
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

    // Check if user is super admin
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: platformUser } = await supabase
      .from('platform_users')
      .select('platform_role')
      .eq('id', authResult.user.id)
      .single();

    if (!platformUser || platformUser.platform_role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions. Super admin access required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Zoho auth record
    const { data: authRecord, error: authError } = await supabase
      .from('zoho_auth')
      .select('*')
      .single();

    if (authError || !authRecord) {
      return new Response(
        JSON.stringify({ error: 'No Zoho authentication found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test the connection
    const testResult = await testZohoConnection(authRecord);

    return new Response(
      JSON.stringify(testResult),
      { 
        status: testResult.success ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in zoho-test-connection:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
