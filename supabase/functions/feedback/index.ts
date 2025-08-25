import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { 
  assertAuth, 
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse 
} from '../_shared/auth.ts';
import { validateRequestBody, FeedbackSchema } from '../_shared/validate.ts';
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
    const { query_id, chunk_id, useful_flag } = await validateRequestBody(
      req,
      FeedbackSchema,
      correlationId
    );

    // Check if query exists
    const { data: query, error: queryError } = await supabase
      .from('queries')
      .select('id, client_id')
      .eq('id', query_id)
      .single();

    if (queryError) {
      return createErrorResponse(
        'E_QUERY_NOT_FOUND',
        'Query not found',
        404,
        queryError.message,
        correlationId
      );
    }

    // Check if chunk exists
    const { data: chunk, error: chunkError } = await supabase
      .from('chunks')
      .select('id, client_id')
      .eq('id', chunk_id)
      .single();

    if (chunkError) {
      return createErrorResponse(
        'E_CHUNK_NOT_FOUND',
        'Chunk not found',
        404,
        chunkError.message,
        correlationId
      );
    }

    // Verify both belong to the same client
    if (query.client_id !== chunk.client_id) {
      return createErrorResponse(
        'E_INVALID_REQUEST',
        'Query and chunk must belong to the same client',
        400,
        undefined,
        correlationId
      );
    }

    // Insert or update feedback
    const { error: feedbackError } = await supabase
      .from('feedback')
      .upsert({
        query_id,
        chunk_id,
        useful_flag,
        created_by: user.id,
        updated_by: user.id,
      }, {
        onConflict: 'query_id,chunk_id'
      });

    if (feedbackError) {
      console.error('Error saving feedback:', feedbackError);
      return createErrorResponse(
        'E_DATABASE_ERROR',
        'Failed to save feedback',
        500,
        feedbackError.message,
        correlationId
      );
    }

    return createSuccessResponse(
      { saved: true },
      correlationId
    );

  } catch (error: any) {
    console.error('Error in feedback:', error);
    
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
