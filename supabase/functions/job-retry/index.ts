import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { 
  assertAuth, 
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse 
} from '../_shared/auth.ts';
import { validateRequestBody, JobRetrySchema } from '../_shared/validate.ts';
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
    const { job_id } = await validateRequestBody(
      req,
      JobRetrySchema,
      correlationId
    );

    // Check if job exists and is in failed status
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, status, client_id')
      .eq('id', job_id)
      .single();

    if (jobError) {
      return createErrorResponse(
        'E_JOB_NOT_FOUND',
        'Job not found',
        404,
        jobError.message,
        correlationId
      );
    }

    if (job.status !== 'failed') {
      return createErrorResponse(
        'E_INVALID_JOB_STATUS',
        'Only failed jobs can be retried',
        400,
        { current_status: job.status },
        correlationId
      );
    }

    // Reset job to pending status
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        status: 'pending',
        error_code: null,
        error_message: null,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('id', job_id);

    if (updateError) {
      console.error('Error updating job status:', updateError);
      return createErrorResponse(
        'E_DATABASE_ERROR',
        'Failed to reset job status',
        500,
        updateError.message,
        correlationId
      );
    }

    return createSuccessResponse(
      { queued: true, job_id },
      correlationId
    );

  } catch (error: any) {
    console.error('Error in job-retry:', error);
    
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
