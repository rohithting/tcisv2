// Evaluation Run Edge Function
// Runs evaluations using Gemini with Drivers & Values framework

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { 
  assertAuth, 
  generateCorrelationId,
  createErrorResponse,
  createSuccessResponse 
} from '../_shared/auth.ts';
import { handleCors } from '../_shared/cors.ts';
import { geminiClient } from '../_shared/gemini.ts';
import { driversManager } from '../_shared/drivers.ts';
import { db } from '../_shared/db.ts';
import { mmr, dedupeChunks, formatCitations } from '../_shared/mmr.ts';

interface EvaluationRequest {
  client_id: number;
  conversation_id: number;
  subject_user: string;
  question: string;
  filters?: {
    types?: string[];
    room_ids?: number[];
    date_from?: string;
    date_to?: string;
    participants?: string[];
  };
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const correlationId = generateCorrelationId();
  const t0 = Date.now();

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
    const { client_id, conversation_id, subject_user, question, filters } = await req.json() as EvaluationRequest;

    if (!client_id || !conversation_id || !subject_user || !question) {
      return createErrorResponse(
        'E_MISSING_FIELDS',
        'client_id, conversation_id, subject_user, and question are required',
        400,
        undefined,
        correlationId
      );
    }

    // Check client access
    const hasAccess = await db.hasClientAccess(user.id, client_id);
    if (!hasAccess) {
      return createErrorResponse(
        'E_FORBIDDEN_CLIENT',
        'Access denied to this client',
        403,
        undefined,
        correlationId
      );
    }

    // Check if client exists
    const client = await db.getClient(client_id);

    // Check if conversation exists and belongs to client
    const conversation = await db.getConversation(conversation_id, client_id);

    // 1. RETRIEVAL - Hybrid search for evidence
    let queryVec: number[] | undefined;
    try {
      queryVec = await db.getEmbeddings(question);
    } catch (error) {
      console.warn('Failed to get embeddings, proceeding with text search only:', error);
    }

    const { vectorTop, textTop } = await db.hybridSearch({
      client_id,
      filters,
      queryVec,
      question
    });

    // Combine and deduplicate results
    const candidates = dedupeChunks([...vectorTop, ...textTop]);
    
    if (candidates.length === 0) {
      return createErrorResponse(
        'E_NO_EVIDENCE',
        'No relevant information found in the chat data for evaluation',
        400,
        undefined,
        correlationId
      );
    }

    // Rerank using MMR for diversity
    const reranked = mmr(candidates, { lambda: 0.7, maxResults: 12 });
    const citations = formatCitations(reranked);

    // 2. LOAD DRIVERS & EVALUATION POLICY
    const rubric = await driversManager.getDriversPayload(client_id);
    
    // Enforce evidence policy
    const policyCheck = driversManager.enforceEvidencePolicy(reranked, rubric.policy);
    if (!policyCheck.ok) {
      return createErrorResponse(
        'E_INSUFFICIENT_EVIDENCE',
        policyCheck.reason || 'Insufficient evidence for evaluation',
        400,
        undefined,
        correlationId
      );
    }

    // 3. CALL GEMINI FOR EVALUATION
    const evalJson = await geminiClient.generateEvaluation(
      subject_user,
      question,
      rubric.drivers,
      rubric.instances,
      rubric.policy,
      driversManager.compactEvidence(reranked)
    );

    // 4. VALIDATE AND CLAMP SCORES
    const validated = driversManager.validateAndClamp(evalJson, rubric.policy, rubric.drivers);

    // 5. STORE QUERY AND EVALUATION
    const query_id = await db.insertQuery({
      conversation_id,
      client_id,
      user_id: user.id,
      question,
      filters,
      evaluation_mode: true,
      latency_ms: Date.now() - t0
    });

    await db.insertEvaluation({
      query_id,
      client_id,
      rubric: rubric,
      result: validated
    });

    // 6. RETURN EVALUATION RESULTS
    return createSuccessResponse(
      'Evaluation completed successfully',
      {
        query_id,
        evaluation: validated,
        citations,
        latency_ms: Date.now() - t0,
        evidence_count: reranked.length,
        drivers_evaluated: rubric.drivers.length
      },
      correlationId
    );

  } catch (error: any) {
    console.error('Error in evaluation-run:', error);
    
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
