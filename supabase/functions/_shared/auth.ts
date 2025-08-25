import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { addCorsHeaders } from './cors.ts';

export interface AuthUser {
  id: string;
  email: string;
  platform_role: string;
}

export interface AuthContext {
  user: AuthUser;
  supabase: any;
}

/**
 * Initialize Supabase client for server-side operations
 */
export function createSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        persistSession: false,
      },
    }
  );
}

/**
 * Extract and validate JWT token from request headers
 */
export async function assertAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Response(
      JSON.stringify({
        error_code: 'E_UNAUTHORIZED',
        message: 'Missing or invalid authorization header',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const token = authHeader.replace('Bearer ', '');
  
  // Create a client with the user's JWT token
  const userSupabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      auth: {
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  // Validate the JWT token by getting user info
  const { data: { user }, error } = await userSupabase.auth.getUser();
  
  if (error || !user) {
    throw new Response(
      JSON.stringify({
        error_code: 'E_UNAUTHORIZED',
        message: 'Invalid or expired token',
        details: error?.message,
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get platform user details using service role client
  const supabase = createSupabaseClient();
  const { data: platformUser, error: platformError } = await supabase
    .from('platform_users')
    .select('platform_role')
    .eq('id', user.id)
    .single();

  if (platformError) {
    console.error('Platform user lookup error:', platformError);
    throw new Response(
      JSON.stringify({
        error_code: 'E_UNAUTHORIZED',
        message: 'Platform user not found',
        details: platformError.message,
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return {
    user: {
      id: user.id,
      email: user.email || '',
      platform_role: platformUser.platform_role || 'user',
    },
    supabase,
  };
}

/**
 * Check if user has access to a specific client
 */
export async function assertClientAccess(
  supabase: any,
  clientId: string,
  userId: string,
  requiredRole: string = 'viewer'
): Promise<void> {
  // Check if user is platform admin
  const { data: user, error: userError } = await supabase
    .from('platform_users')
    .select('platform_role')
    .eq('id', userId)
    .single();

  if (userError) {
    throw new Response(
      JSON.stringify({
        error_code: 'E_UNAUTHORIZED',
        message: 'User not found',
        details: userError.message,
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Platform admins have access to all clients
  if (user.platform_role === 'admin') {
    return;
  }

  // Check client-specific access
  const { data: access, error: accessError } = await supabase
    .from('user_client_access')
    .select('role')
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .single();

  if (accessError || !access) {
    throw new Response(
      JSON.stringify({
        error_code: 'E_FORBIDDEN_CLIENT',
        message: 'No access to this client',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check role hierarchy
  const roleHierarchy = {
    'viewer': 1,
    'editor': 2,
    'admin': 3,
  };

  const userRoleLevel = roleHierarchy[access.role as keyof typeof roleHierarchy] || 0;
  const requiredRoleLevel = roleHierarchy[requiredRole as keyof typeof roleHierarchy] || 0;

  if (userRoleLevel < requiredRoleLevel) {
    throw new Response(
      JSON.stringify({
        error_code: 'E_FORBIDDEN_ROLE',
        message: `Role '${access.role}' not sufficient. Required: ${requiredRole}`,
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Check if user is platform admin
 */
export async function assertPlatformAdmin(supabase: any, userId: string): Promise<void> {
  const { data: user, error } = await supabase
    .from('platform_users')
    .select('platform_role')
    .eq('id', userId)
    .single();

  if (error || !user || user.platform_role !== 'admin') {
    throw new Response(
      JSON.stringify({
        error_code: 'E_FORBIDDEN_ROLE',
        message: 'Platform admin access required',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Check if user has a specific role
 */
export async function assertRoleIn(
  supabase: any,
  userId: string,
  allowedRoles: string[]
): Promise<void> {
  const { data: user, error } = await supabase
    .from('platform_users')
    .select('platform_role')
    .eq('id', userId)
    .single();

  if (error || !user || !allowedRoles.includes(user.platform_role)) {
    throw new Response(
      JSON.stringify({
        error_code: 'E_FORBIDDEN_ROLE',
        message: `Role '${user?.platform_role || 'unknown'}' not allowed. Required: ${allowedRoles.join(', ')}`,
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Check if user can create clients
 */
export async function assertCanCreateClient(supabase: any, userId: string): Promise<void> {
  const { data: user, error } = await supabase
    .from('platform_users')
    .select('platform_role')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new Response(
      JSON.stringify({
        error_code: 'E_UNAUTHORIZED',
        message: 'User not found',
        details: error?.message,
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Platform admins and backend users can create clients
  if (user.platform_role === 'admin' || user.platform_role === 'super_admin' || user.platform_role === 'backend') {
    return;
  }

  // Other roles cannot create clients
  throw new Response(
    JSON.stringify({
      error_code: 'E_FORBIDDEN_ROLE',
      message: 'Client creation not allowed for this user role',
    }),
    { status: 403, headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Generate correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Create standardized error response
 */
export function createErrorResponse(
  errorCode: string,
  message: string,
  status: number = 400,
  details?: any,
  correlationId?: string
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (correlationId) {
    headers['x-corr-id'] = correlationId;
  }

  const response = new Response(
    JSON.stringify({
      error_code: errorCode,
      message,
      details,
    }),
    { status, headers }
  );

  return addCorsHeaders(response);
}

/**
 * Create standardized success response
 */
export function createSuccessResponse(
  data: any,
  correlationId?: string,
  status: number = 200
): Response {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (correlationId) {
    headers['x-corr-id'] = correlationId;
  }

  const response = new Response(JSON.stringify(data), { status, headers });
  return addCorsHeaders(response);
}
