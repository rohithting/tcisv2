import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { 
  assertAuth, 
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse 
} from '../_shared/auth.ts';
import { validateRequestBody, ReindexSchema } from '../_shared/validate.ts';
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
    const { client_id, room_ids, date_from, date_to } = await validateRequestBody(
      req,
      ReindexSchema,
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

    // Build query for chunks to reindex
    let query = supabase
      .from('chunks')
      .select('id, room_id')
      .eq('client_id', client_id);

    if (room_ids && room_ids.length > 0) {
      query = query.in('room_id', room_ids);
    }

    if (date_from) {
      query = query.gte('first_ts', date_from);
    }

    if (date_to) {
      query = query.lte('last_ts', date_to);
    }

    // Get chunks to reindex
    const { data: chunks, error: chunksError } = await query;
    if (chunksError) {
      console.error('Error fetching chunks:', chunksError);
      return createErrorResponse(
        'E_DATABASE_ERROR',
        'Failed to fetch chunks for reindexing',
        500,
        chunksError.message,
        correlationId
      );
    }

    if (!chunks || chunks.length === 0) {
      return createSuccessResponse(
        { 
          reindexed: true, 
          chunks_processed: 0,
          message: 'No chunks found matching the criteria'
        },
        correlationId
      );
    }

    // Create reindex jobs for each chunk
    const reindexJobs = chunks.map(chunk => ({
      chunk_id: chunk.id,
      room_id: chunk.room_id,
      client_id,
      status: 'pending',
      type: 'reindex',
      created_by: user.id,
    }));

    const { error: jobsError } = await supabase
      .from('reindex_jobs')
      .insert(reindexJobs);

    if (jobsError) {
      console.error('Error creating reindex jobs:', jobsError);
      return createErrorResponse(
        'E_DATABASE_ERROR',
        'Failed to create reindex jobs',
        500,
        jobsError.message,
        correlationId
      );
    }

    return createSuccessResponse(
      { 
        reindexed: true, 
        chunks_processed: chunks.length,
        jobs_created: reindexJobs.length
      },
      correlationId
    );

  } catch (error: any) {
    console.error('Error in reindex:', error);
    
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
