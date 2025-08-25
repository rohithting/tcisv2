// Jobs Route Handler
// Handles job operations

import { 
  assertAuth, 
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse
} from '../../_shared/auth.ts';

export async function handleJobs(req: Request): Promise<Response> {
  const correlationId = generateCorrelationId();

  try {
    if (req.method !== 'GET' && req.method !== 'POST') {
      return createErrorResponse('E_METHOD_NOT_ALLOWED', 'Method not allowed', 405, undefined, correlationId);
    }

    const { user, supabase } = await assertAuth(req);

    if (req.method === 'GET') {
      // Get jobs for user's clients
      const { data: jobs, error: jobsError } = await supabase
        .from('jobs')
        .select(`
          id,
          status,
          job_type,
          progress,
          total_items,
          processed_items,
          created_at,
          uploads!inner(client_id, filename, rooms!inner(name))
        `)
        .in('uploads.client_id', 
          supabase
            .from('user_client_access')
            .select('client_id')
            .eq('user_id', user.id)
        );

      if (jobsError) {
        throw new Error(`Failed to fetch jobs: ${jobsError.message}`);
      }

      return createSuccessResponse('Jobs retrieved successfully', { jobs }, correlationId);
    }

    if (req.method === 'POST') {
      // Handle job operations (retry, cancel, etc.)
      const body = await req.json();
      const { action, job_id } = body;

      if (!action || !job_id) {
        return createErrorResponse('E_MISSING_FIELDS', 'action and job_id are required', 400, undefined, correlationId);
      }

      switch (action) {
        case 'retry':
          const { error: retryError } = await supabase
            .from('jobs')
            .update({ status: 'queued', updated_at: new Date().toISOString() })
            .eq('id', job_id)
            .in('status', ['failed', 'cancelled']);

          if (retryError) {
            throw new Error(`Failed to retry job: ${retryError.message}`);
          }

          return createSuccessResponse('Job queued for retry', { job_id }, correlationId);

        case 'cancel':
          const { error: cancelError } = await supabase
            .from('jobs')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', job_id)
            .in('status', ['pending', 'queued', 'processing']);

          if (cancelError) {
            throw new Error(`Failed to cancel job: ${cancelError.message}`);
          }

          return createSuccessResponse('Job cancelled successfully', { job_id }, correlationId);

        default:
          return createErrorResponse('E_INVALID_ACTION', 'Invalid action specified', 400, undefined, correlationId);
      }
    }

    return createErrorResponse('E_METHOD_NOT_ALLOWED', 'Method not allowed', 405, undefined, correlationId);

  } catch (error: any) {
    console.error('Error in jobs handler:', error);
    if (error instanceof Response) return error;
    return createErrorResponse('E_INTERNAL_ERROR', 'Internal server error', 500, error.message, correlationId);
  }
}
