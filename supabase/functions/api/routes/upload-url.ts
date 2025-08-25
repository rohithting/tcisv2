// Upload URL Route Handler
// Handles upload URL generation

import { 
  assertAuth, 
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse
} from '../../_shared/auth.ts';

export async function handleUploadUrl(req: Request): Promise<Response> {
  const correlationId = generateCorrelationId();

  try {
    if (req.method !== 'POST') {
      return createErrorResponse('E_METHOD_NOT_ALLOWED', 'Method not allowed', 405, undefined, correlationId);
    }

    const { user, supabase } = await assertAuth(req);
    const body = await req.json();
    const { client_id, room_id, filename, file_size, file_type } = body;

    if (!client_id || !room_id || !filename || !file_size || !file_type) {
      return createErrorResponse('E_MISSING_FIELDS', 'All fields are required', 400, undefined, correlationId);
    }

    // Check client access
    const { data: access, error: accessError } = await supabase
      .from('user_client_access')
      .select('id')
      .eq('user_id', user.id)
      .eq('client_id', client_id)
      .single();

    if (accessError || !access) {
      return createErrorResponse('E_FORBIDDEN_CLIENT', 'Access denied to this client', 403, undefined, correlationId);
    }

    // Generate signed URL (simplified)
    const storagePath = `uploads/${client_id}/${room_id}/${Date.now()}_${filename}`;
    const signedUrl = `https://storage.example.com/${storagePath}`;

    // Create upload record
    const { data: upload, error: createError } = await supabase
      .from('uploads')
      .insert({
        client_id,
        room_id,
        filename,
        original_filename: filename,
        file_size,
        file_type,
        storage_path: storagePath,
        uploaded_by: user.id
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create upload record: ${createError.message}`);
    }

    return createSuccessResponse('Upload URL generated successfully', { 
      upload,
      signed_url: signedUrl,
      storage_path: storagePath
    }, correlationId);

  } catch (error: any) {
    console.error('Error in upload-url handler:', error);
    if (error instanceof Response) return error;
    return createErrorResponse('E_INTERNAL_ERROR', 'Internal server error', 500, error.message, correlationId);
  }
}
