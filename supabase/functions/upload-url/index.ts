import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { 
  assertAuth, 
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse 
} from '../_shared/auth.ts';
import { validateRequestBody, UploadUrlSchema } from '../_shared/validate.ts';
import { handleCors, addCorsHeaders } from '../_shared/cors.ts';

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

    // Read request body once and validate
    let body;
    try {
      body = await req.json();
    } catch (error) {
      return createErrorResponse(
        'E_BAD_INPUT',
        'Invalid JSON in request body',
        400,
        error.message,
        correlationId
      );
    }

    // Validate the parsed body
    const result = UploadUrlSchema.safeParse(body);
    if (!result.success) {
      const fieldErrors = result.error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }));
      
      return createErrorResponse(
        'E_BAD_INPUT',
        'Validation failed',
        400,
        { field_errors: fieldErrors },
        correlationId
      );
    }

    const { client_id, room_id, file_name, file_digest } = result.data;

    // Check if client and room exist
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

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, name, client_id')
      .eq('id', room_id)
      .eq('client_id', client_id)
      .single();

    if (roomError) {
      return createErrorResponse(
        'E_ROOM_NOT_FOUND',
        'Room not found or not in this client',
        404,
        roomError.message,
        correlationId
      );
    }

    // Generate storage path
    const timestamp = new Date().toISOString();
    const storagePath = `uploads/${client_id}/${room_id}/${timestamp}_${file_name}`;

    // Create upload record
    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .insert({
        client_id,
        room_id,
        filename: file_name,
        original_filename: file_name,
        file_size: 0, // Will be updated after actual upload
        file_type: 'text/plain', // Default for now
        storage_path: storagePath,
        uploaded_by: user.id,
        status: 'pending',
        metadata: {
          file_digest: file_digest,
          original_request: {
            file_name,
            file_digest
          }
        }
      })
      .select('id')
      .single();

    if (uploadError) {
      console.error('Error creating upload record:', uploadError);
      return createErrorResponse(
        'E_DATABASE_ERROR',
        'Failed to create upload record',
        500,
        uploadError.message,
        correlationId
      );
    }

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        client_id,
        room_id,
        upload_id: upload.id,
        status: 'pending',
        job_type: 'file_ingestion',
        progress: 0,
        total_items: 1,
        processed_items: 0
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('Error creating job record:', jobError);
      return createErrorResponse(
        'E_DATABASE_ERROR',
        'Failed to create job record',
        500,
        jobError.message,
        correlationId
      );
    }

    // Generate signed URL for upload
    console.log('Attempting to create signed upload URL...');
    console.log('Storage path:', storagePath);
    
    let signedUrlData = null;
    
    try {
      // First, let's check what storage buckets are available
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (bucketsError) {
        console.error('Error listing buckets:', bucketsError);
      } else {
        console.log('Available buckets:', buckets?.map((b: any) => b.name));
      }
      
      // Try to create signed URL
      const { data, error: signedUrlError } = await supabase.storage
        .from('chats-raw') // Use the correct bucket name
        .createSignedUploadUrl(storagePath);

      if (signedUrlError) {
        console.error('Error generating signed URL:', signedUrlError);
        console.error('Error details:', {
          message: signedUrlError.message,
          statusCode: signedUrlError.statusCode,
          error: signedUrlError.error
        });
        
        return createErrorResponse(
          'E_STORAGE_ERROR',
          'Failed to generate upload URL',
          500,
          `Storage error: ${signedUrlError.message}. Please ensure the 'uploads' storage bucket exists and is accessible.`,
          correlationId
        );
      }
      
      signedUrlData = data;
      console.log('Successfully created signed upload URL');
    } catch (error: any) {
      console.error('Unexpected error in storage operation:', error);
      return createErrorResponse(
        'E_STORAGE_ERROR',
        'Failed to generate upload URL - unexpected error',
        500,
        `Storage operation failed: ${error.message}`,
        correlationId
      );
    }

    return createSuccessResponse(
      {
        signed_url: signedUrlData.signedUrl,
        upload_id: upload.id,
        job_id: job.id,
        storage_path: storagePath,
      },
      correlationId
    );

  } catch (error: any) {
    console.error('Error in upload-url:', error);
    
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
