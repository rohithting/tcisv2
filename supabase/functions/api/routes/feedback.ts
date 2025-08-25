// Feedback Route Handler
// Handles query feedback

import { 
  assertAuth, 
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse
} from '../../_shared/auth.ts';

export async function handleFeedback(req: Request): Promise<Response> {
  const correlationId = generateCorrelationId();

  try {
    if (req.method !== 'POST') {
      return createErrorResponse('E_METHOD_NOT_ALLOWED', 'Method not allowed', 405, undefined, correlationId);
    }

    const { user, supabase } = await assertAuth(req);
    const body = await req.json();
    const { query_id, rating, feedback_text, is_helpful } = body;

    if (!query_id || !rating) {
      return createErrorResponse('E_MISSING_FIELDS', 'query_id and rating are required', 400, undefined, correlationId);
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return createErrorResponse('E_INVALID_RATING', 'Rating must be between 1 and 5', 400, undefined, correlationId);
    }

    // Check if query exists and user has access
    const { data: query, error: queryError } = await supabase
      .from('queries')
      .select('id, client_id')
      .eq('id', query_id)
      .single();

    if (queryError || !query) {
      return createErrorResponse('E_QUERY_NOT_FOUND', 'Query not found', 404, undefined, correlationId);
    }

    // Check client access
    const { data: access, error: accessError } = await supabase
      .from('user_client_access')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', query.client_id)
      .single();

    if (accessError || !access) {
      return createErrorResponse('E_FORBIDDEN_CLIENT', 'Access denied to this client', 403, undefined, correlationId);
    }

    // Create feedback
    const { data: feedback, error: feedbackError } = await supabase
      .from('feedback')
      .insert({
        query_id,
        rating,
        feedback_text: feedback_text || '',
        is_helpful: is_helpful || null,
        created_by: user.id
      })
      .select()
      .single();

    if (feedbackError) {
      throw new Error(`Failed to create feedback: ${feedbackError.message}`);
    }

    return createSuccessResponse('Feedback submitted successfully', { feedback }, correlationId);

  } catch (error: any) {
    console.error('Error in feedback handler:', error);
    if (error instanceof Response) return error;
    return createErrorResponse('E_INTERNAL_ERROR', 'Internal server error', 500, error.message, correlationId);
  }
}
