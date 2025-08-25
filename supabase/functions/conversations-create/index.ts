import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { 
  assertAuth, 
  assertClientAccess,
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse 
} from '../_shared/auth.ts';
import { validateRequestBody, CreateConversationSchema } from '../_shared/validate.ts';
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

    // Validate request body
    const { client_id, title, user_id } = await validateRequestBody(
      req,
      CreateConversationSchema,
      correlationId
    );

    // Check if client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', client_id)
      .single();

    if (clientError) {
      return createErrorResponse(
        'E_CLIENT_NOT_FOUND',
        'Client not found',
        404,
        clientError.message,
        correlationId
      );
    }

    // Check if user has access to this client
    await assertClientAccess(supabase, client_id, user.id, 'viewer');

    // Use provided user_id or fallback to anon-admin
    const createdBy = user_id || user.id;

    // Generate title if not provided
    const conversationTitle = title || `New Conversation ${new Date().toISOString().slice(0, 10)}`;

    // Create the conversation
    const { data: conversation, error: createError } = await supabase
      .from('conversations')
      .insert({
        client_id,
        title: conversationTitle,
        is_active: true, // Changed from status: 'active' to is_active: true
        created_by: createdBy,
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Error creating conversation:', createError);
      return createErrorResponse(
        'E_DATABASE_ERROR',
        'Failed to create conversation',
        500,
        createError.message,
        correlationId
      );
    }

    return createSuccessResponse(
      { conversation_id: conversation.id },
      correlationId
    );

  } catch (error: any) {
    console.error('Error in conversations-create:', error);
    
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
