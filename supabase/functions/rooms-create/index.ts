import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { 
  assertAuth, 
  assertCanCreateClient, 
  assertClientAccess,
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse 
} from '../_shared/auth.ts';
import { validateRequestBody, CreateRoomSchema } from '../_shared/validate.ts';
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

    // Check if user can create rooms
    await assertCanCreateClient(supabase, user.id);

    // Validate request body
    const { client_id, room_type, name, description, user_id } = await validateRequestBody(
      req,
      CreateRoomSchema,
      correlationId
    );

    // Check if client exists and user has access
    await assertClientAccess(supabase, client_id, user.id, 'admin');

    // Check for duplicate room name in the same client
    const { data: existingRoom, error: checkError } = await supabase
      .from('rooms')
      .select('id')
      .eq('client_id', client_id)
      .eq('name', name)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking duplicate room:', checkError);
      return createErrorResponse(
        'E_DATABASE_ERROR',
        'Error checking room name',
        500,
        checkError.message,
        correlationId
      );
    }

    if (existingRoom) {
      return createErrorResponse(
        'E_DUPLICATE_NAME',
        'Room with this name already exists in this client',
        409,
        undefined,
        correlationId
      );
    }

    // Use provided user_id or fallback to anon-admin
    const createdBy = user_id || user.id;

    // Create the room
    const { data: room, error: createError } = await supabase
      .from('rooms')
      .insert({
        client_id,
        room_type,
        name,
        description,
        is_active: true, // Changed from status: 'active' to is_active: true
        created_by: createdBy,
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Error creating room:', createError);
      return createErrorResponse(
        'E_DATABASE_ERROR',
        'Failed to create room',
        500,
        createError.message,
        correlationId
      );
    }

    return createSuccessResponse(
      { room_id: room.id },
      correlationId
    );

  } catch (error: any) {
    console.error('Error in rooms-create:', error);
    
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
