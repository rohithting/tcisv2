// Drivers Create/Update Edge Function
// Manages driver creation and updates for the Drivers & Values system

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { 
  assertAuth, 
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse 
} from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';

interface DriverCreateRequest {
  name: string;
  description?: string;
  key?: string;
  weight?: number;
  client_id?: number;
  negative_indicators?: string[];
}

interface DriverBehaviorRequest {
  driver_id: number;
  positive_examples: string[];
  negative_examples: string[];
}

interface DriverInstanceRequest {
  driver_id: number;
  title: string;
  narrative: string;
  takeaway: string;
  tags?: string[];
}

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

    // Authenticate and check admin role
    const { user, supabase } = await assertAuth(req);
    
    // Check if user is admin or super admin
    const { data: platformUser, error: userError } = await supabase
      .from('platform_users')
      .select('platform_role')
      .eq('id', user.id)
      .single();

    if (userError || !platformUser) {
      return createErrorResponse(
        'E_UNAUTHORIZED',
        'User not found',
        401,
        undefined,
        correlationId
      );
    }

    if (!['admin', 'super_admin'].includes(platformUser.platform_role)) {
      return createErrorResponse(
        'E_FORBIDDEN',
        'Insufficient permissions',
        403,
        undefined,
        correlationId
      );
    }

    const body = await req.json();
    const { action, driver, behaviors, instances } = body;

    switch (action) {
      case 'create_driver':
        return await createDriver(supabase, user.id, driver, correlationId);
      
      case 'update_driver':
        return await updateDriver(supabase, user.id, driver, correlationId);
      
      case 'create_behaviors':
        return await createBehaviors(supabase, user.id, behaviors, correlationId);
      
      case 'create_instance':
        return await createInstance(supabase, user.id, instances, correlationId);
      
      default:
        return createErrorResponse(
          'E_INVALID_ACTION',
          'Invalid action specified',
          400,
          undefined,
          correlationId
        );
    }

  } catch (error: any) {
    console.error('Error in drivers-create:', error);
    
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

async function createDriver(
  supabase: any, 
  userId: string, 
  driverData: DriverCreateRequest, 
  correlationId: string
): Promise<Response> {
  try {
    // Validate required fields
    if (!driverData.name) {
      return createErrorResponse(
        'E_MISSING_FIELDS',
        'Driver name is required',
        400,
        undefined,
        correlationId
      );
    }

    // Generate key if not provided
    if (!driverData.key) {
      driverData.key = driverData.name.toLowerCase().replace(/\s+/g, '_');
    }

    // Check if key already exists
    const { data: existingDriver, error: checkError } = await supabase
      .from('drivers')
      .select('id')
      .eq('key', driverData.key)
      .single();

    if (!checkError && existingDriver) {
      return createErrorResponse(
        'E_DUPLICATE_KEY',
        'Driver key already exists',
        400,
        undefined,
        correlationId
      );
    }

    // Create driver
    const { data: driver, error: createError } = await supabase
      .from('drivers')
      .insert({
        name: driverData.name,
        description: driverData.description,
        key: driverData.key,
        weight: driverData.weight || 1.0,
        client_id: driverData.client_id || null,
        negative_indicators: driverData.negative_indicators || [],
        created_by: userId
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create driver: ${createError.message}`);
    }

    return createSuccessResponse(
      'Driver created successfully',
      { driver },
      correlationId
    );

  } catch (error: any) {
    console.error('Error creating driver:', error);
    return createErrorResponse(
      'E_DRIVER_CREATE_FAILED',
      'Failed to create driver',
      500,
      error.message,
      correlationId
    );
  }
}

async function updateDriver(
  supabase: any, 
  userId: string, 
  driverData: DriverCreateRequest & { id: number }, 
  correlationId: string
): Promise<Response> {
  try {
    // Validate required fields
    if (!driverData.id || !driverData.name) {
      return createErrorResponse(
        'E_MISSING_FIELDS',
        'Driver ID and name are required',
        400,
        undefined,
        correlationId
      );
    }

    // Check if driver exists
    const { data: existingDriver, error: checkError } = await supabase
      .from('drivers')
      .select('id, client_id')
      .eq('id', driverData.id)
      .single();

    if (checkError || !existingDriver) {
      return createErrorResponse(
        'E_DRIVER_NOT_FOUND',
        'Driver not found',
        404,
        undefined,
        correlationId
      );
    }

    // Update driver
    const { data: driver, error: updateError } = await supabase
      .from('drivers')
      .update({
        name: driverData.name,
        description: driverData.description,
        key: driverData.key,
        weight: driverData.weight,
        client_id: driverData.client_id,
        negative_indicators: driverData.negative_indicators,
        updated_at: new Date().toISOString()
      })
      .eq('id', driverData.id)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update driver: ${updateError.message}`);
    }

    return createSuccessResponse(
      'Driver updated successfully',
      { driver },
      correlationId
    );

  } catch (error: any) {
    console.error('Error updating driver:', error);
    return createErrorResponse(
      'E_DRIVER_UPDATE_FAILED',
      'Failed to update driver',
      500,
      error.message,
      correlationId
    );
  }
}

async function createBehaviors(
  supabase: any, 
  userId: string, 
  behaviorsData: DriverBehaviorRequest, 
  correlationId: string
): Promise<Response> {
  try {
    // Validate required fields
    if (!behaviorsData.driver_id || !behaviorsData.positive_examples || !behaviorsData.negative_examples) {
      return createErrorResponse(
        'E_MISSING_FIELDS',
        'Driver ID, positive examples, and negative examples are required',
        400,
        undefined,
        correlationId
      );
    }

    // Check if driver exists
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id')
      .eq('id', behaviorsData.driver_id)
      .single();

    if (driverError || !driver) {
      return createErrorResponse(
        'E_DRIVER_NOT_FOUND',
        'Driver not found',
        404,
        undefined,
        correlationId
      );
    }

    // Create or update behaviors
    const { data: behaviors, error: createError } = await supabase
      .from('driver_behaviors')
      .upsert({
        driver_id: behaviorsData.driver_id,
        positive_examples: behaviorsData.positive_examples,
        negative_examples: behaviorsData.negative_examples
      }, {
        onConflict: 'driver_id'
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create behaviors: ${createError.message}`);
    }

    return createSuccessResponse(
      'Behaviors created successfully',
      { behaviors },
      correlationId
    );

  } catch (error: any) {
    console.error('Error creating behaviors:', error);
    return createErrorResponse(
      'E_BEHAVIORS_CREATE_FAILED',
      'Failed to create behaviors',
      500,
      error.message,
      correlationId
    );
  }
}

async function createInstance(
  supabase: any, 
  userId: string, 
  instanceData: DriverInstanceRequest, 
  correlationId: string
): Promise<Response> {
  try {
    // Validate required fields
    if (!instanceData.driver_id || !instanceData.title || !instanceData.narrative || !instanceData.takeaway) {
      return createErrorResponse(
        'E_MISSING_FIELDS',
        'Driver ID, title, narrative, and takeaway are required',
        400,
        undefined,
        correlationId
      );
    }

    // Check if driver exists
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id')
      .eq('id', instanceData.driver_id)
      .single();

    if (driverError || !driver) {
      return createErrorResponse(
        'E_DRIVER_NOT_FOUND',
        'Driver not found',
        404,
        undefined,
        correlationId
      );
    }

    // Create instance
    const { data: instance, error: createError } = await supabase
      .from('driver_instances')
      .insert({
        driver_id: instanceData.driver_id,
        title: instanceData.title,
        narrative: instanceData.narrative,
        takeaway: instanceData.takeaway,
        tags: instanceData.tags || []
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Failed to create instance: ${createError.message}`);
    }

    return createSuccessResponse(
      'Instance created successfully',
      { instance },
      correlationId
    );

  } catch (error: any) {
    console.error('Error creating instance:', error);
    return createErrorResponse(
      'E_INSTANCE_CREATE_FAILED',
      'Failed to create instance',
      500,
      error.message,
      correlationId
    );
  }
}
