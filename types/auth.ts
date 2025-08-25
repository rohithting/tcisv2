// Professional Session Management Types

export interface TokenStrategy {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  refreshThreshold: number; // When to refresh (5 min buffer)
  lastRefreshed: number;
}

export enum SessionState {
  AUTHENTICATING = 'authenticating',
  ACTIVE = 'active',
  REFRESHING = 'refreshing',
  EXPIRED = 'expired',
  ERROR = 'error',
  INITIALIZING = 'initializing'
}

export interface SessionContext {
  state: SessionState;
  tokens: TokenStrategy | null;
  lastActivity: number;
  healthScore: number; // 0-100 based on token age, activity
  userId: string | null;
  platformRole: string | null;
}

export interface SessionHealthMetrics {
  activeSessions: number;
  averageSessionDuration: number;
  tokenRefreshSuccessRate: number;
  failedAuthAttempts: number;
  sessionExpiryEvents: number;
  userExperienceScore: number; // 0-100
  lastHealthCheck: number;
}

export interface ErrorContext {
  operation: string;
  userId?: string;
  timestamp: number;
  userAgent: string;
  url: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface ErrorReport {
  totalErrors: number;
  errorsByOperation: Record<string, number>;
  errorsByCode: Record<string, number>;
  recentErrors: ErrorContext[];
  suggestions: string[];
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  lastAccessed: number;
}

export interface FallbackAuthResult {
  success: boolean;
  method: 'refresh_token' | 'stored_credentials' | 'silent_reauth' | 'redirect_login';
  newTokens?: TokenStrategy;
  error?: string;
}
