/**
 * Simple API Client for TCIS Edge Functions
 * Handles authentication, request/response formatting, and error handling
 * Simplified for reliability and performance
 */

// API Base URL for Edge Functions
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;

// Types for API responses
export interface ApiError {
  error_code: string;
  message: string;
  details?: any;
  status?: number;
  path?: string;
}

export interface ApiResponse<T = any> {
  data?: T;
  error?: ApiError;
}

/**
 * Generate correlation ID for request tracking
 */
function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Force refresh the current session token
 */
async function forceRefreshToken(supabase: any): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.refreshSession();
    
    if (error) {
      return null;
    }
    
    if (data.session) {
      return data.session.access_token;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Get current session token for authentication
 * Simplified for reliability
 */
async function getAuthToken(supabase: any): Promise<string | null> {
  try {
    // Get current session
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return null;
    }

    // Check if token is about to expire (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const tokenExp = session.expires_at || 0;
    
    if (tokenExp - now < 300) { // 5 minutes buffer
      // Refresh the token
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        return null;
      }
      
      return refreshData.session.access_token;
    }
    
    return session.access_token;
  } catch (error) {
    return null;
  }
}

/**
 * Safe JSON parsing with error handling
 */
async function safeJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch (error) {
    return {
      error_code: 'E_PARSE_ERROR',
      message: 'Failed to parse response',
      details: error
    };
  }
}

/**
 * Simple API fetch function
 */
export async function apiFetch<T = any>(
  supabase: any,
  path: string,
  init?: RequestInit
): Promise<T> {
  const correlationId = generateCorrelationId();
  
  // Get authentication token
  let token = await getAuthToken(supabase);
  
  if (!token) {
    // Instead of immediately throwing an error, try to refresh the session once
    try {
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        throw {
          error_code: 'E_UNAUTHORIZED',
          message: 'Authentication required',
          status: 401,
        } as ApiError;
      }
      
      token = refreshData.session.access_token;
    } catch (refreshError) {
      throw {
        error_code: 'E_UNAUTHORIZED',
        message: 'Authentication required',
        status: 401,
      } as ApiError;
    }
  }

  const url = `${API_BASE_URL}${path}`;
  
  // Simple, direct fetch approach
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'x-corr-id': correlationId,
        ...init?.headers,
      },
    });
    
    // If we get an authentication error, try refreshing the token once
    if (response.status === 401) {
      const refreshedToken = await forceRefreshToken(supabase);
      if (refreshedToken) {
        // Retry with new token
        const retryResponse = await fetch(url, {
          ...init,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${refreshedToken}`,
            'x-corr-id': correlationId,
            ...init?.headers,
          },
        });
        
        if (!retryResponse.ok) {
          const errorData = await safeJson(retryResponse);
          throw {
            status: retryResponse.status,
            path,
            ...errorData,
          } as ApiError;
        }
        
        const result = await retryResponse.json();
        return result;
      }
    }
    
    if (!response.ok) {
      const errorData = await safeJson(response);
      throw {
        status: response.status,
        path,
        ...errorData,
      } as ApiError;
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    throw error;
  }
}

/**
 * Simple SSE function for streaming responses
 */
export async function apiSSE<T = any>(
  supabase: any,
  path: string,
  request: T,
  handlers: {
    onMeta?: (meta: any) => void;
    onToken?: (token: string) => void;
    onCitations?: (citations: any[]) => void;
    onEvaluationPayload?: (evaluation: any) => void;
    onDone?: (doneData: any) => void;
    onError?: (error: any) => void;
  }
): Promise<{ abort: () => void }> {
  const correlationId = generateCorrelationId();
  
  // Get authentication token
  const token = await getAuthToken(supabase);
  
  if (!token) {
    throw {
      error_code: 'E_UNAUTHORIZED',
      message: 'Authentication required',
      status: 401,
    } as ApiError;
  }

  const url = `${API_BASE_URL}${path}`;
  
  // Use fetch with streaming for SSE instead of EventSource (which doesn't support headers)
  const response = await fetch(`${url}?data=${encodeURIComponent(JSON.stringify(request))}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-corr-id': correlationId,
      'Accept': 'text/event-stream',
    },
  });

  if (!response.ok) {
    const errorData = await safeJson(response);
    throw { status: response.status, path, ...errorData } as ApiError;
  }

  if (!response.body) {
    throw {
      error_code: 'E_STREAM_ERROR',
      message: 'No response body for streaming',
      status: 500,
    } as ApiError;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const processStream = async () => {
    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'meta' && handlers.onMeta) {
                handlers.onMeta(data.data);
              } else if (data.type === 'token' && handlers.onToken) {
                handlers.onToken(data.data);
              } else if (data.type === 'citations' && handlers.onCitations) {
                handlers.onCitations(data.data);
              } else if (data.type === 'evaluation' && handlers.onEvaluationPayload) {
                handlers.onEvaluationPayload(data.data);
              } else if (data.type === 'done' && handlers.onDone) {
                handlers.onDone(data.data);
                return;
              } else if (data.type === 'error' && handlers.onError) {
                handlers.onError(data.data);
                return;
              }
            } catch (error) {
              if (handlers.onError) {
                handlers.onError(error);
              }
              return;
            }
          }
        }
      }
    } catch (error) {
      if (handlers.onError) {
        handlers.onError(error);
      }
    } finally {
      reader.releaseLock();
    }
  };

  // Start processing the stream
  processStream();

  return {
    abort: () => {
      reader.cancel();
    }
  };
}

/**
 * Utility functions
 */
export function calculateSHA256(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        resolve(hashHex);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export async function uploadFile(
  signedUrl: string,
  file: File
): Promise<void> {
  // Simple file upload to signed URL
  const response = await fetch(signedUrl, {
    method: 'PUT',
    body: file,
    headers: {
      'Content-Type': file.type,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }
}

export function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    let retries = 0;
    
    const attempt = async () => {
      try {
        const result = await operation();
        resolve(result);
      } catch (error) {
        retries++;
        
        if (retries >= maxRetries) {
          reject(error);
          return;
        }
        
        const delay = baseDelay * Math.pow(2, retries - 1);
        setTimeout(attempt, delay);
      }
    };
    
    attempt();
  });
}

export type SSEHandlers = {
  onMeta?: (meta: any) => void;
  onToken?: (token: string) => void;
  onCitations?: (citations: any[]) => void;
  onEvaluationPayload?: (evaluation: any) => void;
  onDone?: (doneData: any) => void;
  onError?: (error: any) => void;
};

/**
 * Extract error message from various error types
 */
export function getErrorMessage(error: any): string {
  if (typeof error === 'string') {
    return error;
  }
  
  if (error?.message) {
    return error.message;
  }
  
  if (error?.error_code) {
    return `${error.error_code}: ${error.message || 'Unknown error'}`;
  }
  
  if (error?.details) {
    return error.details;
  }
  
  return 'An unexpected error occurred';
}
