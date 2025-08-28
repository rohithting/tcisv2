// Database utility functions - FIXED VERSION
// Provides typed queries and database operations for the Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
class DatabaseManager {
  supabase;
  cache;
  constructor(){
    this.supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    // Token cache with TTL for embeddings
    this.cache = {
      token: null,
      expires: 0
    };
  }
  /**
   * Hybrid search combining vector similarity and text search - FIXED SCHEMA
   */ async hybridSearch(params) {
    const { client_id, filters, queryVec, question } = params;
    let vectorTop = [];
    let textTop = [];
    try {
      // Build base query for chunks using correct field names - FIXED: room_type instead of type
      let baseQuery = this.supabase.from('chunks').select(`
          id,
          text,
          room_id,
          client_id,
          source_upload_id,
          first_ts,
          last_ts,
          participants,
          token_count,
          created_at,
          rooms!inner(
            id,
            name,
            room_type
          )
        `).eq('client_id', client_id);
      // Apply filters - only room_ids for now to avoid blocking results
      if (filters?.room_ids && filters.room_ids.length > 0) {
        baseQuery = baseQuery.in('room_id', filters.room_ids);
      }
      // Apply date filters using message timestamps
      if (filters?.date_from) {
        baseQuery = baseQuery.gte('last_ts', filters.date_from);
      }
      if (filters?.date_to) {
        baseQuery = baseQuery.lte('first_ts', filters.date_to);
      }
      // Apply participant filter
      if (filters?.participants && filters.participants.length > 0) {
        baseQuery = baseQuery.overlaps('participants', filters.participants);
      }
      // Vector search (if query vector provided)
      if (queryVec && queryVec.length > 0) {
        try {
          const { data: vectorData, error: vectorError } = await this.supabase.rpc('match_documents', {
            query_embedding: queryVec,
            match_threshold: 0.5,
            match_count: 100,
            filter: {
              client_id
            }
          });
          if (!vectorError && vectorData) {
            vectorTop = vectorData.map((item)=>({
                ...item,
                similarity_score: item.similarity,
                content: item.text || item.content,
                room_name: item.rooms?.name || 'Unknown Room'
              }));
          }
        } catch (vectorErr) {
          console.warn('Vector search failed:', vectorErr);
          vectorTop = [];
        }
      }
      // Text search using text field - more permissive
      try {
        const { data: textData, error: textError } = await baseQuery.textSearch('text', question, {
          type: 'plain',
          config: 'english'
        }).limit(100); // Increase limit
        if (textError) {
          console.error('Text search error:', textError);
          textTop = [];
        } else {
          textTop = (textData || []).map((item)=>({
              ...item,
              content: item.text,
              room_name: item.rooms?.name || 'Unknown Room',
              room_type: item.rooms?.room_type || 'unknown',
              similarity_score: 0.5 // Default score for text search results
            }));
        }
      } catch (textErr) {
        console.error('Text search failed:', textErr);
        textTop = [];
      }
      console.log('Search results - Vector:', vectorTop.length, 'Text:', textTop.length);
      if (vectorTop.length > 0) {
        console.log('Sample vector result:', {
          id: vectorTop[0].id,
          content: vectorTop[0].content?.substring(0, 100),
          first_ts: vectorTop[0].first_ts,
          room_name: vectorTop[0].room_name,
          similarity: vectorTop[0].similarity_score
        });
      }
      if (textTop.length > 0) {
        console.log('Sample text result:', {
          id: textTop[0].id,
          content: textTop[0].content?.substring(0, 100),
          first_ts: textTop[0].first_ts,
          room_name: textTop[0].room_name
        });
      }
      return {
        vectorTop,
        textTop
      };
    } catch (error) {
      console.error('Hybrid search error:', error);
      return {
        vectorTop: [],
        textTop: []
      };
    }
  }
  /**
   * Insert query record with correct field mapping
   */ async insertQuery(params) {
    try {
      const { data, error } = await this.supabase.from('queries').insert({
        conversation_id: params.conversation_id,
        client_id: params.client_id,
        query_text: params.question,
        question: params.question,
        filters_json: params.filters,
        evaluation_mode: params.evaluation_mode,
        latency_ms: params.latency_ms,
        created_by: params.user_id
      }).select('id').single();
      if (error) {
        throw new Error(`Failed to insert query: ${error.message}`);
      }
      return data.id;
    } catch (error) {
      console.error('Error inserting query:', error);
      throw error;
    }
  }
  /**
   * Insert evaluation record
   */ async insertEvaluation(params) {
    try {
      const { error } = await this.supabase.from('evaluations').insert({
        query_id: params.query_id,
        client_id: params.client_id,
        rubric_json: params.rubric,
        result_json: params.result
      });
      if (error) {
        throw new Error(`Failed to insert evaluation: ${error.message}`);
      }
    } catch (error) {
      console.error('Error inserting evaluation:', error);
      throw error;
    }
  }
  /**
   * Get conversation by ID and client
   */ async getConversation(conversationId, clientId) {
    try {
      const { data, error } = await this.supabase.from('conversations').select('id, client_id, title, created_by').eq('id', conversationId).eq('client_id', clientId).single();
      if (error) {
        throw new Error(`Conversation not found: ${error.message}`);
      }
      return data;
    } catch (error) {
      console.error('Error getting conversation:', error);
      throw error;
    }
  }
  /**
   * Get client by ID
   */ async getClient(clientId) {
    try {
      const { data, error } = await this.supabase.from('clients').select('id, name, description').eq('id', clientId).single();
      if (error) {
        throw new Error(`Client not found: ${error.message}`);
      }
      return data;
    } catch (error) {
      console.error('Error getting client:', error);
      throw error;
    }
  }
  /**
   * Check if user has access to client
   */ async hasClientAccess(userId, clientId) {
    try {
      // Check if user is platform admin
      const { data: platformUser, error: platformError } = await this.supabase.from('platform_users').select('platform_role').eq('id', userId).single();
      if (!platformError && platformUser?.platform_role === 'super_admin') {
        return true;
      }
      // Check client-specific access
      const { data: access, error: accessError } = await this.supabase.from('user_client_access').select('id').eq('user_id', userId).eq('client_id', clientId).single();
      if (accessError) {
        return false;
      }
      return !!access;
    } catch (error) {
      console.error('Error checking client access:', error);
      return false;
    }
  }
  /**
   * Enhanced JWT creation with better error handling and validation - FIXED
   */ async createJWT(serviceAccount) {
    if (!serviceAccount || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('Invalid service account: missing required fields');
    }
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
    // Base64URL encode header and payload
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const data = `${encodedHeader}.${encodedPayload}`;
    // Process private key with enhanced format handling
    let privateKeyPem = serviceAccount.private_key;
    // Handle various private key formats
    if (privateKeyPem.includes('\\n')) {
      privateKeyPem = privateKeyPem.replace(/\\n/g, '\n');
    }
    // Format single-line keys
    if (!privateKeyPem.includes('\n')) {
      privateKeyPem = privateKeyPem.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n').replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
      const lines = privateKeyPem.split('\n');
      const formattedLines = [];
      for (const line of lines){
        if (line.includes('-----BEGIN') || line.includes('-----END') || line.length <= 64) {
          formattedLines.push(line);
        } else {
          // Split long lines into 64-character chunks
          for(let i = 0; i < line.length; i += 64){
            formattedLines.push(line.substring(i, i + 64));
          }
        }
      }
      privateKeyPem = formattedLines.join('\n');
    }
    // Extract PEM content
    const lines = privateKeyPem.split('\n');
    const pemContent = lines.filter((line)=>!line.includes('-----BEGIN') && !line.includes('-----END') && line.trim().length > 0).join('');
    try {
      // Convert PEM to binary
      const binaryDer = Uint8Array.from(atob(pemContent), (c)=>c.charCodeAt(0));
      // Import the key with enhanced error handling
      const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryDer, {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256'
      }, false, [
        'sign'
      ]);
      // Sign the data
      const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(data));
      // Encode signature
      const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      console.log('DB: JWT created successfully');
      return `${data}.${encodedSignature}`;
    } catch (error) {
      console.error('DB: JWT creation failed:', error);
      console.error('PEM content length:', pemContent.length);
      throw new Error(`JWT creation failed: ${error.message}`);
    }
  }
  /**
   * Enhanced access token management with caching - FIXED BASE64 HANDLING
   */ async getAccessToken() {
    // Check if cached token is still valid
    if (this.cache.token && Date.now() < this.cache.expires) {
      console.log('DB: Using cached access token');
      return this.cache.token;
    }
    try {
      let serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
      if (!serviceAccountJson) {
        throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON environment variable not set');
      }
      // Handle base64 encoded service accounts - FIXED: Added missing logic
      if (!serviceAccountJson.trim().startsWith('{')) {
        try {
          console.log('DB: Decoding base64 service account...');
          serviceAccountJson = atob(serviceAccountJson);
          console.log('DB: Successfully decoded base64 service account');
        } catch (decodeError) {
          throw new Error('Service account appears to be base64 but failed to decode');
        }
      }
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(serviceAccountJson);
        console.log('DB: Service account parsed, email:', serviceAccount.client_email);
      } catch (parseError) {
        throw new Error(`Failed to parse service account JSON: ${parseError.message}`);
      }
      // Create JWT
      const jwt = await this.createJWT(serviceAccount);
      // Exchange JWT for access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt
        })
      });
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${tokenResponse.status} ${errorText}`);
      }
      const tokenData = await tokenResponse.json();
      // Cache the token with expiration buffer
      this.cache.token = tokenData.access_token;
      this.cache.expires = Date.now() + (tokenData.expires_in - 300) * 1000; // 5 min buffer
      console.log('DB: New access token obtained and cached');
      return tokenData.access_token;
    } catch (error) {
      console.error('DB: Access token error:', error);
      throw new Error(`Failed to authenticate with Google Cloud: ${error.message}`);
    }
  }
  /**
   * Get embeddings for a text using Google's text-embedding-gecko model - FIXED BASE64 HANDLING
   */ async getEmbeddings(text) {
    try {
      const accessToken = await this.getAccessToken();
      // Call Google's text-embedding-004 model
      const projectId = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID') || 'cellular-axon-458006-e1';
      const location = Deno.env.get('GOOGLE_CLOUD_LOCATION') || 'us-central1';
      const embeddingResponse = await fetch(`https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/text-embedding-004:predict`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instances: [
            {
              content: text
            }
          ]
        })
      });
      if (!embeddingResponse.ok) {
        const errorText = await embeddingResponse.text();
        throw new Error(`Embedding API error: ${embeddingResponse.status} ${errorText}`);
      }
      const embeddingData = await embeddingResponse.json();
      console.log('DB: Embeddings obtained successfully');
      return embeddingData.predictions[0].embeddings.values;
    } catch (error) {
      console.error('DB: Error getting embeddings:', error);
      // Return null to continue with text-only search instead of throwing
      return null;
    }
  }
  /**
   * Update query with answer and citations
   */ async updateQuery(queryId, answer, citations) {
    try {
      const { error } = await this.supabase.from('queries').update({
        answer: answer,
        citations_json: citations
      }).eq('id', queryId);
      if (error) {
        throw new Error(`Failed to update query: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating query:', error);
      throw error;
    }
  }
  /**
   * Debug method to check recent chunks - ADDED FOR TROUBLESHOOTING
   */ async debugRecentChunks(clientId, limit = 10) {
    try {
      console.log('DEBUG: Checking recent chunks for client:', clientId);
      const { data, error } = await this.supabase.from('chunks').select(`
          id,
          text,
          room_id,
          client_id,
          first_ts,
          last_ts,
          created_at,
          rooms!inner(
            id,
            name,
            room_type
          )
        `).eq('client_id', clientId).order('last_ts', {
        ascending: false
      }).limit(limit);
      if (error) {
        console.error('DEBUG: Error fetching recent chunks:', error);
        return;
      }
      console.log(`DEBUG: Found ${data?.length || 0} recent chunks`);
      if (data && data.length > 0) {
        data.forEach((chunk, index)=>{
          console.log(`DEBUG: Chunk ${index + 1}:`, {
            id: chunk.id,
            room_name: chunk.rooms?.name,
            room_type: chunk.rooms?.room_type,
            first_ts: chunk.first_ts,
            last_ts: chunk.last_ts,
            created_at: chunk.created_at,
            content_preview: chunk.text?.substring(0, 100)
          });
        });
      } else {
        console.log('DEBUG: No chunks found for client');
      }
      return data;
    } catch (error) {
      console.error('DEBUG: Error in debugRecentChunks:', error);
      return null;
    }
  }
  /**
   * Get chunks with enhanced filtering for recency queries - ADDED FOR BETTER RECENCY HANDLING
   */ async getRecentChunks(clientId, options = {}) {
    const { limit = 20, roomType = null, roomName = null, sinceDate = null } = options;
    try {
      let query = this.supabase.from('chunks').select(`
          id,
          text,
          room_id,
          client_id,
          source_upload_id,
          first_ts,
          last_ts,
          participants,
          token_count,
          created_at,
          rooms!inner(
            id,
            name,
            room_type
          )
        `).eq('client_id', clientId);
      // Filter by room type if specified
      if (roomType) {
        query = query.eq('rooms.room_type', roomType);
      }
      // Filter by room name if specified (case insensitive)
      if (roomName) {
        query = query.ilike('rooms.name', `%${roomName}%`);
      }
      // Filter by date if specified
      if (sinceDate) {
        query = query.gte('last_ts', sinceDate);
      }
      const { data, error } = await query.order('last_ts', {
        ascending: false
      }).limit(limit);
      if (error) {
        console.error('Error fetching recent chunks:', error);
        return [];
      }
      console.log(`Found ${data?.length || 0} recent chunks with filters:`, {
        roomType,
        roomName,
        sinceDate,
        limit
      });
      return (data || []).map((chunk)=>({
          ...chunk,
          content: chunk.text,
          room_name: chunk.rooms?.name || 'Unknown Room',
          room_type: chunk.rooms?.room_type || 'unknown',
          similarity_score: 0.9,
          source: 'recency'
        }));
    } catch (error) {
      console.error('Error in getRecentChunks:', error);
      return [];
    }
  }
}
// Export singleton instance
export const db = new DatabaseManager();
