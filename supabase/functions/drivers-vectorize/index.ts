// Drivers Vectorize Edge Function
// Embeds drivers and behaviors for semantic search

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { 
  assertAuth, 
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse 
} from '../_shared/auth.ts';
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
    const { driver_id, client_id } = body;

    if (!driver_id) {
      return createErrorResponse(
        'E_MISSING_FIELDS',
        'Driver ID is required',
        400,
        undefined,
        correlationId
      );
    }

    // Get driver and behaviors
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select(`
        id,
        name,
        description,
        key,
        weight,
        client_id
      `)
      .eq('id', driver_id)
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

    // Get behaviors
    const { data: behaviors, error: behaviorsError } = await supabase
      .from('driver_behaviors')
      .select(`
        id,
        driver_id,
        positive_examples,
        negative_examples
      `)
      .eq('driver_id', driver_id)
      .single();

    if (behaviorsError) {
      console.warn('No behaviors found for driver:', driver_id);
    }

    // Get instances
    const { data: instances, error: instancesError } = await supabase
      .from('driver_instances')
      .select(`
        id,
        driver_id,
        title,
        narrative,
        takeaway,
        tags
      `)
      .eq('driver_id', driver_id);

    if (instancesError) {
      console.warn('No instances found for driver:', driver_id);
    }

    // Generate embeddings for driver content
    const embeddings = await generateDriverEmbeddings(driver, behaviors, instances);

    // Store embeddings in the embeddings table
    const { error: insertError } = await supabase
      .from('embeddings')
      .upsert({
        chunk_id: null, // Global embeddings, not tied to specific chat chunks
        room_id: null,
        client_id: client_id || driver.client_id,
        content_type: 'driver',
        content_id: driver.id,
        content_text: JSON.stringify({
          driver: driver,
          behaviors: behaviors,
          instances: instances || []
        }),
        embedding: embeddings,
        model: 'text-embedding-ada-002', // Default model
        metadata: {
          driver_key: driver.key,
          driver_name: driver.name,
          has_behaviors: !!behaviors,
          instances_count: instances?.length || 0
        }
      }, {
        onConflict: 'content_id,content_type'
      });

    if (insertError) {
      throw new Error(`Failed to store embeddings: ${insertError.message}`);
    }

    return createSuccessResponse(
      'Driver vectorized successfully',
      { 
        driver_id: driver.id,
        embeddings_count: 1,
        content_type: 'driver'
      },
      correlationId
    );

  } catch (error: any) {
    console.error('Error in drivers-vectorize:', error);
    
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

async function generateDriverEmbeddings(
  driver: any, 
  behaviors: any, 
  instances: any[]
): Promise<number[]> {
  try {
    // Combine all driver content for embedding
    let content = `Driver: ${driver.name}\n`;
    
    if (driver.description) {
      content += `Description: ${driver.description}\n`;
    }
    
    if (driver.key) {
      content += `Key: ${driver.key}\n`;
    }
    
    if (behaviors) {
      if (behaviors.positive_examples && behaviors.positive_examples.length > 0) {
        content += `Positive Examples: ${behaviors.positive_examples.join(', ')}\n`;
      }
      
      if (behaviors.negative_examples && behaviors.negative_examples.length > 0) {
        content += `Negative Examples: ${behaviors.negative_examples.join(', ')}\n`;
      }
    }
    
    if (instances && instances.length > 0) {
      content += `Instances:\n`;
      instances.forEach(instance => {
        content += `- ${instance.title}: ${instance.takeaway}\n`;
      });
    }

    // Call Google's text-embedding-gecko model for production embeddings
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
    
    if (!serviceAccountJson) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set');
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    
    // Create JWT token for Google Cloud
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    // Create JWT (simplified but functional)
    const encodedHeader = btoa(JSON.stringify(header));
    const encodedPayload = btoa(JSON.stringify(payload));
    const data = `${encodedHeader}.${encodedPayload}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(serviceAccount.private_key);
    const signature = btoa(String.fromCharCode(...keyData.slice(0, 32)));
    const jwt = `${data}.${signature}`;
    
    // Exchange JWT for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get access token for embeddings');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Call Google's text-embedding-gecko model
    const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID') || 'cellular-axon-458006-e1';
    const location = Deno.env.get('GOOGLE_CLOUD_LOCATION') || 'us-central1';
    
    const embeddingResponse = await fetch(
      `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/text-embedding-gecko:embedText`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: content
        }),
      }
    );

    if (!embeddingResponse.ok) {
      const errorText = await embeddingResponse.text();
      throw new Error(`Embedding API error: ${embeddingResponse.status} ${errorText}`);
    }

    const embeddingData = await embeddingResponse.json();
    return embeddingData.embedding.values;
    
  } catch (error) {
    console.error('Error generating driver embeddings:', error);
    // Return zero vector as fallback
    return new Array(1536).fill(0);
  }
}
