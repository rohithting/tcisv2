/**
 * Professional API Client for TCIS Edge Functions
 * Directly integrated with Professional Session Management
 * Ensures seamless authentication and optimal performance
 */

import { TokenManager } from './token-manager';
import { RetryManager } from './retry-manager';
import { ApiError } from '@/types/api';

// API Base URL for Edge Functions
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1`;

console.log('🌐 Professional API Client: API Base URL configured:', {
  envUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  finalUrl: API_BASE_URL
});

/**
 * Generate correlation ID for request tracking
 */
function generateCorrelationId(): string {
  return crypto.randomUUID();
}

/**
 * Professional API client with integrated session management
 */
export class ProfessionalApiClient {
  private tokenManager: TokenManager;
  private retryManager: RetryManager;
  private supabase: any;

  constructor(supabase: any) {
    this.supabase = supabase;
    this.tokenManager = new TokenManager(supabase);
    this.retryManager = RetryManager.createForAuth();
  }

  /**
   * Get authentication token with professional session management
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      console.log('🔐 Professional API Client: Getting auth token...');
      
      // Get current session
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error || !session) {
        console.log('❌ Professional API Client: No session found');
        return null;
      }

      // Create token strategy
      const tokens = this.tokenManager.createTokenStrategy(session);
      
      // Check if token needs refresh
      if (this.tokenManager.shouldRefreshToken(tokens)) {
        console.log('🔄 Professional API Client: Token needs refresh, initiating...');
        
        // Use retry manager for token refresh
        const refreshResult = await this.retryManager.retryWithStrategy(
          async () => {
            const { data: refreshData, error: refreshError } = await this.supabase.auth.refreshSession();
            
            if (refreshError || !refreshData.session) {
              throw new Error(refreshError?.message || 'Refresh failed');
            }
            
            return refreshData.session.access_token;
          },
          {
            authError: async () => {
              // For auth errors, try to get a new session
              const { data: { session: newSession } } = await this.supabase.auth.getSession();
              return !!newSession;
            },
            networkError: async () => true, // Retry network errors
            serverError: async () => true,  // Retry server errors
            default: async () => false      // Don't retry other errors
          }
        );

        if (refreshResult.success) {
          console.log('✅ Professional API Client: Token refreshed successfully');
          return refreshResult.data;
        } else {
          console.log('❌ Professional API Client: Token refresh failed');
          return null;
        }
      }

      console.log('✅ Professional API Client: Token is healthy');
      return session.access_token;
    } catch (error: any) {
      console.error('❌ Professional API Client: Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Make an authenticated API request with professional session management
   */
  async request<T = any>(
    path: string,
    init?: RequestInit
  ): Promise<T> {
    const correlationId = generateCorrelationId();
    
    console.log('🚀 Professional API Client: Making request', {
      path,
      method: init?.method || 'GET',
      correlationId
    });

    // Get authentication token
    const token = await this.getAuthToken();
    
    if (!token) {
      console.log('❌ Professional API Client: No auth token available');
      throw {
        error_code: 'E_UNAUTHORIZED',
        message: 'Authentication required',
        status: 401,
        path,
      } as ApiError;
    }

    console.log('🔑 Professional API Client: Token obtained', {
      hasToken: !!token,
      tokenLength: token.length,
      tokenPreview: `${token.substring(0, 20)}...`
    });

    const url = `${API_BASE_URL}${path}`;
    
    console.log('🌐 Professional API Client: About to make request', {
      url,
      hasRetryManager: !!this.retryManager,
      retryManagerType: this.retryManager.constructor.name
    });
    
    // Use retry manager for the entire request
    console.log('🔄 Professional API Client: Starting retry strategy...');
    
    // TEMPORARY: Test without retry manager to isolate the issue
    try {
      console.log('🧪 Professional API Client: Testing direct fetch without retry manager...');
      
      // Test basic fetch functionality first
      console.log('🧪 Professional API Client: Testing basic fetch...');
      const testResponse = await fetch('https://httpbin.org/get');
      console.log('✅ Professional API Client: Basic fetch test successful:', testResponse.status);
      
      const directResponse = await fetch(url, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-corr-id': correlationId,
          ...init?.headers,
        },
      });
      
      console.log('✅ Professional API Client: Direct fetch successful:', {
        status: directResponse.status,
        statusText: directResponse.statusText,
        ok: directResponse.ok
      });
      
      // If direct fetch works, return it
      if (directResponse.ok) {
        return directResponse;
      }
      
      console.log('⚠️ Professional API Client: Direct fetch returned non-OK status, trying retry manager...');
    } catch (directError) {
      console.log('⚠️ Professional API Client: Direct fetch failed, trying retry manager:', directError);
    }
    
    const retryResult = await this.retryManager.retryWithStrategy(
      async () => {
        console.log('🚀 Professional API Client: Inside retry strategy, making fetch request...');
        
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
          
          console.log('✅ Professional API Client: Fetch request completed:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok
          });
          
          return response;
        } catch (fetchError) {
          console.error('❌ Professional API Client: Fetch request failed:', fetchError);
          throw fetchError;
        }

        // Handle authentication errors
        if (response.status === 401) {
          console.log('🔄 Professional API Client: Authentication failed, refreshing token...');
          
          const newToken = await this.getAuthToken();
          if (newToken && newToken !== token) {
            console.log('✅ Professional API Client: Got new token, retrying...');
            
            // Retry with new token
            const retryResponse = await fetch(url, {
              ...init,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${newToken}`,
                'x-corr-id': correlationId,
                ...init?.headers,
              },
            });
            
            return retryResponse;
          }
        }

        return response;
      },
      {
        authError: async () => {
          console.log('🔄 Professional API Client: Auth error, attempting token refresh...');
          // For auth errors, try to refresh token
          const newToken = await this.getAuthToken();
          console.log('🔄 Professional API Client: Token refresh result:', { success: !!newToken });
          return !!newToken;
        },
        networkError: async () => {
          console.log('🔄 Professional API Client: Network error, will retry');
          return true; // Retry network errors
        },
        serverError: async () => {
          console.log('🔄 Professional API Client: Server error, will retry');
          return true; // Retry server errors
        },
        default: async () => {
          console.log('🔄 Professional API Client: Other error, will not retry');
          return false; // Don't retry other errors
        }
      }
    );

    console.log('📊 Professional API Client: Retry result:', {
      success: retryResult.success,
      hasData: !!retryResult.data,
      error: retryResult.error,
      dataType: retryResult.data?.constructor?.name
    });
    
    if (!retryResult.success) {
      console.log('❌ Professional API Client: Request failed after retries');
      throw retryResult.error;
    }

    const response = retryResult.data;

    if (!response.ok) {
      const errorData = await this.safeJson(response);
      
      console.log('🚨 Professional API Client: Request failed', {
        status: response.status,
        path,
        errorData,
        correlationId
      });

      throw {
        status: response.status,
        path,
        ...errorData,
      } as ApiError;
    }

    console.log('✅ Professional API Client: Request successful', {
      status: response.status,
      path,
      correlationId
    });

    const result = await response.json();
    return result;
  }

  /**
   * Safe JSON parsing with error handling
   */
  private async safeJson(response: Response): Promise<any> {
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
   * Make a GET request
   */
  async get<T = any>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: 'GET' });
  }

  /**
   * Make a POST request
   */
  async post<T = any>(path: string, body?: any, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...init,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make a PUT request
   */
  async put<T = any>(path: string, body?: any, init?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...init,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Make a DELETE request
   */
  async delete<T = any>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...init, method: 'DELETE' });
  }

  /**
   * Get token manager for external use
   */
  getTokenManager(): TokenManager {
    return this.tokenManager;
  }

  /**
   * Get retry manager for external use
   */
  getRetryManager(): RetryManager {
    return this.retryManager;
  }
}

// Export singleton instance
let professionalApiClientInstance: ProfessionalApiClient | null = null;

export const getProfessionalApiClient = (supabase: any): ProfessionalApiClient => {
  if (!professionalApiClientInstance) {
    professionalApiClientInstance = new ProfessionalApiClient(supabase);
  }
  return professionalApiClientInstance;
};
