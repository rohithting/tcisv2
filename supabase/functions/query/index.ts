// Query Edge Function - Complete Implementation with Enhanced Classification - FINAL FIXED VERSION
// Handles conversation queries with Gemini integration, hybrid search, and intelligent contextual evaluation
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { assertAuth, generateCorrelationId, createErrorResponse } from '../_shared/auth.ts';
import { validateRequestBody, QuerySchema } from '../_shared/validate.ts';
import { SSEStream, handleSSEError } from '../_shared/sse.ts';
import { handleCors, addCorsHeaders } from '../_shared/cors.ts';
import { geminiClient } from '../_shared/gemini.ts';
import { driversManager } from '../_shared/drivers.ts';
import { db } from '../_shared/db.ts';
import { mmr, dedupeChunks, formatCitations, formatChunkTimestamp } from '../_shared/mmr.ts';
// Enhanced Intelligent Query Classification System
class IntelligentQueryClassifier {
  static async classifyQueryWithLLM(question, geminiClient) {
    try {
      const classificationPrompt = `
You are an advanced intent classifier for a chat analysis system. Classify the user's question into one of these categories:

1. "casual" - General conversation, current context questions, knowledge questions unrelated to stored chat data
   Examples: "what did I just ask?", "what's the weather?", "how are you?", "explain quantum physics"

2. "rag" - Questions that require searching through stored chat/message data for specific information, facts, instances, or examples
   Examples: "what did John say about the project?", "find discussions about deadlines", "show me meeting notes", "instances when Monica was late", "has Sarah ever missed deadlines?", "give me examples of", "find times when"

3. "evaluation" - Questions that ask for assessment, rating, or evaluation of someone's overall performance or behavior patterns
   Examples: "how is Sarah performing overall?", "rate John's communication skills", "evaluate the team's collaboration", "assess Maria's leadership", "what do you think of David's work?"

Key distinction: If asking for SPECIFIC INSTANCES, EXAMPLES, or FACTS from chat data = "rag". If asking for OVERALL ASSESSMENT or RATING = "evaluation".

Respond with ONLY the category name: "casual", "rag", or "evaluation"

User question: "${question}"

Classification:`;
      const geminiRequest = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: classificationPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 50
        }
      };
      console.log('🤖 Classifying intent with enhanced LLM for:', question.substring(0, 50));
      const response = await geminiClient.generateContent(geminiRequest);
      let classification = '';
      if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        classification = response.candidates[0].content.parts[0].text.trim().toLowerCase();
        console.log('🤖 LLM raw response:', classification);
      } else {
        console.error('❌ Unexpected Gemini response structure:', JSON.stringify(response, null, 2));
        throw new Error('No valid response from Gemini');
      }
      // Validate response
      if (classification.includes('evaluation')) {
        console.log('✅ LLM classified as EVALUATION');
        return 'evaluation';
      } else if (classification.includes('casual')) {
        console.log('✅ LLM classified as CASUAL');
        return 'casual';
      } else if (classification.includes('rag')) {
        console.log('✅ LLM classified as RAG');
        return 'rag';
      } else {
        console.log('⚠️ LLM gave unclear response, using enhanced fallback classification');
        return this.enhancedFallbackClassification(question);
      }
    } catch (error) {
      console.error('❌ LLM classification failed:', error);
      return this.enhancedFallbackClassification(question);
    }
  }
  static enhancedFallbackClassification(question) {
    console.log('🔄 Using enhanced fallback classification logic');
    // RAG patterns - SPECIFIC instances, examples, facts from chat data
    const ragPatterns = [
      // Specific instances/examples
      /\b(instances?|examples?|times|occasions?) (when|where|of|that)/i,
      /\b(give me|show me|find|list).*(instances?|examples?|times)/i,
      /\b(has \w+ ever|did \w+ ever|when did \w+)/i,
      /\b(failed to meet|missed|late|delayed|behind)/i,
      /\b(deadline|due date|timeline|schedule)/i,
      // Factual queries about stored data
      /\b(what did \w+ (say|mention|do|write))/i,
      /\b(find|search|show).*(messages?|discussion|conversation|chat)/i,
      /\b(in (our|the) (chat|conversation|meeting))/i,
      /\b(last conversation|previous discussion|what was discussed)/i,
      /\b(conversation.*with.*client|discussion.*with.*team)/i,
      /\b(show me|find).*(conversation|discussion|chat|messages)/i,
      // Time-based specific queries
      /\b(last (week|month|day|year)|past (week|month))/i,
      /\b(in the last|during the|within)/i,
      /\b(yesterday|today|this week|this month)/i,
      // Specific factual questions
      /\b(who (said|did|mentioned)|what (happened|was said))/i,
      /\b(which (project|client|task|meeting))/i,
      /\b(where (is|was|did)|how many times)/i
    ];
    // Evaluation patterns - OVERALL assessment, rating, opinion
    const evaluationPatterns = [
      /\b(how is|how's) \w+ (doing|performing|working) (overall|in general)?/i,
      /\b(rate|rating|score|assess|evaluate|judge) \w+('s)? (overall|general)?/i,
      /\b(overall performance|general performance)/i,
      /\b\w+('s)? (performance|skills|communication|leadership|teamwork) (overall|in general)/i,
      /\b(feedback|review) (on|for|about) \w+('s)? (overall|general)/i,
      /\b(what do you think (of|about)|opinion (of|on))/i,
      /\b(good|bad|excellent|poor) (at|in|with)/i
    ];
    // Casual patterns - current conversation or general questions
    const casualPatterns = [
      /^(hi|hello|hey|thanks|weather|how are)/i,
      /\b(what did i (ask|say|tell)).*(earlier|just now|before)\b/i,
      /\b(what.s|whats) (the|today.s)? (weather|temperature|time|date)\b/i,
      /\b(explain|define|tell me about) [a-z]+ ?(in general)?\b/i,
      /\b(remind me what (i|we) were (talking|discussing))\b/i
    ];
    // Check RAG first (most specific)
    if (ragPatterns.some((p)=>p.test(question))) {
      console.log('✅ Enhanced fallback classified as RAG (specific instances/facts)');
      return 'rag';
    }
    // Then check evaluation
    if (evaluationPatterns.some((p)=>p.test(question))) {
      console.log('✅ Enhanced fallback classified as EVALUATION (overall assessment)');
      return 'evaluation';
    }
    // Then casual
    if (casualPatterns.some((p)=>p.test(question))) {
      console.log('✅ Enhanced fallback classified as CASUAL');
      return 'casual';
    }
    // For conversation history questions, default to RAG
    if (/\b(last|previous|recent).*(conversation|discussion|meeting|chat)\b/i.test(question)) {
      console.log('✅ Enhanced fallback classified as RAG (conversation history)');
      return 'rag';
    }
    // Default: if contains person name + action words, probably RAG
    if (/\b[A-Z][a-z]+ (has|did|was|said|failed|missed|completed)/i.test(question)) {
      console.log('✅ Enhanced fallback classified as RAG (person + action)');
      return 'rag';
    }
    // Final default to RAG for factual questions
    console.log('✅ Enhanced fallback defaulted to RAG (safer for specific queries)');
    return 'rag';
  }
  static async classifyQuery(question, geminiClient) {
    return await this.classifyQueryWithLLM(question, geminiClient);
  }
}
// Conversation context manager
class ConversationManager {
  static async getConversationContext(supabase, conversation_id, limit = 10) {
    try {
      const { data, error } = await supabase.from('queries').select('question, answer, created_at').eq('conversation_id', conversation_id).order('created_at', {
        ascending: false
      }).limit(limit);
      if (error) {
        console.warn('Failed to get conversation context:', error);
        return [];
      }
      return (data || []).reverse(); // Reverse to get chronological order
    } catch (error) {
      console.warn('Error getting conversation context:', error);
      return [];
    }
  }
  static formatContextForGemini(context) {
    if (!context || context.length === 0) {
      return '';
    }
    const contextText = context.map((item)=>{
      const question = item.question || '';
      const answer = item.answer || '';
      return `User: ${question}\nAssistant: ${answer}`;
    }).join('\n\n');
    return `Previous conversation context:\n${contextText}\n\n`;
  }
}
// Subject extraction for evaluation mode
class SubjectExtractor {
  static async extractSubjectFromQuestion(question, geminiClient) {
    try {
      const extractionPrompt = `
Extract the person's name being evaluated from this question. If no specific person is mentioned, respond with "unknown".

Examples:
"How is Sarah performing?" -> "Sarah"
"Rate John's communication skills" -> "John"  
"Evaluate the team's work" -> "unknown"
"How are things going?" -> "unknown"

Question: "${question}"

Person's name:`;
      const geminiRequest = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: extractionPrompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 100
        }
      };
      const response = await geminiClient.generateContent(geminiRequest);
      let extractedName = '';
      if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
        extractedName = response.candidates[0].content.parts[0].text.trim();
        console.log('👤 Extracted subject:', extractedName);
      } else {
        console.error('❌ Unexpected Gemini response structure for subject extraction:', JSON.stringify(response, null, 2));
        throw new Error('No valid response from Gemini');
      }
      if (extractedName.toLowerCase() === 'unknown' || extractedName.length < 2) {
        return null;
      }
      return extractedName;
    } catch (error) {
      console.error('❌ Subject extraction failed:', error);
      return this.fallbackSubjectExtraction(question);
    }
  }
  static fallbackSubjectExtraction(question) {
    // Simple regex-based extraction as fallback
    const namePatterns = [
      /\b(how is|how's) (\w+) (doing|performing)\b/i,
      /\b(rate|evaluate|assess) (\w+)\b/i,
      /\b(\w+)'s (performance|skills|work)\b/i,
      /\bfeedback (on|for|about) (\w+)\b/i
    ];
    for (const pattern of namePatterns){
      const match = question.match(pattern);
      if (match && match[2] && match[2].length > 1) {
        console.log('👤 Fallback extracted subject:', match[2]);
        return match[2];
      }
    }
    return null;
  }
}
serve(async (req)=>{
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const correlationId = generateCorrelationId();
  const t0 = Date.now();
  try {
    // Only allow POST method
    if (req.method !== 'POST') {
      const errorResponse = createErrorResponse('E_METHOD_NOT_ALLOWED', 'Method not allowed', 405, undefined, correlationId);
      return addCorsHeaders(errorResponse);
    }
    // Authenticate using anon key
    const { user, supabase } = await assertAuth(req);
    // Validate request body
    const { client_id, conversation_id, question, filters } = await validateRequestBody(req, QuerySchema, correlationId);
    // Check client access
    const hasAccess = await db.hasClientAccess(user.id, client_id);
    if (!hasAccess) {
      const errorResponse = createErrorResponse('E_FORBIDDEN_CLIENT', 'Access denied to this client', 403, undefined, correlationId);
      return addCorsHeaders(errorResponse);
    }
    // Check if client exists
    let client;
    try {
      client = await db.getClient(client_id);
    } catch (clientError) {
      console.error('Error getting client:', clientError);
      const errorResponse = createErrorResponse('E_CLIENT_NOT_FOUND', 'Client not found', 404, undefined, correlationId);
      return addCorsHeaders(errorResponse);
    }
    // Check if conversation exists and belongs to client
    let conversation;
    try {
      conversation = await db.getConversation(conversation_id, client_id);
    } catch (conversationError) {
      console.error('Error getting conversation:', conversationError);
      const errorResponse = createErrorResponse('E_CONVERSATION_NOT_FOUND', 'Conversation not found', 404, undefined, correlationId);
      return addCorsHeaders(errorResponse);
    }
    // Create SSE stream
    console.log('Creating SSE stream...');
    const stream = new SSEStream(correlationId);
    // Process the request and handle streaming
    const processRequest = async ()=>{
      try {
        console.log('🚀 Starting processRequest...');
        // Send initial meta event
        stream.meta({
          corr_id: correlationId,
          client_id,
          conversation_id,
          filters
        });
        console.log('📡 Meta event sent');
        // STEP 1: CLASSIFY QUERY TYPE USING ENHANCED LLM
        console.log('🤖 Step 1: Classifying query type...');
        const queryType = await IntelligentQueryClassifier.classifyQuery(question, geminiClient);
        console.log(`✅ Query classified as: ${queryType}`);
        console.log(`📝 Question: "${question}"`);
        // STEP 2: EXTRACT SUBJECT FOR EVALUATION (if applicable)
        let subject_user = null;
        if (queryType === 'evaluation') {
          console.log('👤 Step 2: Extracting subject for evaluation...');
          subject_user = await SubjectExtractor.extractSubjectFromQuestion(question, geminiClient);
          if (!subject_user) {
            console.log('⚠️ No subject found for evaluation, switching to RAG mode');
            return await handleRAGMode();
          }
          console.log(`✅ Subject extracted: ${subject_user}`);
        }
        // STEP 3: GET CONVERSATION CONTEXT
        console.log('💬 Step 3: Getting conversation context...');
        const conversationContext = await ConversationManager.getConversationContext(supabase, conversation_id);
        const contextText = ConversationManager.formatContextForGemini(conversationContext);
        console.log(`✅ Found ${conversationContext.length} previous messages in conversation`);
        // STEP 4: ROUTE BASED ON QUERY TYPE
        if (queryType === 'casual') {
          console.log('🗣️ Route: CASUAL CONVERSATION MODE');
          return await handleCasualConversation();
        } else if (queryType === 'evaluation') {
          console.log('📊 Route: CONTEXTUAL EVALUATION MODE');
          return await handleEvaluationMode();
        } else {
          console.log('🔍 Route: ENHANCED RAG MODE');
          return await handleRAGMode();
        }
        // =================
        // CASUAL CONVERSATION HANDLER
        // =================
        // REPLACE your handleCasualConversation function with this:
        async function handleCasualConversation() {
          try {
            console.log('🎭 Processing casual conversation with ATOM persona...');
            // Send empty citations for casual mode
            stream.citations([]);
            // Call Gemini directly using the specialized casual method
            console.log('🤖 Calling Gemini for casual response...');
            const fullResponse = await geminiClient.generateCasualResponse(question, contextText);

            // FIXED: Stream word by word instead of character by character
            const words = fullResponse.split(' ');

            for(let i = 0; i < words.length; i++){
              let wordToSend = words[i];
              // Add space after each word except the last one
              if (i < words.length - 1) {
                wordToSend += ' ';
              }

              stream.token(wordToSend);
              // Small delay for smooth streaming
              await new Promise((resolve)=>setTimeout(resolve, 50));
            }
            // Store casual query
            const query_id = await db.insertQuery({
              conversation_id,
              client_id,
              user_id: user.id,
              question,
              filters: filters || {},
              evaluation_mode: false,
              latency_ms: Date.now() - t0
            });
            await db.updateQuery(query_id, fullResponse, []);
            stream.done({
              query_id,
              query_type: 'casual',
              latency_ms: Date.now() - t0
            });
          } catch (error) {
            console.error('❌ Casual conversation error:', error);
            stream.token('Sorry, I encountered an error. Please try again.');
            await handleError('casual');
          }
        }
        // =================
        // ENHANCED RAG MODE HANDLER WITH DATE FILTERING
        // =================
        async function handleRAGMode() {
          console.log('📚 Processing enhanced RAG mode...');
          // STEP 1: ANALYZE QUESTION FOR BETTER SEARCH STRATEGY
          const isTimeBasedQuery = /\b(last (week|month|day|year)|past (week|month)|in the last|within|yesterday|today|this week|this month)/i.test(question);
          const isSpecificPersonQuery = /\b[A-Z][a-z]+\b/.test(question); // Detect person names
          const isDeadlineQuery = /\b(deadline|due date|late|missed|failed to meet|behind schedule)/i.test(question);
          const isSpecificInstanceQuery = /\b(instances?|examples?|times|occasions?|has \w+ ever|failed to meet|missed|deadline)/i.test(question);
          console.log('🔍 Enhanced query analysis:', {
            isTimeBasedQuery,
            isSpecificPersonQuery,
            isDeadlineQuery,
            isSpecificInstanceQuery,
            originalQuestion: question
          });
          // STEP 2: ENHANCE SEARCH QUERY AND FILTERS
          let enhancedQuestion = question;
          let enhancedFilters = {
            ...filters
          } || {};
          // Extract and apply time-based filters
          if (isTimeBasedQuery) {
            const timeMatch = question.match(/\b(last|past) (\w+)/i);
            if (timeMatch) {
              const period = timeMatch[2].toLowerCase();
              const now = new Date();
              let daysBack = 30; // default
              switch(period){
                case 'week':
                  daysBack = 7;
                  break;
                case 'month':
                  daysBack = 30;
                  break;
                case 'day':
                  daysBack = 1;
                  break;
                case 'year':
                  daysBack = 365;
                  break;
              }
              const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
              enhancedFilters.date_from = startDate.toISOString();
              enhancedFilters.date_to = now.toISOString();
              console.log(`📅 Applied time filter: ${period} (${daysBack} days back)`);
              console.log(`📅 Date range: ${startDate.toLocaleDateString()} to ${now.toLocaleDateString()}`);
            }
          }
          // Extract person name for targeted search
          let targetPerson = null;
          if (isSpecificPersonQuery) {
            const nameMatch = question.match(/\b([A-Z][a-z]+)\b/);
            if (nameMatch) {
              targetPerson = nameMatch[1];
              console.log(`👤 Target person identified: ${targetPerson}`);
            }
          }
          // Add keyword-specific filters for deadline queries
          if (isDeadlineQuery) {
            enhancedFilters.keywords = [
              'deadline',
              'due',
              'late',
              'missed',
              'behind',
              'delay',
              'overdue'
            ];
            console.log('⏰ Added deadline-related keywords to search');
          }
          // STEP 3: PERFORM ENHANCED SEARCH
          console.log('🔤 Step 3: Getting embeddings and performing enhanced search...');
          let queryVec = null;
          let vectorResults = [];
          let textResults = [];
          try {
            // Get embeddings for the enhanced question
            const searchQuery = targetPerson ? `${enhancedQuestion} ${targetPerson}` : enhancedQuestion;
            queryVec = await db.getEmbeddings(searchQuery);
            if (queryVec === null) {
              console.warn('⚠️ Embeddings disabled, proceeding with text search only');
            } else {
              console.log('✅ Embeddings obtained successfully, vector length:', queryVec.length);
            }
          } catch (error) {
            console.warn('❌ Failed to get embeddings:', error);
            queryVec = null;
          }
          // Perform hybrid search with enhanced parameters
          try {
            console.log('🔍 Performing hybrid search with enhanced filters:', enhancedFilters);
            const searchResults = await db.hybridSearch({
              client_id,
              filters: enhancedFilters,
              queryVec,
              question: enhancedQuestion
            });
            vectorResults = searchResults.vectorTop || [];
            textResults = searchResults.textTop || [];
            console.log('✅ Enhanced search completed - Vector:', vectorResults.length, 'Text:', textResults.length);
            // If deadline query didn't return good results, try broader search
            if (isDeadlineQuery && vectorResults.length + textResults.length < 5) {
              console.log('🔄 Deadline query returned few results, trying broader search...');
              const broaderFilters = {
                ...enhancedFilters
              };
              delete broaderFilters.keywords; // Remove keyword restriction
              const broaderResults = await db.hybridSearch({
                client_id,
                filters: broaderFilters,
                queryVec,
                question: `${targetPerson || ''} work tasks project client response`
              });
              // Merge results
              vectorResults = [
                ...vectorResults,
                ...broaderResults.vectorTop || []
              ];
              textResults = [
                ...textResults,
                ...broaderResults.textTop || []
              ];
              console.log('✅ Broader search added - Total Vector:', vectorResults.length, 'Total Text:', textResults.length);
            }
          } catch (error) {
            console.error('❌ Enhanced hybrid search failed:', error);
            vectorResults = [];
            textResults = [];
          }
          // STEP 4: ENHANCED RERANK AND DEDUPE WITH TIME PREFERENCE
          console.log('🎯 Step 4: Enhanced reranking and deduplicating results...');
          const allCandidates = dedupeChunks([
            ...vectorResults,
            ...textResults
          ]);
          // Apply enhanced MMR with time and keyword preferences
          const rankedChunks = mmr(allCandidates, {
            lambda: 0.7,
            maxResults: isTimeBasedQuery ? 15 : 12,
            diversityWeight: 0.3,
            recencyWeight: isTimeBasedQuery ? 0.4 : 0.2 // Higher recency weight for time-based queries
          });
          console.log('✅ Enhanced ranking completed - Final chunks:', rankedChunks.length);
          // STEP 5: ENHANCED CITATION FORMATTING
          const citationsList = formatCitations(rankedChunks);
          stream.citations(citationsList);
          // Log sample results for debugging
          if (rankedChunks.length > 0) {
            console.log('📋 Sample search results:');
            rankedChunks.slice(0, 3).forEach((chunk, i)=>{
              const timestamp = formatChunkTimestamp(chunk);
              console.log(`${i + 1}. ID: ${chunk.id}, Time: ${timestamp}, Content: ${(chunk.text || chunk.content || '').substring(0, 100)}...`);
            });
          }
          return await handleRegularRAG(rankedChunks, citationsList);
        }
        // =================
        // ENHANCED REGULAR RAG Q&A HANDLER
        // =================
        async function handleRegularRAG(rankedChunks, citationsList) {
          try {
            console.log('💬 Processing enhanced RAG Q&A...');
            // Query analysis
            const isSpecificInstanceQuery = /\b(instances?|examples?|times|occasions?|has \w+ ever|failed to meet|missed|deadline)/i.test(question);
            const isTimeBasedQuery = /\b(last (week|month|day)|past (week|month)|in the last|within|yesterday|today)/i.test(question);
            console.log('🔍 Query analysis for RAG:', {
              isSpecificInstanceQuery,
              isTimeBasedQuery
            });
            // Prepare enhanced context
            let contextData = '';
            if (rankedChunks.length > 0) {
              if (isSpecificInstanceQuery) {
                contextData = rankedChunks.map((chunk, index)=>{
                  const chunkContent = chunk.content || chunk.text || 'No content';
                  const roomName = chunk.room_name || `Room ${chunk.room_id}`;
                  const timestamp = formatChunkTimestamp ? formatChunkTimestamp(chunk) : 'No time';
                  const similarity = chunk.similarity ? ` (relevance: ${(chunk.similarity * 100).toFixed(1)}%)` : '';
                  return `[Evidence ${index + 1} - ${roomName} - ${timestamp}${similarity}]:\n${chunkContent}`;
                }).join('\n\n');
              } else {
                contextData = rankedChunks.map((chunk)=>{
                  const chunkContent = chunk.content || chunk.text || 'No content';
                  const roomName = chunk.room_name || `Room ${chunk.room_id}`;
                  return `[Chunk ${chunk.id} - ${roomName}]: ${chunkContent}`;
                }).join('\n\n');
              }
            } else {
              contextData = 'No specific chat data found for this question.';
            }
            // Get drivers context
            let driversContext = '';
            try {
              const rubric = await driversManager.getDriversPayload(client_id);
              if (rubric && rubric.drivers) {
                driversContext = `\n\nCompany Values Context:\n${rubric.drivers.map((d)=>`- ${d.name}: ${d.description}`).join('\n')}`;
              }
            } catch (error) {
              console.log('⚠️ Could not load drivers, proceeding without them');
            }
            // Create enhanced system prompt
            let systemPrompt;
            if (isSpecificInstanceQuery) {
              systemPrompt = `You are ATOM, a virtual employee at Ting Works LLP, specializing in finding specific instances and examples from chat conversations.

TASK: Find and present specific instances, examples, or occurrences based on the user's question.

INSTRUCTIONS:
- Focus on SPECIFIC INSTANCES with dates/times when possible
- If evidence shows specific examples, list them chronologically
- Include relevant details like dates, participants, and context
- Use evidence references for citations (e.g., "Evidence 1", "Evidence 2")
- If no specific instances are found, clearly state that
- Be factual and precise - avoid general assessments

RESPONSE FORMAT:
1. Direct answer to the specific question
2. List specific instances with details if found
3. Include timestamps and participants when available
4. Cite evidence for verification

${driversContext}`;
            } else if (isTimeBasedQuery) {
              systemPrompt = `You are ATOM, a virtual employee at Ting Works LLP, analyzing time-specific chat data.

TASK: Analyze chat conversations within the specified time period.

INSTRUCTIONS:
- Focus on the specific time period mentioned in the question
- Pay attention to timestamps and chronological order
- Highlight relevant events or conversations within that timeframe
- If data lacks sufficient time information, mention this limitation
- Provide context about what happened when

${driversContext}`;
            } else {
              systemPrompt = `You are ATOM, a virtual employee at Ting Works LLP analyzing chat conversations. Answer questions using the provided chat context and conversation history. Include relevant citations referring to chunk IDs when referencing specific information. Be conversational and helpful.${driversContext}`;
            }
            // Include conversation context
            const fullContextText = `${conversationContext.length > 0 ? contextText + '\n\n' : ''}Chat Data Context:\n${contextData}`;
            console.log('🤖 Calling Gemini for enhanced RAG response...');
            // USE THE NEW GEMINI METHOD INSTEAD OF LOCAL STREAMING
            const fullResponse = await geminiClient.generateDirectResponse(question, fullContextText, systemPrompt, isSpecificInstanceQuery);
            // Send the response through streaming for UX
            // REPLACE the RAG streaming section with this:
            if (fullResponse && fullResponse.length > 0) {
                          // FIXED: Stream word by word with proper spacing
            const words = fullResponse.split(' ');
              // Send each word individually with proper spacing to prevent concatenation issues
              for(let i = 0; i < words.length; i++){
                let wordToSend = words[i];
                // Add space after each word except the last one
                if (i < words.length - 1) {
                  wordToSend += ' ';
                }
                console.log(`📡 [DEBUG] Sending word ${i + 1}/${words.length}:`, `"${wordToSend}"`, 'Length:', wordToSend.length);
                stream.token(wordToSend);
                // Increased delay to ensure proper token processing
                await new Promise((resolve)=>setTimeout(resolve, 100));
              }
            } else {
              stream.token('No response generated. Please try rephrasing your question.');
            }
            // Store query with answer
            const query_id = await db.insertQuery({
              conversation_id,
              client_id,
              user_id: user.id,
              question,
              filters: filters || {},
              evaluation_mode: false,
              latency_ms: Date.now() - t0
            });
            await db.updateQuery(query_id, fullResponse || 'No response generated', citationsList);
            stream.done({
              query_id,
              query_type: isSpecificInstanceQuery ? 'rag_specific' : 'rag',
              evidence_count: rankedChunks.length,
              latency_ms: Date.now() - t0
            });
          } catch (error) {
            console.error('❌ Enhanced RAG Q&A error:', error);
            stream.token('Sorry, I encountered an error generating the response. Please try again.');
            await handleError('rag');
          }
        }
        // =================
        // CONTEXTUAL EVALUATION MODE HANDLER
        // =================
        async function handleEvaluationMode() {
          try {
            console.log('📊 Processing contextual evaluation mode...');
            // First perform search to get evidence
            console.log('🔍 Getting evidence for evaluation...');
            let queryVec = null;
            let vectorResults = [];
            let textResults = [];
            try {
              queryVec = await db.getEmbeddings(question);
              if (queryVec === null) {
                console.warn('⚠️ Embeddings disabled for evaluation, proceeding with text search only');
              }
            } catch (error) {
              console.warn('❌ Failed to get embeddings for evaluation:', error);
              queryVec = null;
            }
            // Perform search for evidence - try to get diverse room coverage
            try {
              let searchResults;
              // First try: search with subject name to get relevant evidence
              searchResults = await db.hybridSearch({
                client_id,
                filters: filters || {},
                queryVec,
                question: `${question} ${subject_user}` // Include subject in search
              });
              vectorResults = searchResults.vectorTop || [];
              textResults = searchResults.textTop || [];
              // If we don't have enough room diversity, try a broader search
              const combinedResults = [
                ...vectorResults,
                ...textResults
              ];
              const rooms = new Set(combinedResults.map((r)=>r.room_id));
              if (rooms.size < 2 && combinedResults.length > 0) {
                console.log(`⚠️ Only found evidence in ${rooms.size} room(s), trying broader search...`);
                // Try searching just the subject name across all rooms
                const broaderSearch = await db.hybridSearch({
                  client_id,
                  filters: filters || {},
                  queryVec: await db.getEmbeddings(subject_user),
                  question: subject_user
                });
                // Merge results
                vectorResults = [
                  ...vectorResults,
                  ...broaderSearch.vectorTop || []
                ];
                textResults = [
                  ...textResults,
                  ...broaderSearch.textTop || []
                ];
              }
              console.log('✅ Evidence search completed - Vector:', vectorResults.length, 'Text:', textResults.length);
            } catch (error) {
              console.error('❌ Evidence search failed:', error);
              vectorResults = [];
              textResults = [];
            }
            // Rerank and dedupe evidence
            const allCandidates = dedupeChunks([
              ...vectorResults,
              ...textResults
            ]);
            const rankedChunks = mmr(allCandidates, {
              lambda: 0.7,
              maxResults: 15 // More evidence for evaluation
            });
            console.log('✅ Evidence gathered:', rankedChunks.length, 'chunks');
            // Send citations for evaluation evidence
            const citationsList = formatCitations(rankedChunks);
            stream.citations(citationsList);
            // Check if we have enough evidence
            if (rankedChunks.length === 0) {
              stream.token(`I couldn't find any evidence about ${subject_user} in the chat data to perform an evaluation.`);
              return await handleError('evaluation');
            }
            // Load drivers and evaluation policy from database
            console.log('📋 Loading drivers and evaluation policy from database...');
            const rubric = await driversManager.getDriversPayload(client_id);
            // DEBUG: Log the drivers being loaded from DB
            console.log('📋 Loaded drivers from DB:', rubric.drivers.map((d)=>({
                id: d.id,
                key: d.key,
                name: d.name
              })));
            console.log('📋 Total drivers:', rubric.drivers.length);
            console.log('📋 Loaded instances from DB:', rubric.instances.length);
            console.log('📋 Evaluation policy from DB:', rubric.policy.name);
            // Handle cases where no drivers are configured - provide general evaluation
            if (!rubric.drivers || rubric.drivers.length === 0) {
              console.log('⚠️ No drivers configured in DB, providing general contextual evaluation...');
              // Provide a general qualitative evaluation without specific drivers
              const generalEvaluation = await geminiClient.generateGeneralEvaluation(subject_user, question, driversManager.compactEvidence(rankedChunks));
              // Send the general evaluation as text response
              stream.token(generalEvaluation);
              // Store as a regular query (not evaluation mode since no drivers)
              const query_id = await db.insertQuery({
                conversation_id,
                client_id,
                user_id: user.id,
                question,
                filters: filters || {},
                evaluation_mode: false,
                latency_ms: Date.now() - t0
              });
              await db.updateQuery(query_id, generalEvaluation, citationsList);
              stream.done({
                query_id,
                query_type: 'evaluation_general',
                subject_user,
                latency_ms: Date.now() - t0
              });
              return;
            }
            // Enforce evidence policy - BUT allow single room if that's all we have
            const policyCheck = driversManager.enforceEvidencePolicy(rankedChunks, rubric.policy);
            if (!policyCheck.ok) {
              // If it's just a room diversity issue and we have sufficient evidence otherwise, be more lenient
              if (policyCheck.reason?.includes('room diversity') && rankedChunks.length >= 3) {
                console.log('⚠️ Room diversity requirement not met, but proceeding with sufficient evidence from single room');
              } else {
                stream.token(`Not enough evidence about ${subject_user} to provide a fair evaluation: ${policyCheck.reason}`);
                return await handleError('evaluation');
              }
            }
            // Call Gemini for CONTEXTUAL evaluation
            console.log('🤖 Calling Gemini for contextual evaluation with company values...');
            const evalJson = await geminiClient.generateEvaluation(subject_user, question, rubric.drivers, rubric.instances, rubric.policy, driversManager.compactEvidence(rankedChunks));
            // DEBUG: Log what Gemini returned
            console.log('🤖 Gemini contextual evaluation result:', JSON.stringify(evalJson, null, 2));
            // VALIDATE THAT GEMINI RETURNED VALID SCORES
            if (!evalJson.scores || !Array.isArray(evalJson.scores) || evalJson.scores.length === 0) {
              console.error('❌ Gemini returned empty scores array');
              console.log('🔍 Available drivers:', rubric.drivers.map((d)=>d.key));
              console.log('🔍 Evidence summary:', rankedChunks.map((c)=>c.text?.substring(0, 100)));
              // Fallback to general evaluation if structured evaluation fails
              console.log('🔄 Falling back to general evaluation...');
              const generalEvaluation = await geminiClient.generateGeneralEvaluation(subject_user, question, driversManager.compactEvidence(rankedChunks));
              stream.token(generalEvaluation);
              return await handleError('evaluation');
            }
            // Validate that scores have valid driver references
            const validDriverKeys = new Set(rubric.drivers.map((d)=>d.key));
            const invalidScores = evalJson.scores.filter((score)=>!validDriverKeys.has(score.driver));
            if (invalidScores.length > 0) {
              console.warn('⚠️ Some scores reference invalid drivers:', invalidScores);
              // Filter out invalid scores
              evalJson.scores = evalJson.scores.filter((score)=>validDriverKeys.has(score.driver));
            }
            // Final check after filtering
            if (evalJson.scores.length === 0) {
              console.log('🔄 No valid scores after filtering, falling back to general evaluation...');
              const generalEvaluation = await geminiClient.generateGeneralEvaluation(subject_user, question, driversManager.compactEvidence(rankedChunks));
              stream.token(generalEvaluation);
              return await handleError('evaluation');
            }
            // Validate and clamp scores
            const validated = driversManager.validateAndClamp(evalJson, rubric.policy, rubric.drivers);
            // Store query and evaluation
            const query_id = await db.insertQuery({
              conversation_id,
              client_id,
              user_id: user.id,
              question,
              filters: filters || {},
              evaluation_mode: true,
              latency_ms: Date.now() - t0
            });
            // Insert evaluation with enhanced error handling
            try {
              await db.insertEvaluation({
                query_id,
                client_id,
                rubric: rubric,
                result: validated
              });
              console.log('✅ Contextual evaluation stored successfully');
            } catch (insertError) {
              console.error('❌ Error inserting evaluation:', insertError);
              console.log('🔍 Validation result:', JSON.stringify(validated, null, 2));
              throw new Error(`Failed to store evaluation: ${insertError.message}`);
            }
            // Send evaluation payload and contextual summary
            stream.evaluationPayload(validated);
            stream.token(driversManager.createShortSummary(validated));
            stream.done({
              query_id,
              query_type: 'evaluation_contextual',
              subject_user,
              latency_ms: Date.now() - t0
            });
          } catch (error) {
            console.error('❌ Contextual evaluation error:', error);
            stream.token('Sorry, I encountered an error while performing the evaluation. Please try again.');
            await handleError('evaluation');
          }
        }
        // =================
        // HELPER FUNCTIONS - FIXED STREAMING
        // =================
        async function handleError(queryType) {
          const query_id = await db.insertQuery({
            conversation_id,
            client_id,
            user_id: user.id,
            question,
            filters: filters || {},
            evaluation_mode: queryType === 'evaluation',
            latency_ms: Date.now() - t0
          });
          stream.done({
            query_id,
            query_type: queryType,
            latency_ms: Date.now() - t0
          });
        }
      } catch (error) {
        console.error('❌ Stream processing error:', error);
        handleSSEError(stream, error, correlationId);
      }
    };
    // Start processing in background
    console.log('🚀 Starting background processing...');
    processRequest();
    // Return the SSE response
    console.log('📡 Returning SSE response to client...');
    return stream.createResponse();
  } catch (error) {
    console.error('❌ Error in query:', error);
    if (error instanceof Response) {
      return addCorsHeaders(error);
    }
    const errorResponse = createErrorResponse('E_INTERNAL_ERROR', 'Internal server error', 500, error.message, correlationId);
    return addCorsHeaders(errorResponse);
  }
});
