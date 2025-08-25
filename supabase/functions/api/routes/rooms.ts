// Rooms Route Handler
// Handles room creation

import { 
  assertAuth, 
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse
} from '../../_shared/auth.ts';

export async function handleRooms(req: Request): Promise<Response> {
  const correlationId = generateCorrelationId();

  try {
    if (req.method !== 'POST') {
      return createErrorResponse('E_METHOD_NOT_ALLOWED', 'Method not allowed', 405, undefined, correlationId);
    }

    const { user, supabase } = await assertAuth(req);
    const body = await req.json();
    const { client_id, name, description, room_type } = body;

    if (!client_id || !name || !room_type) {
      return createErrorResponse('E_MISSING_FIELDS', 'client_id, name, and room_type are required', 400, undefined, correlationId);
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

    // Create room
    const { data: room, error: createError } = await supabase
      .from('rooms')
      .insert({
        client_id,
        name,
        description: description || '',
        room_type,
        created_by: user.id
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create room: ${createError.message}`);
    }

    return createSuccessResponse('Room created successfully', { room }, correlationId);

  } catch (error: any) {
    console.error('Error in rooms handler:', error);
    if (error instanceof Response) return error;
    return createErrorResponse('E_INTERNAL_ERROR', 'Internal server error', 500, error.message, correlationId);
  }
}
