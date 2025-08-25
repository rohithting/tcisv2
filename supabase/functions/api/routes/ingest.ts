// Ingest Route Handler
// Handles file ingestion and job creation

import { 
  assertAuth, 
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse
} from '../../_shared/auth.ts';

export async function handleIngest(req: Request): Promise<Response> {
  const correlationId = generateCorrelationId();

  try {
    if (req.method !== 'POST') {
      return createErrorResponse('E_METHOD_NOT_ALLOWED', 'Method not allowed', 405, undefined, correlationId);
    }

    const { user, supabase } = await assertAuth(req);
    const body = await req.json();
    const { upload_id } = body;

    if (!upload_id) {
      return createErrorResponse('E_MISSING_FIELDS', 'upload_id is required', 400, undefined, correlationId);
    }

    // Get upload details
    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .select('id, client_id, room_id, filename')
      .eq('id', upload_id)
      .single();

    if (uploadError || !upload) {
      return createErrorResponse('E_UPLOAD_NOT_FOUND', 'Upload not found', 404, undefined, correlationId);
    }

    // Check client access
    const { data: access, error: accessError } = await supabase
      .from('user_client_access')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', upload.client_id)
      .single();

    if (accessError || !access) {
      return createErrorResponse('E_FORBIDDEN_CLIENT', 'Access denied to this client', 403, undefined, correlationId);
    }

    // Create job for processing
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        upload_id,
        status: 'queued',
        job_type: 'chat_processing',
        progress: 0,
        total_items: 0,
        processed_items: 0
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    return createSuccessResponse('Ingestion started successfully', { 
      job,
      message: 'File queued for processing'
    }, correlationId);

  } catch (error: any) {
    console.error('Error in ingest handler:', error);
    if (error instanceof Response) return error;
    return createErrorResponse('E_INTERNAL_ERROR', 'Internal server error', 500, error.message, correlationId);
  }
}
