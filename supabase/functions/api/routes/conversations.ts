// Conversations Route Handler
// Handles conversation creation

import { 
  assertAuth, 
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse
} from '../../_shared/auth.ts';

export async function handleConversations(req: Request): Promise<Response> {
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

    // Parse request body
    const body = await req.json();
    const { client_id, title, description } = body;

    // Validate required fields
    if (!client_id) {
      return createErrorResponse(
        'E_MISSING_FIELDS',
        'client_id is required',
        400,
        undefined,
        correlationId
      );
    }

    // Check client access
    const { data: access, error: accessError } = await supabase
      .from('user_client_access')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', client_id)
      .single();

    if (accessError || !access) {
      return createErrorResponse(
        'E_FORBIDDEN_CLIENT',
        'Access denied to this client',
        403,
        undefined,
        correlationId
      );
    }

    // Create conversation
    const { data: conversation, error: createError } = await supabase
      .from('conversations')
      .insert({
        client_id,
        title: title || 'New Conversation',
        description: description || '',
        created_by: user.id
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create conversation: ${createError.message}`);
    }

    return createSuccessResponse(
      'Conversation created successfully',
      { conversation },
      correlationId
    );

  } catch (error: any) {
    console.error('Error in conversations handler:', error);
    
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
}
