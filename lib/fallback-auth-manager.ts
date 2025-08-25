import { FallbackAuthResult } from '@/types/auth';
import { TokenManager } from './token-manager';
import { RetryManager } from './retry-manager';

export class FallbackAuthManager {
  private tokenManager: TokenManager;
  private retryManager: RetryManager;
  private supabase: any;

  constructor(tokenManager: TokenManager, supabase: any) {
    this.tokenManager = tokenManager;
    this.supabase = supabase;
    this.retryManager = RetryManager.createForAuth();
  }

  /**
   * Try multiple authentication strategies in order
   */
  async authenticateWithFallback(userId?: string): Promise<FallbackAuthResult> {
    console.log('🔄 Attempting fallback authentication...');

    // Strategy 1: Try refresh token
    const refreshResult = await this.tryRefreshToken();
    if (refreshResult.success) {
      console.log('✅ Authentication successful via refresh token');
      return refreshResult;
    }

    // Strategy 2: Try stored credentials (if available)
    const storedResult = await this.tryStoredCredentials();
    if (storedResult.success) {
      console.log('✅ Authentication successful via stored credentials');
      return storedResult;
    }

    // Strategy 3: Try silent re-authentication
    const silentResult = await this.trySilentReauth();
    if (silentResult.success) {
      console.log('✅ Authentication successful via silent re-auth');
      return silentResult;
    }

    // Strategy 4: Redirect to login (last resort)
    console.log('❌ All fallback strategies failed, redirecting to login');
    return this.redirectToLogin();
  }

  /**
   * Strategy 1: Try refresh token
   */
  private async tryRefreshToken(): Promise<FallbackAuthResult> {
    try {
      console.log('🔄 Strategy 1: Trying refresh token...');
      
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error || !session) {
        return { success: false, method: 'refresh_token', error: 'No session found' };
      }

      // Check if we have a refresh token
      if (!session.refresh_token) {
        return { success: false, method: 'refresh_token', error: 'No refresh token available' };
      }

      // Try to refresh the session
      const { data: refreshData, error: refreshError } = await this.supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        return { success: false, method: 'refresh_token', error: refreshError?.message || 'Refresh failed' };
      }

      // Create new token strategy
      const newTokens = this.tokenManager.createTokenStrategy(refreshData.session);
      
      return {
        success: true,
        method: 'refresh_token',
        newTokens
      };
    } catch (error: any) {
      return { success: false, method: 'refresh_token', error: error.message };
    }
  }

  /**
   * Strategy 2: Try stored credentials (if available)
   */
  private async tryStoredCredentials(): Promise<FallbackAuthResult> {
    try {
      console.log('🔄 Strategy 2: Trying stored credentials...');
      
      // Check if we have stored user data in localStorage
      const storedUser = localStorage.getItem('ting_user_data');
      if (!storedUser) {
        return { success: false, method: 'stored_credentials', error: 'No stored credentials' };
      }

      const userData = JSON.parse(storedUser);
      
      // Check if stored data is still valid
      if (!userData.email || !userData.lastLogin || this.isStoredDataExpired(userData.lastLogin)) {
        localStorage.removeItem('ting_user_data');
        return { success: false, method: 'stored_credentials', error: 'Stored credentials expired' };
      }

      // Try to get a new session using stored data
      // Note: This is a simplified approach - in production you might want more sophisticated credential storage
      const { data, error } = await this.supabase.auth.getSession();
      
      if (error || !data.session) {
        return { success: false, method: 'stored_credentials', error: 'Failed to restore session' };
      }

      const newTokens = this.tokenManager.createTokenStrategy(data.session);
      
      return {
        success: true,
        method: 'stored_credentials',
        newTokens
      };
    } catch (error: any) {
      return { success: false, method: 'stored_credentials', error: error.message };
    }
  }

  /**
   * Strategy 3: Try silent re-authentication
   */
  private async trySilentReauth(): Promise<FallbackAuthResult> {
    try {
      console.log('🔄 Strategy 3: Trying silent re-authentication...');
      
      // Use retry manager for this operation
      const retryResult = await this.retryManager.retryWithBackoff(
        async () => {
          // Try to get current session
          const { data: { session }, error } = await this.supabase.auth.getSession();
          
          if (error || !session) {
            throw new Error('No session available');
          }

          // Validate the session
          const isValid = await this.tokenManager.validateToken(
            this.tokenManager.createTokenStrategy(session)
          );
          
          if (!isValid) {
            throw new Error('Session validation failed');
          }

          return session;
        },
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (!retryResult.success) {
        return { success: false, method: 'silent_reauth', error: retryResult.error?.message || 'Silent re-auth failed' };
      }

      const newTokens = this.tokenManager.createTokenStrategy(retryResult.data);
      
      return {
        success: true,
        method: 'silent_reauth',
        newTokens
      };
    } catch (error: any) {
      return { success: false, method: 'silent_reauth', error: error.message };
    }
  }

  /**
   * Strategy 4: Redirect to login (last resort)
   */
  private redirectToLogin(): FallbackAuthResult {
    console.log('🔄 Strategy 4: Redirecting to login...');
    
    // Store current location for redirect after login
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== '/auth/login') {
        localStorage.setItem('ting_redirect_after_login', currentPath);
      }
    }
    
    // Redirect to login
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login';
    }
    
    return {
      success: false,
      method: 'redirect_login',
      error: 'Redirecting to login page'
    };
  }

  /**
   * Check if stored data is expired
   */
  private isStoredDataExpired(lastLogin: string): boolean {
    const lastLoginTime = new Date(lastLogin).getTime();
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    return (now - lastLoginTime) > maxAge;
  }

  /**
   * Store user data for fallback authentication
   */
  storeUserData(userData: { email: string; id: string; [key: string]: any }): void {
    try {
      const dataToStore = {
        ...userData,
        lastLogin: new Date().toISOString()
      };
      
      localStorage.setItem('ting_user_data', JSON.stringify(dataToStore));
      console.log('✅ User data stored for fallback authentication');
    } catch (error) {
      console.warn('⚠️ Failed to store user data:', error);
    }
  }

  /**
   * Clear stored user data
   */
  clearStoredUserData(): void {
    try {
      localStorage.removeItem('ting_user_data');
      localStorage.removeItem('ting_redirect_after_login');
      console.log('✅ Stored user data cleared');
    } catch (error) {
      console.warn('⚠️ Failed to clear stored user data:', error);
    }
  }

  /**
   * Get redirect path after login
   */
  getRedirectAfterLogin(): string | null {
    try {
      return localStorage.getItem('ting_redirect_after_login');
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear redirect path after login
   */
  clearRedirectAfterLogin(): void {
    try {
      localStorage.removeItem('ting_redirect_after_login');
    } catch (error) {
      console.warn('⚠️ Failed to clear redirect path:', error);
    }
  }
}
