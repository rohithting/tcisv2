// Main API Router Edge Function
// Handles all subroutes for the TCIS system

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { handleCors } from '../_shared/cors.ts';

// Import route handlers
import { handleQuery } from './routes/query.ts';
import { handleConversations } from './routes/conversations.ts';
import { handleRooms } from './routes/rooms.ts';
import { handleUploadUrl } from './routes/upload-url.ts';
import { handleIngest } from './routes/ingest.ts';
import { handleJobs } from './routes/jobs.ts';
import { handleFeedback } from './routes/feedback.ts';

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    const path = url.pathname.replace('/functions/v1/api', '');
    
    // Route to appropriate handler based on path
    if (path === '/query' || path === '/query/') {
      return await handleQuery(req);
    }
    
    if (path === '/conversations' || path === '/conversations/') {
      return await handleConversations(req);
    }
    
    if (path === '/rooms' || path === '/rooms/') {
      return await handleRooms(req);
    }
    
    if (path === '/upload-url' || path === '/upload-url/') {
      return await handleUploadUrl(req);
    }
    
    if (path === '/ingest' || path === '/ingest/') {
      return await handleIngest(req);
    }
    
    if (path === '/jobs' || path === '/jobs/') {
      return await handleJobs(req);
    }
    
    if (path === '/feedback' || path === '/feedback/') {
      return await handleFeedback(req);
    }
    
    // Default route - return API info
    return new Response(
      JSON.stringify({
        message: 'TCIS API',
        version: '1.0.0',
        available_routes: [
          '/query',
          '/conversations', 
          '/rooms',
          '/upload-url',
          '/ingest',
          '/jobs',
          '/feedback'
        ],
        documentation: 'See PRD for API specifications'
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      }
    );

  } catch (error: any) {
    console.error('Error in API router:', error);
    
    return new Response(
      JSON.stringify({
        error: 'E_INTERNAL_ERROR',
        message: 'Internal server error',
        correlation_id: crypto.randomUUID()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});
