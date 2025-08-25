import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { 
  assertAuth, 
  assertCanCreateClient, 
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse 
} from '../_shared/auth.ts';
import { validateRequestBody, CreateClientSchema } from '../_shared/validate.ts';
import { handleCors } from '../_shared/cors.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const correlationId = generateCorrelationId();

  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      return createErrorResponse(
        'E_METHOD_NOT_ALLOWED',
        'Method not allowed',
        405,
        undefined,
        correlationId
      );
    }

    // Authenticate using anon key
    const { user, supabase } = await assertAuth(req);

    // Check if user can create clients
    await assertCanCreateClient(supabase, user.id);

    // Validate request body
    const { name, description, user_id } = await validateRequestBody(
      req,
      CreateClientSchema,
      correlationId
    );

    // Check for duplicate client name
    const { data: existingClient, error: checkError } = await supabase
      .from('clients')
      .select('id')
      .eq('name', name)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      // PGRST116 is "not found" which is what we want
      console.error('Error checking duplicate client:', checkError);
      return createErrorResponse(
        'E_DATABASE_ERROR',
        'Error checking client name',
        500,
        checkError.message,
        correlationId
      );
    }

    if (existingClient) {
      return createErrorResponse(
        'E_DUPLICATE_NAME',
        'Client with this name already exists',
        409,
        undefined,
        correlationId
      );
    }

    // Use provided user_id or fallback to anon-admin
    const createdBy = user_id || user.id;

    // Create the client
    const { data: client, error: createError } = await supabase
      .from('clients')
      .insert({
        name,
        description,
        is_active: true, // Changed from status: 'active' to is_active: true
        created_by: createdBy,
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Error creating client:', createError);
      return createErrorResponse(
        'E_DATABASE_ERROR',
        'Failed to create client',
        500,
        createError.message,
        correlationId
      );
    }

    // Grant creator admin access to the client
    const { error: accessError } = await supabase
      .from('user_client_access')
      .insert({
        user_id: createdBy,
        client_id: client.id,
        role: 'admin',
        granted_by: createdBy,
      });

    if (accessError) {
      console.error('Error granting access:', accessError);
      // Don't fail the request if access grant fails
      // The client was created successfully
    }

    return createSuccessResponse(
      { client_id: client.id },
      correlationId
    );

  } catch (error: any) {
    console.error('Error in clients-create:', error);
    
    if (error instanceof Response) {
      return error;
    }

    return createErrorResponse(
      'E_INTERNAL_ERROR',
      'Internal server error',
      500,
      error.message,
      correlationId
    );
  }
});
