import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { 
  assertAuth, 
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse 
} from '../_shared/auth.ts';
import { validateRequestBody, JobsQuerySchema } from '../_shared/validate.ts';
import { handleCors } from '../_shared/cors.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const correlationId = generateCorrelationId();

  try {
    // Allow both GET and POST methods
    if (req.method !== 'GET' && req.method !== 'POST') {
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

    let clientId: string | null = null;
    let roomId: string | null = null;
    let status: string | null = null;
    let limit = 50;
    let offset = 0;
    let action: string | null = null;

    if (req.method === 'POST') {
      // Handle POST request with JSON body
      const body = await req.json();
      clientId = body.client_id?.toString() || null;
      roomId = body.room_id?.toString() || null;
      status = body.status?.toString() || null;
      limit = parseInt(body.limit?.toString() || '50');
      offset = parseInt(body.offset?.toString() || '0');
      action = body.action?.toString() || null;
    } else {
      // Handle GET request with query parameters
      const url = new URL(req.url);
      clientId = url.searchParams.get('client_id');
      roomId = url.searchParams.get('room_id');
      status = url.searchParams.get('status');
      limit = parseInt(url.searchParams.get('limit') || '50');
      offset = parseInt(url.searchParams.get('offset') || '0');
    }

    if (!clientId) {
      return createErrorResponse(
        'E_MISSING_PARAMETER',
        'client_id is required',
        400,
        undefined,
        correlationId
      );
    }

    // Check if client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', clientId)
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

    // Build base query conditions
    const baseQuery = supabase
      .from('jobs')
      .select(`
        id,
        room_id,
        upload_id,
        status,
        job_type,
        progress,
        total_items,
        processed_items,
        error_message,
        started_at,
        completed_at,
        created_at,
        updated_at,
        rooms!inner(
          id,
          name,
          room_type,
          client_id
        ),
        uploads!inner(
          id,
          filename,
          original_filename
        )
      `)
      .eq('client_id', clientId);

    if (roomId) {
      baseQuery.eq('room_id', roomId);
    }

    if (status) {
      // Handle multiple status values
      const statusArray = status.split(',').map(s => s.trim());
      if (statusArray.length === 1) {
        baseQuery.eq('status', statusArray[0]);
      } else {
        baseQuery.in('status', statusArray);
      }
    }

    // Get total count with a separate count query
    let countQuery = supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', clientId);
      
    if (roomId) {
      countQuery = countQuery.eq('room_id', roomId);
    }
    
    if (status) {
      // Handle multiple status values
      const statusArray = status.split(',').map(s => s.trim());
      if (statusArray.length === 1) {
        countQuery = countQuery.eq('status', statusArray[0]);
      } else {
        countQuery = countQuery.in('status', statusArray);
      }
    }
    
    const { count, error: countError } = await countQuery;
      
    if (countError) {
      console.error('Error counting jobs:', countError);
    }

    // Get paginated results
    const { data: jobs, error: jobsError } = await baseQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (jobsError) {
      console.error('Error fetching jobs:', jobsError);
      return createErrorResponse(
        'E_DATABASE_ERROR',
        'Failed to fetch jobs',
        500,
        jobsError.message,
        correlationId
      );
    }

    // Transform jobs data
    const transformedJobs = (jobs || []).map(job => ({
      id: job.id,
      room_id: job.room_id,
      room_name: job.rooms?.name || 'Unknown Room',
      room_type: job.rooms?.room_type || 'unknown',
      upload_id: job.upload_id,
      file_name: job.uploads?.filename || 'Unknown File',
      original_filename: job.uploads?.original_filename || 'Unknown File',
      status: job.status,
      job_type: job.job_type,
      progress: job.progress || 0,
      total_items: job.total_items,
      processed_items: job.processed_items || 0,
      error_message: job.error_message,
      started_at: job.started_at,
      completed_at: job.completed_at,
      created_at: job.created_at,
      updated_at: job.updated_at,
    }));

    return createSuccessResponse(
      {
        jobs: transformedJobs,
        pagination: {
          limit,
          offset,
          total: count || 0,
          has_more: (offset + limit) < (count || 0),
        },
        filters: {
          client_id: clientId,
          room_id: roomId || undefined,
          status: status || undefined,
        },
      },
      correlationId
    );

  } catch (error: any) {
    console.error('Error in jobs:', error);
    
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
