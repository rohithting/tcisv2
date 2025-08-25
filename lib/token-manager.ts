import { createClient } from '@supabase/supabase-js';
import { TokenStrategy, SessionState } from '@/types/auth';

const REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry
const MAX_REFRESH_ATTEMPTS = 3;
const REFRESH_BACKOFF_BASE = 1000; // 1 second base delay

export class TokenManager {
  private supabase: any;
  private refreshAttempts: Map<string, number> = new Map();

  constructor(supabase: any) {
    this.supabase = supabase;
  }

  /**
   * Create a token strategy from a Supabase session
   */
  createTokenStrategy(session: any): TokenStrategy {
    const now = Date.now();
    const expiresAt = (session.expires_at || 0) * 1000; // Convert to milliseconds
    
    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt,
      refreshThreshold: REFRESH_THRESHOLD,
      lastRefreshed: now
    };
  }

  /**
   * Check if token needs refresh
   */
  shouldRefreshToken(tokens: TokenStrategy): boolean {
    const now = Date.now();
    const timeUntilExpiry = tokens.expiresAt - now;
    return timeUntilExpiry < tokens.refreshThreshold;
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(tokens: TokenStrategy): boolean {
    const now = Date.now();
    return tokens.expiresAt <= now;
  }

  /**
   * Calculate token health score (0-100)
   */
  calculateHealthScore(tokens: TokenStrategy): number {
    const now = Date.now();
    const totalLifetime = 3600 * 1000; // 1 hour in milliseconds
    const timeUntilExpiry = tokens.expiresAt - now;
    
    if (timeUntilExpiry <= 0) return 0;
    if (timeUntilExpiry >= totalLifetime) return 100;
    
    const healthPercentage = (timeUntilExpiry / totalLifetime) * 100;
    return Math.max(0, Math.min(100, Math.round(healthPercentage)));
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string, userId: string): Promise<TokenStrategy | null> {
    const attemptCount = this.refreshAttempts.get(userId) || 0;
    
    if (attemptCount >= MAX_REFRESH_ATTEMPTS) {
      console.error(`Max refresh attempts (${MAX_REFRESH_ATTEMPTS}) exceeded for user ${userId}`);
      return null;
    }

    try {
      console.log(`🔄 Refreshing token for user ${userId}, attempt ${attemptCount + 1}`);
      
      const { data, error } = await this.supabase.auth.refreshSession();
      
      if (error) {
        throw error;
      }

      if (!data.session) {
        throw new Error('No session returned from refresh');
      }

      // Reset refresh attempts on success
      this.refreshAttempts.delete(userId);
      
      const newTokens = this.createTokenStrategy(data.session);
      console.log(`✅ Token refreshed successfully for user ${userId}`);
      
      return newTokens;
    } catch (error: any) {
      console.error(`❌ Token refresh failed for user ${userId}:`, error);
      
      // Increment attempt count
      this.refreshAttempts.set(userId, attemptCount + 1);
      
      // If this was the last attempt, clear the user's session
      if (attemptCount + 1 >= MAX_REFRESH_ATTEMPTS) {
        console.error(`🚨 Max refresh attempts reached for user ${userId}, clearing session`);
        await this.supabase.auth.signOut();
      }
      
      return null;
    }
  }

  /**
   * Force refresh token (for manual refresh)
   */
  async forceRefreshToken(userId: string): Promise<TokenStrategy | null> {
    try {
      console.log(`🔄 Force refreshing token for user ${userId}`);
      
      const { data, error } = await this.supabase.auth.refreshSession();
      
      if (error) {
        throw error;
      }

      if (!data.session) {
        throw new Error('No session returned from force refresh');
      }

      const newTokens = this.createTokenStrategy(data.session);
      console.log(`✅ Token force refreshed successfully for user ${userId}`);
      
      return newTokens;
    } catch (error: any) {
      console.error(`❌ Force token refresh failed for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Validate token without refreshing
   */
  async validateToken(tokens: TokenStrategy): Promise<boolean> {
    try {
      // Check if token is expired
      if (this.isTokenExpired(tokens)) {
        return false;
      }

      // Make a lightweight API call to validate token
      const { data, error } = await this.supabase.auth.getUser();
      
      if (error) {
        return false;
      }

      return !!data.user;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get token expiry information
   */
  getTokenExpiryInfo(tokens: TokenStrategy) {
    const now = Date.now();
    const timeUntilExpiry = tokens.expiresAt - now;
    const timeUntilRefresh = timeUntilExpiry - tokens.refreshThreshold;
    
    return {
      isExpired: timeUntilExpiry <= 0,
      needsRefresh: timeUntilRefresh <= 0,
      timeUntilExpiry,
      timeUntilRefresh,
      expiresAt: new Date(tokens.expiresAt),
      lastRefreshed: new Date(tokens.lastRefreshed)
    };
  }

  /**
   * Clear refresh attempts for a user
   */
  clearRefreshAttempts(userId: string): void {
    this.refreshAttempts.delete(userId);
  }

  /**
   * Get refresh attempt count for a user
   */
  getRefreshAttempts(userId: string): number {
    return this.refreshAttempts.get(userId) || 0;
  }

  /**
   * Reset all refresh attempts (for testing/debugging)
   */
  resetAllRefreshAttempts(): void {
    this.refreshAttempts.clear();
  }
}

// Singleton instance
let tokenManagerInstance: TokenManager | null = null;

export const getTokenManager = (supabase: any): TokenManager => {
  if (!tokenManagerInstance) {
    tokenManagerInstance = new TokenManager(supabase);
  }
  return tokenManagerInstance;
};
