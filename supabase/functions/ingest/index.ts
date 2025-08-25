import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { assertAuth, generateCorrelationId, createErrorResponse, createSuccessResponse } from '../_shared/auth.ts';
import { validateRequestBody, IngestSchema } from '../_shared/validate.ts';
import { handleCors, addCorsHeaders } from '../_shared/cors.ts';
serve(async (req)=>{
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const correlationId = generateCorrelationId();
  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      const errorResponse = createErrorResponse('E_METHOD_NOT_ALLOWED', 'Method not allowed', 405, undefined, correlationId);
      return addCorsHeaders(errorResponse);
    }
    // Authenticate using anon key
    const { user, supabase } = await assertAuth(req);
    // Validate request body
    const { job_id } = await validateRequestBody(req, IngestSchema, correlationId);
    // Check if job exists and is in pending status
    const { data: job, error: jobError } = await supabase.from('jobs').select('id, status, upload_id, client_id, room_id').eq('id', job_id).single();
    if (jobError) {
      const errorResponse = createErrorResponse('E_JOB_NOT_FOUND', 'Job not found', 404, jobError.message, correlationId);
      return addCorsHeaders(errorResponse);
    }
    if (job.status !== 'pending') {
      const errorResponse = createErrorResponse('E_INVALID_JOB_STATUS', 'Job is not in pending status', 400, {
        current_status: job.status
      }, correlationId);
      return addCorsHeaders(errorResponse);
    }
    // Update job status to queued (Cloud Run worker will pick this up)
    const { error: updateError } = await supabase.from('jobs').update({
      status: 'queued',
      updated_at: new Date().toISOString()
    }).eq('id', job_id);
    if (updateError) {
      console.error('Error updating job status:', updateError);
      const errorResponse = createErrorResponse('E_DATABASE_ERROR', 'Failed to update job status', 500, updateError.message, correlationId);
      return addCorsHeaders(errorResponse);
    }
    // Update upload status to processing
    const { error: uploadUpdateError } = await supabase.from('uploads').update({
      status: 'processing'
    }).eq('id', job.upload_id);
    if (uploadUpdateError) {
      console.error('Error updating upload status:', uploadUpdateError);
    // Don't fail the request if upload update fails
    }
    const successResponse = createSuccessResponse({
      accepted: true,
      job_id
    }, correlationId);
    return addCorsHeaders(successResponse);
  } catch (error) {
    console.error('Error in ingest:', error);
    if (error instanceof Response) {
      return addCorsHeaders(error);
    }
    const errorResponse = createErrorResponse('E_INTERNAL_ERROR', 'Internal server error', 500, error.message, correlationId);
    return addCorsHeaders(errorResponse);
  }
});
