import { useState, useEffect, useCallback, useRef } from 'react';
import { SessionState, SessionContext, SessionHealthMetrics } from '@/types/auth';
import { SessionStateMachine } from '@/lib/session-state-machine';
import { TokenManager } from '@/lib/token-manager';

export interface UseSessionHealthReturn {
  // Current session state
  sessionState: SessionState;
  sessionContext: SessionContext;
  
  // Session health information
  healthScore: number;
  isHealthy: boolean;
  needsRefresh: boolean;
  isExpired: boolean;
  timeUntilExpiry: number;
  timeUntilRefresh: number;
  
  // Session management functions
  refreshSession: () => Promise<boolean>;
  forceRefreshSession: () => Promise<boolean>;
  updateActivity: () => void;
  
  // Health metrics
  healthMetrics: SessionHealthMetrics;
  
  // Loading and error states
  isLoading: boolean;
  error: string | null;
}

export const useSessionHealth = (
  supabase: any,
  userId?: string,
  platformRole?: string
): UseSessionHealthReturn => {
  const [sessionState, setSessionState] = useState<SessionState>(SessionState.INITIALIZING);
  const [sessionContext, setSessionContext] = useState<SessionContext>({
    state: SessionState.INITIALIZING,
    tokens: null,
    lastActivity: Date.now(),
    healthScore: 0,
    userId: null,
    platformRole: null
  });
  
  const [healthMetrics, setHealthMetrics] = useState<SessionHealthMetrics>({
    activeSessions: 0,
    averageSessionDuration: 0,
    tokenRefreshSuccessRate: 100,
    failedAuthAttempts: 0,
    sessionExpiryEvents: 0,
    userExperienceScore: 100,
    lastHealthCheck: Date.now()
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Refs for persistent instances
  const tokenManagerRef = useRef<TokenManager | null>(null);
  const sessionStateMachineRef = useRef<SessionStateMachine | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const metricsUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize token manager and session state machine
  useEffect(() => {
    if (!supabase) return;
    
    tokenManagerRef.current = new TokenManager(supabase);
    sessionStateMachineRef.current = new SessionStateMachine(tokenManagerRef.current);
    
    // Subscribe to state changes
    const unsubscribe = sessionStateMachineRef.current.onStateChange((state, context) => {
      setSessionState(state);
      setSessionContext(context);
      
      // Update health metrics based on state changes
      if (state === SessionState.ERROR) {
        setHealthMetrics(prev => ({
          ...prev,
          failedAuthAttempts: prev.failedAuthAttempts + 1,
          userExperienceScore: Math.max(0, prev.userExperienceScore - 10)
        }));
      } else if (state === SessionState.EXPIRED) {
        setHealthMetrics(prev => ({
          ...prev,
          sessionExpiryEvents: prev.sessionExpiryEvents + 1,
          userExperienceScore: Math.max(0, prev.userExperienceScore - 5)
        }));
      } else if (state === SessionState.ACTIVE) {
        setHealthMetrics(prev => ({
          ...prev,
          userExperienceScore: Math.min(100, prev.userExperienceScore + 2)
        }));
      }
    });
    
    return () => {
      unsubscribe();
      if (sessionStateMachineRef.current) {
        sessionStateMachineRef.current.cleanup();
      }
    };
  }, [supabase]);
  
  // Initialize session when userId and platformRole are available
  useEffect(() => {
    if (!sessionStateMachineRef.current || !userId || !platformRole) return;
    
    const initializeSession = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        await sessionStateMachineRef.current!.initializeSession(userId, platformRole);
      } catch (err: any) {
        setError(err.message || 'Failed to initialize session');
      } finally {
        setIsLoading(false);
      }
    };
    
    initializeSession();
  }, [userId, platformRole]);
  
  // Start health check interval
  useEffect(() => {
    if (!sessionStateMachineRef.current) return;
    
    // Health check every 5 minutes
    healthCheckIntervalRef.current = setInterval(() => {
      if (sessionStateMachineRef.current) {
        const health = sessionStateMachineRef.current.getSessionHealth();
        
        // Update health metrics
        setHealthMetrics(prev => ({
          ...prev,
          lastHealthCheck: Date.now(),
          userExperienceScore: health.isHealthy ? 
            Math.min(100, prev.userExperienceScore + 1) : 
            Math.max(0, prev.userExperienceScore - 1)
        }));
        
        // Auto-refresh if needed
        if (health.needsRefresh && !health.isExpired) {
          refreshSession();
        }
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    // Metrics update every minute
    metricsUpdateIntervalRef.current = setInterval(() => {
      if (sessionStateMachineRef.current) {
        const health = sessionStateMachineRef.current.getSessionHealth();
        
        // Update session duration and other metrics
        setHealthMetrics(prev => ({
          ...prev,
          averageSessionDuration: prev.averageSessionDuration + 1
        }));
      }
    }, 60 * 1000); // 1 minute
    
    return () => {
      if (healthCheckIntervalRef.current) {
        clearInterval(healthCheckIntervalRef.current);
      }
      if (metricsUpdateIntervalRef.current) {
        clearInterval(metricsUpdateIntervalRef.current);
      }
    };
  }, []);
  
  // Refresh session function
  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (!sessionStateMachineRef.current) return false;
    
    try {
      const success = await sessionStateMachineRef.current.refreshSession();
      
      if (success) {
        setHealthMetrics(prev => ({
          ...prev,
          tokenRefreshSuccessRate: Math.min(100, prev.tokenRefreshSuccessRate + 5)
        }));
      } else {
        setHealthMetrics(prev => ({
          ...prev,
          tokenRefreshSuccessRate: Math.max(0, prev.tokenRefreshSuccessRate - 10)
        }));
      }
      
      return success;
    } catch (err: any) {
      setError(err.message || 'Failed to refresh session');
      return false;
    }
  }, []);
  
  // Force refresh session function
  const forceRefreshSession = useCallback(async (): Promise<boolean> => {
    if (!tokenManagerRef.current || !userId) return false;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const newTokens = await tokenManagerRef.current.forceRefreshToken(userId);
      
      if (newTokens && sessionStateMachineRef.current) {
        // Update the state machine with new tokens
        await sessionStateMachineRef.current.refreshSession();
        return true;
      }
      
      return false;
    } catch (err: any) {
      setError(err.message || 'Failed to force refresh session');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);
  
  // Update activity function
  const updateActivity = useCallback(() => {
    if (sessionStateMachineRef.current) {
      sessionStateMachineRef.current.updateActivity();
    }
  }, []);
  
  // Get current health information
  const health = sessionStateMachineRef.current?.getSessionHealth() || {
    healthScore: 0,
    isHealthy: false,
    needsRefresh: false,
    isExpired: true,
    timeUntilExpiry: 0,
    timeUntilRefresh: 0
  };
  
  return {
    // Current session state
    sessionState,
    sessionContext,
    
    // Session health information
    healthScore: health.healthScore,
    isHealthy: health.isHealthy,
    needsRefresh: health.needsRefresh,
    isExpired: health.isExpired,
    timeUntilExpiry: health.timeUntilExpiry,
    timeUntilRefresh: health.timeUntilRefresh,
    
    // Session management functions
    refreshSession,
    forceRefreshSession,
    updateActivity,
    
    // Health metrics
    healthMetrics,
    
    // Loading and error states
    isLoading,
    error
  };
};
