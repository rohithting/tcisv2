// Query Route Handler
// Handles conversation queries with Gemini integration

import { 
  assertAuth, 
  generateCorrelationId,
  createErrorResponse
} from '../../_shared/auth.ts';
import { SSEStream } from '../../_shared/sse.ts';
import { geminiClient } from '../../_shared/gemini.ts';
import { driversManager } from '../../_shared/drivers.ts';
import { db } from '../../_shared/db.ts';
import { mmr, dedupeChunks, formatCitations } from '../../_shared/mmr.ts';

export async function handleQuery(req: Request): Promise<Response> {
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

    // Parse request body
    const body = await req.json();
    const { client_id, conversation_id, question, filters, evaluation_mode, subject_user } = body;

    // Validate required fields
    if (!client_id || !conversation_id || !question) {
      return createErrorResponse(
        'E_MISSING_FIELDS',
        'client_id, conversation_id, and question are required',
        400,
        undefined,
        correlationId
      );
    }

    // Validate question length
    if (question.length < 1 || question.length > 1000) {
      return createErrorResponse(
        'E_INVALID_QUESTION',
        'Question must be between 1 and 1000 characters',
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

    // Create SSE stream
    const stream = new SSEStream();

    // Send initial meta event
    stream.sendEvent('meta', {
      corr_id: correlationId,
      retrieved: 0,
      mmr_kept: 0,
      model: evaluation_mode ? 'gemini-1.5-pro' : 'gemini-1.5-flash'
    });

    // Validation for evaluation mode
    if (evaluation_mode && !subject_user) {
      stream.sendEvent('token', 'Error: Evaluation mode requires a subject user.');
      const query_id = await db.insertQuery({
        conversation_id,
        client_id,
        user_id: user.id,
        question,
        filters,
        evaluation_mode: true,
        latency_ms: Date.now() - t0
      });
      return stream.sendEvent('done', { query_id, latency_ms: Date.now() - t0 });
    }

    // 1. RETRIEVAL - Hybrid search (vector + text)
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
    
    // Check if this is a general question that doesn't need specific chat context
    const isGeneralQuestion = /^(hi|hello|hey|how are you|good morning|good afternoon|good evening|thanks?|thank you|bye|goodbye)$/i.test(question.trim());
    
    if (candidates.length === 0 && !isGeneralQuestion) {
      stream.sendEvent('token', 'No relevant information found in the chat data for your question.');
      const query_id = await db.insertQuery({
        conversation_id,
        client_id,
        user_id: user.id,
        question,
        filters,
        evaluation_mode: false,
        latency_ms: Date.now() - t0
      });
      return stream.sendEvent('done', { query_id, latency_ms: Date.now() - t0 });
    }

    // Rerank using MMR for diversity
    const reranked = mmr(candidates, { lambda: 0.7, maxResults: 12 });
    const citations = formatCitations(reranked);
    
    // Update meta with retrieval info
    stream.sendEvent('meta', {
      corr_id: correlationId,
      retrieved: candidates.length,
      mmr_kept: reranked.length,
      model: evaluation_mode ? 'gemini-1.5-pro' : 'gemini-1.5-flash'
    });
    
    // Send citations
    stream.sendEvent('citations', citations);

    // 2. EVALUATION MODE
    if (evaluation_mode && subject_user) {
      try {
        // Load drivers and evaluation policy
        const rubric = await driversManager.getDriversPayload(client_id);
        
        // Enforce evidence policy
        const policyCheck = driversManager.enforceEvidencePolicy(reranked, rubric.policy);
        if (!policyCheck.ok) {
          stream.sendEvent('token', `Not enough evidence to rate fairly: ${policyCheck.reason}`);
          const query_id = await db.insertQuery({
            conversation_id,
            client_id,
            user_id: user.id,
            question,
            filters,
            evaluation_mode: true,
            latency_ms: Date.now() - t0
          });
          return stream.sendEvent('done', { query_id, latency_ms: Date.now() - t0 });
        }

        // Call Gemini for evaluation
        const evalJson = await geminiClient.generateEvaluation(
          subject_user,
          question,
          rubric.drivers,
          rubric.instances,
          rubric.policy,
          driversManager.compactEvidence(reranked)
        );

        // Validate and clamp scores
        const validated = driversManager.validateAndClamp(evalJson, rubric.policy, rubric.drivers);
        
        // Store query and evaluation
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

        // Send evaluation payload and summary
        stream.sendEvent('evaluation_payload', validated);
        stream.sendEvent('token', driversManager.createShortSummary(validated));
        
        return stream.sendEvent('done', { query_id, latency_ms: Date.now() - t0 });
      } catch (error) {
        console.error('Evaluation error:', error);
        stream.sendEvent('token', 'Error: Failed to complete evaluation. Please try again.');
        const query_id = await db.insertQuery({
          conversation_id,
          client_id,
          user_id: user.id,
          question,
          filters,
          evaluation_mode: true,
          latency_ms: Date.now() - t0
        });
        return stream.sendEvent('done', { query_id, latency_ms: Date.now() - t0 });
      }
    }

    // 3. NORMAL Q&A MODE
    try {
      // Prepare context for Gemini
      const context = reranked.map(chunk => 
        `[${chunk.rooms?.name || 'Unknown Room'} - ${chunk.first_ts}]: ${chunk.text}`
      ).join('\n\n');

      // System prompt for grounding
      const systemPrompt = `You are a helpful AI assistant analyzing chat conversations. Answer questions using only the provided context. If the context is insufficient, say so. Include concise citations referring to the provided snippet IDs. Be conversational and helpful - you can respond to general questions like "Good morning" or "How are you" as well as specific questions about the chat data.`;

      // Call Gemini for streaming response
      const geminiRequest = {
        contents: [
          {
            role: 'user',
            parts: [{ text: systemPrompt }]
          },
          {
            role: 'user',
            parts: [{ text: `Context:\n${context}\n\nQuestion: ${question}` }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.8,
          maxOutputTokens: 2048,
        }
      };

      // Stream response from Gemini
      const geminiStream = await geminiClient.streamGenerateContent(geminiRequest);
      const reader = geminiStream.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Parse the streaming response
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') break;
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
                  const text = parsed.candidates[0].content.parts[0].text;
                  stream.sendEvent('token', text);
                }
              } catch (parseError) {
                // Skip malformed JSON
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Store query with answer
      const query_id = await db.insertQuery({
        conversation_id,
        client_id,
        user_id: user.id,
        question,
        filters,
        evaluation_mode: false,
        latency_ms: Date.now() - t0
      });

      // Update query with answer and citations
      await db.updateQuery(query_id, 'Streamed response', citations);

      return stream.sendEvent('done', { query_id, latency_ms: Date.now() - t0 });

    } catch (error) {
      console.error('Q&A error:', error);
      stream.sendEvent('token', 'Error: Failed to generate response. Please try again.');
      const query_id = await db.insertQuery({
        conversation_id,
        client_id,
        user_id: user.id,
        question,
        filters,
        evaluation_mode: false,
        latency_ms: Date.now() - t0
      });
      return stream.sendEvent('done', { query_id, latency_ms: Date.now() - t0 });
    }

  } catch (error: any) {
    console.error('Error in query handler:', error);
    
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
}
