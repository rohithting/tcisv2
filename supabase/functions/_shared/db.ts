// Database utility functions
// Provides typed queries and database operations for the Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
class DatabaseManager {
  supabase;
  constructor(){
    this.supabase = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
  }
  /**
   * Hybrid search combining vector similarity and text search
   */ async hybridSearch(params) {
    const { client_id, filters, queryVec, question } = params;
    let vectorTop = [];
    let textTop = [];
    try {
      // Build base query for chunks using correct field names
      let baseQuery = this.supabase.from('chunks').select(`
          id,
          content,
          room_id,
          client_id,
          upload_id,
          metadata,
          chunk_index,
          token_count,
          created_at
        `).eq('client_id', client_id);
      // Apply filters - only room_ids for now to avoid blocking results
      if (filters?.room_ids && filters.room_ids.length > 0) {
        baseQuery = baseQuery.in('room_id', filters.room_ids);
      }
      // Temporarily disable date filters to debug retrieval issues
      // if (filters?.date_from) {
      //   baseQuery = baseQuery.gte('created_at', filters.date_from);
      // }
      // if (filters?.date_to) {
      //   baseQuery = baseQuery.lte('created_at', filters.date_to);
      // }
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
                text: item.content // Normalize field name for MMR
              }));
          }
        } catch (vectorErr) {
          console.warn('Vector search failed:', vectorErr);
          vectorTop = [];
        }
      }
      // Text search using content field - more permissive
      try {
        const { data: textData, error: textError } = await baseQuery.textSearch('content', question, {
          type: 'plain',
          config: 'english'
        }).limit(100); // Increase limit
        if (textError) {
          console.error('Text search error:', textError);
          textTop = [];
        } else {
          textTop = (textData || []).map((item)=>({
              ...item,
              text: item.content,
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
          similarity: vectorTop[0].similarity_score
        });
      }
      if (textTop.length > 0) {
        console.log('Sample text result:', {
          id: textTop[0].id,
          content: textTop[0].content?.substring(0, 100)
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
   * Create proper JWT for Google Cloud authentication
   */ async createJWT(serviceAccount) {
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
    // Encode header and payload
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const data = `${encodedHeader}.${encodedPayload}`;
    // Import the private key - handle \n characters properly
    let privateKeyPem = serviceAccount.private_key;
    // Debug log the private key format
    console.log('Private key preview:', privateKeyPem.substring(0, 100));
    // Replace literal \n with actual newlines if needed
    if (privateKeyPem.includes('\\n')) {
      privateKeyPem = privateKeyPem.replace(/\\n/g, '\n');
      console.log('Converted \\n to newlines');
    }
    // Extract the base64 content more carefully
    const lines = privateKeyPem.split('\n');
    const pemContent = lines.filter((line)=>!line.includes('-----BEGIN') && !line.includes('-----END') && line.trim().length > 0).join('');
    console.log('PEM content length:', pemContent.length);
    console.log('PEM content preview:', pemContent.substring(0, 50));
    try {
      // Convert PEM to binary
      const binaryDer = Uint8Array.from(atob(pemContent), (c)=>c.charCodeAt(0));
      // Import the key
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
      return `${data}.${encodedSignature}`;
    } catch (error) {
      console.error('JWT creation failed:', error);
      console.error('PEM content that failed:', pemContent);
      throw error;
    }
  }
  /**
   * Get embeddings for a text using Google's text-embedding-gecko model
   * FIXED: Proper JWT implementation
   */ async getEmbeddings(text) {
    try {
      // Get service account JSON from environment variable
      const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');
      if (!serviceAccountJson) {
        console.warn('GOOGLE_SERVICE_ACCOUNT_JSON not set, skipping embeddings');
        return null;
      }
      console.log('DB: Service account JSON length:', serviceAccountJson.length);
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(serviceAccountJson);
        console.log('DB: JSON parsed successfully, client_email:', serviceAccount.client_email);
      } catch (parseError) {
        console.error('DB: JSON parse error:', parseError);
        throw new Error(`Failed to parse service account JSON: ${parseError.message}`);
      }
      // Create proper JWT
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
        throw new Error(`Failed to get access token: ${errorText}`);
      }
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      // Call Google's text-embedding-gecko model
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
      console.log('Embeddings obtained successfully');
      return embeddingData.predictions[0].embeddings.values;
    } catch (error) {
      console.error('Error getting embeddings:', error);
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
}
// Export singleton instance
export const db = new DatabaseManager();
