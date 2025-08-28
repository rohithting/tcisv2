/**
 * Simple API client functions for TCIS Edge Functions
 */

import { createClient } from '@supabase/supabase-js';

// Utility function to extract error messages from various error types
export function getErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  if (error?.error_description) {
    return error.error_description;
  }
  
  if (error?.error) {
    return error.error;
  }
  
  if (error?.msg) {
    return error.msg;
  }
  
  if (error?.statusText) {
    return error.statusText;
  }
  
  if (error?.status) {
    return `HTTP ${error.status}`;
  }
  
  try {
    return JSON.stringify(error);
  } catch {
    return 'An unknown error occurred';
  }
}

// DEBUG: Enhanced API fetch function with comprehensive debugging for tab switching issue
export async function apiFetch<T>(
  supabase: any,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  console.log(`🚀 [API-CLIENT] Starting API call to: ${endpoint}`);
  console.log(`🚀 [API-CLIENT] Tab visibility: ${document.hidden ? 'HIDDEN' : 'VISIBLE'}`);
  
  // Get current session - let Supabase handle token refresh automatically
  let { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  console.log(`🔍 [API-CLIENT] Session check:`, {
    hasSession: !!session,
    hasToken: !!session?.access_token,
    sessionError: sessionError?.message,
    userId: session?.user?.id,
    expiresAt: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : 'N/A',
    timeUntilExpiry: session?.expires_at ? Math.floor((session.expires_at * 1000 - Date.now()) / 1000) + 's' : 'N/A'
  });
  
  if (sessionError || !session?.access_token) {
    console.log(`⚠️ [API-CLIENT] No valid session, attempting refresh...`);
    // Try one refresh attempt if no valid session
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        console.error(`❌ [API-CLIENT] Session refresh failed:`, refreshError?.message);
        throw new Error('No authenticated session');
      }
      session = refreshData.session;
      console.log(`✅ [API-CLIENT] Session refreshed successfully`);
    } catch (refreshError) {
      console.error(`❌ [API-CLIENT] Session refresh exception:`, refreshError);
      throw new Error('No authenticated session');
    }
  }

  console.log(`📤 [API-CLIENT] Making request with token: ${session.access_token.substring(0, 20)}...`);
  
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  console.log(`📥 [API-CLIENT] Response status: ${response.status} ${response.statusText}`);

  // If we get a 401, try refreshing the session once and retry
  if (response.status === 401) {
    console.log(`🔄 [API-CLIENT] Got 401, attempting token refresh and retry...`);
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshData.session) {
        console.log(`✅ [API-CLIENT] Token refreshed for retry, new token: ${refreshData.session.access_token.substring(0, 20)}...`);
        // Retry the request with the new token
        const retryResponse = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1${endpoint}`, {
          ...options,
          headers: {
            'Authorization': `Bearer ${refreshData.session.access_token}`,
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });
        
        console.log(`📥 [API-CLIENT] Retry response status: ${retryResponse.status} ${retryResponse.statusText}`);
        
        if (!retryResponse.ok) {
          const error = await retryResponse.text();
          console.error(`❌ [API-CLIENT] Retry failed: ${retryResponse.status} ${error}`);
          throw new Error(`API call failed: ${retryResponse.status} ${error}`);
        }
        
        console.log(`✅ [API-CLIENT] Retry successful!`);
        return retryResponse.json();
      } else {
        console.error(`❌ [API-CLIENT] Token refresh failed for retry:`, refreshError?.message);
      }
    } catch (retryError) {
      console.error(`❌ [API-CLIENT] Retry exception:`, retryError);
      // If retry fails, fall through to original error handling
    }
  }

  if (!response.ok) {
    const error = await response.text();
    console.error(`❌ [API-CLIENT] Final API call failed: ${response.status} ${error}`);
    throw new Error(`API call failed: ${response.status} ${error}`);
  }

  console.log(`✅ [API-CLIENT] API call successful!`);
  return response.json();
}

// FIXED: SSE function with proper token handling for tab switching
export async function apiSSE(
  supabase: any,
  endpoint: string,
  request: any,
  handlers: any
): Promise<{ abort: () => void }> {
  // Get current session - let Supabase handle token refresh automatically
  let { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session?.access_token) {
    // Try one refresh attempt if no valid session
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshData.session) {
        throw new Error('No authenticated session');
      }
      session = refreshData.session;
    } catch (refreshError) {
      throw new Error('No authenticated session');
    }
  }

  // Create EventSource-like connection using fetch with streaming
  const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SSE call failed: ${response.status} ${error}`);
  }

  if (!response.body) {
    throw new Error('No response body for streaming');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const processStream = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream completed');
          handlers.onDone?.();
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });
        

        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        let currentEvent = '';
        
        for (const line of lines) {
          const trimmedLine = line.trim();
          
          // Skip empty lines
          if (!trimmedLine) continue;
          
          // Handle SSE event type
          if (trimmedLine.startsWith('event: ')) {
            currentEvent = trimmedLine.slice(7);
            continue;
          }
          
          // Handle SSE data
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6);
            
            // Check for end marker
            if (data === '[DONE]' || currentEvent === 'done') {
              console.log('Received [DONE] marker');
              handlers.onDone?.();
              return;
            }
            
            try {
              const parsed = JSON.parse(data);
              
              // Route based on event type or parsed type
              if (currentEvent === 'token' || parsed.type === 'token') {
                const token = parsed.token || parsed.content || parsed.text || data;
                handlers.onToken?.(token);
              } else if (currentEvent === 'meta' || parsed.type === 'meta') {
                handlers.onMeta?.(parsed);
              } else if (currentEvent === 'citations' || parsed.type === 'citations') {
                handlers.onCitations?.(Array.isArray(parsed) ? parsed : []);
              } else if (currentEvent === 'evaluation' || parsed.type === 'evaluation') {
                handlers.onEvaluationPayload?.(parsed);
              }
            } catch (e) {
              // If it's not JSON, might be direct token content
              if (currentEvent === 'token') {
                handlers.onToken?.(data);
              }
            }
          } else if (trimmedLine && !trimmedLine.startsWith('event:') && !trimmedLine.startsWith('data:')) {
            // Handle token content that comes after event: token without data: prefix
            if (currentEvent === 'token') {
              handlers.onToken?.(trimmedLine);
            }
          }
        }
      }
    } catch (error) {
      console.error('SSE stream error:', error);
      handlers.onError?.(error);
    }
  };

  // Start processing the stream
  processStream();

  return {
    abort: () => {
      console.log('Aborting SSE stream');
      reader.cancel();
    }
  };
}

// Simple SHA256 calculation
export async function calculateSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Simple file upload
export async function uploadFile(signedUrl: string, file: File): Promise<void> {
  await fetch(signedUrl, {
    method: 'PUT',
    body: file,
  });
}

// Simple retry with backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (maxRetries <= 0) throw error;
    
    await new Promise(resolve => setTimeout(resolve, baseDelay));
    return retryWithBackoff(fn, maxRetries - 1, baseDelay * 2);
  }
}

// SSE handlers type
export interface SSEHandlers {
  onToken?: (token: string) => void;
  onMeta?: (data: any) => void;
  onCitations?: (data: any[]) => void;
  onEvaluationPayload?: (data: any) => void;
  onDone?: (data?: any) => void;
  onError?: (error: any) => void;
}
