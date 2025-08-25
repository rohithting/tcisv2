import { SessionState, SessionContext, TokenStrategy } from '@/types/auth';
import { TokenManager } from './token-manager';

export class SessionStateMachine {
  private currentState: SessionState;
  private context: SessionContext;
  private tokenManager: TokenManager;
  private stateChangeCallbacks: Array<(state: SessionState, context: SessionContext) => void> = [];

  constructor(tokenManager: TokenManager) {
    this.tokenManager = tokenManager;
    this.currentState = SessionState.INITIALIZING;
    this.context = {
      state: SessionState.INITIALIZING,
      tokens: null,
      lastActivity: Date.now(),
      healthScore: 0,
      userId: null,
      platformRole: null
    };
  }

  /**
   * Get current session state
   */
  getCurrentState(): SessionState {
    return this.currentState;
  }

  /**
   * Get current session context
   */
  getCurrentContext(): SessionContext {
    return { ...this.context };
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(callback: (state: SessionState, context: SessionContext) => void): () => void {
    this.stateChangeCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.stateChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.stateChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: SessionState, contextUpdates: Partial<SessionContext> = {}): void {
    const oldState = this.currentState;
    
    // Validate state transition
    if (!this.isValidTransition(oldState, newState)) {
      console.warn(`Invalid state transition: ${oldState} -> ${newState}`);
      return;
    }

    // Update context
    this.context = {
      ...this.context,
      ...contextUpdates,
      state: newState,
      lastActivity: Date.now()
    };

    // Update current state
    this.currentState = newState;

    console.log(`🔄 Session state transition: ${oldState} -> ${newState}`);

    // Notify subscribers
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(newState, this.context);
      } catch (error) {
        console.error('Error in state change callback:', error);
      }
    });
  }

  /**
   * Validate state transitions
   */
  private isValidTransition(from: SessionState, to: SessionState): boolean {
    const validTransitions: Record<SessionState, SessionState[]> = {
      [SessionState.INITIALIZING]: [SessionState.AUTHENTICATING, SessionState.ERROR],
      [SessionState.AUTHENTICATING]: [SessionState.ACTIVE, SessionState.ERROR],
      [SessionState.ACTIVE]: [SessionState.REFRESHING, SessionState.EXPIRED, SessionState.ERROR],
      [SessionState.REFRESHING]: [SessionState.ACTIVE, SessionState.EXPIRED, SessionState.ERROR],
      [SessionState.EXPIRED]: [SessionState.AUTHENTICATING, SessionState.ERROR],
      [SessionState.ERROR]: [SessionState.AUTHENTICATING, SessionState.INITIALIZING]
    };

    return validTransitions[from]?.includes(to) || false;
  }

  /**
   * Initialize session
   */
  async initializeSession(userId: string, platformRole: string): Promise<void> {
    try {
      this.transitionTo(SessionState.AUTHENTICATING, {
        userId,
        platformRole
      });

      // Get current session
      const { data: { session }, error } = await this.tokenManager.supabase.auth.getSession();
      
      if (error || !session) {
        this.transitionTo(SessionState.ERROR, {
          healthScore: 0
        });
        return;
      }

      // Create token strategy
      const tokens = this.tokenManager.createTokenStrategy(session);
      const healthScore = this.tokenManager.calculateHealthScore(tokens);

      this.transitionTo(SessionState.ACTIVE, {
        tokens,
        healthScore
      });

      console.log(`✅ Session initialized for user ${userId}`);
    } catch (error) {
      console.error('❌ Session initialization failed:', error);
      this.transitionTo(SessionState.ERROR, {
        healthScore: 0
      });
    }
  }

  /**
   * Refresh session tokens
   */
  async refreshSession(): Promise<boolean> {
    if (this.currentState !== SessionState.ACTIVE) {
      console.warn('Cannot refresh session: not in ACTIVE state');
      return false;
    }

    if (!this.context.tokens || !this.context.userId) {
      console.warn('Cannot refresh session: missing tokens or userId');
      return false;
    }

    try {
      this.transitionTo(SessionState.REFRESHING);

      const newTokens = await this.tokenManager.refreshAccessToken(
        this.context.tokens.refreshToken,
        this.context.userId
      );

      if (!newTokens) {
        this.transitionTo(SessionState.EXPIRED, {
          tokens: null,
          healthScore: 0
        });
        return false;
      }

      const healthScore = this.tokenManager.calculateHealthScore(newTokens);

      this.transitionTo(SessionState.ACTIVE, {
        tokens: newTokens,
        healthScore
      });

      console.log(`✅ Session refreshed successfully`);
      return true;
    } catch (error) {
      console.error('❌ Session refresh failed:', error);
      this.transitionTo(SessionState.ERROR, {
        healthScore: 0
      });
      return false;
    }
  }

  /**
   * Update session activity
   */
  updateActivity(): void {
    if (this.currentState === SessionState.ACTIVE) {
      this.context.lastActivity = Date.now();
      
      // Update health score based on activity
      if (this.context.tokens) {
        this.context.healthScore = this.tokenManager.calculateHealthScore(this.context.tokens);
      }
    }
  }

  /**
   * Check if session needs refresh
   */
  shouldRefreshSession(): boolean {
    if (!this.context.tokens || this.currentState !== SessionState.ACTIVE) {
      return false;
    }

    return this.tokenManager.shouldRefreshToken(this.context.tokens);
  }

  /**
   * Check if session is expired
   */
  isSessionExpired(): boolean {
    if (!this.context.tokens) {
      return true;
    }

    return this.tokenManager.isTokenExpired(this.context.tokens);
  }

  /**
   * Get session health information
   */
  getSessionHealth() {
    if (!this.context.tokens) {
      return {
        healthScore: 0,
        isHealthy: false,
        needsRefresh: false,
        isExpired: true,
        timeUntilExpiry: 0,
        timeUntilRefresh: 0
      };
    }

    const expiryInfo = this.tokenManager.getTokenExpiryInfo(this.context.tokens);
    
    return {
      healthScore: this.context.healthScore,
      isHealthy: this.context.healthScore > 50,
      needsRefresh: expiryInfo.needsRefresh,
      isExpired: expiryInfo.isExpired,
      timeUntilExpiry: expiryInfo.timeUntilExpiry,
      timeUntilRefresh: expiryInfo.timeUntilRefresh
    };
  }

  /**
   * Handle authentication error
   */
  handleAuthError(error: any): void {
    console.error('🚨 Authentication error:', error);
    
    this.transitionTo(SessionState.ERROR, {
      healthScore: 0
    });
  }

  /**
   * Reset session to initial state
   */
  resetSession(): void {
    this.transitionTo(SessionState.INITIALIZING, {
      tokens: null,
      lastActivity: Date.now(),
      healthScore: 0,
      userId: null,
      platformRole: null
    });
  }

  /**
   * Clean up session
   */
  cleanup(): void {
    this.stateChangeCallbacks = [];
    this.resetSession();
  }
}
