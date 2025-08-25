/**
 * CORS utility functions for Supabase Edge Functions
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-corr-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

/**
 * Handle CORS preflight requests
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }
  return null;
}

/**
 * Add CORS headers to any response
 */
export function addCorsHeaders(response: Response): Response {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

/**
 * Create a CORS-enabled response
 */
export function createCorsResponse(
  body: string | object,
  status: number = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  const headers = { ...corsHeaders, ...additionalHeaders };
  
  if (typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
    return new Response(JSON.stringify(body), { status, headers });
  }
  
  return new Response(body, { status, headers });
}
