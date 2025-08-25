import { SessionStateMachine } from './session-state-machine';
import { TokenManager } from './token-manager';
import { SessionHealthMetrics } from '@/types/auth';

export class SessionWorker {
  private sessionStateMachine: SessionStateMachine;
  private tokenManager: TokenManager;
  private interval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private healthMetrics: SessionHealthMetrics = {
    activeSessions: 0,
    averageSessionDuration: 0,
    tokenRefreshSuccessRate: 100,
    failedAuthAttempts: 0,
    sessionExpiryEvents: 0,
    userExperienceScore: 100,
    lastHealthCheck: Date.now()
  };

  constructor(sessionStateMachine: SessionStateMachine, tokenManager: TokenManager) {
    this.sessionStateMachine = sessionStateMachine;
    this.tokenManager = tokenManager;
  }

  /**
   * Start the session worker
   */
  start(): void {
    if (this.isRunning) {
      console.warn('Session worker is already running');
      return;
    }

    console.log('🚀 Starting session worker...');
    this.isRunning = true;

    // Main session maintenance loop - runs every minute
    this.interval = setInterval(() => {
      this.maintainSessions();
    }, 60 * 1000);

    // Health check loop - runs every 5 minutes
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 5 * 60 * 1000);

    // Metrics update loop - runs every minute
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, 60 * 1000);

    console.log('✅ Session worker started successfully');
  }

  /**
   * Stop the session worker
   */
  stop(): void {
    if (!this.isRunning) {
      console.warn('Session worker is not running');
      return;
    }

    console.log('🛑 Stopping session worker...');
    this.isRunning = false;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }

    console.log('✅ Session worker stopped successfully');
  }

  /**
   * Check if the worker is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Main session maintenance function
   */
  private async maintainSessions(): Promise<void> {
    try {
      const currentState = this.sessionStateMachine.getCurrentState();
      const context = this.sessionStateMachine.getCurrentContext();

      // Skip if not in active state
      if (currentState !== 'active') {
        return;
      }

      // Check if session needs refresh
      if (this.sessionStateMachine.shouldRefreshSession()) {
        console.log('🔄 Session needs refresh, initiating...');
        
        const success = await this.sessionStateMachine.refreshSession();
        
        if (success) {
          console.log('✅ Session refreshed successfully by worker');
          this.updateHealthMetrics('refresh_success');
        } else {
          console.warn('⚠️ Session refresh failed in worker');
          this.updateHealthMetrics('refresh_failed');
        }
      }

      // Check if session is expired
      if (this.sessionStateMachine.isSessionExpired()) {
        console.warn('⚠️ Session expired, attempting recovery...');
        
        // Try to refresh the session
        const success = await this.sessionStateMachine.refreshSession();
        
        if (success) {
          console.log('✅ Session recovered successfully');
          this.updateHealthMetrics('recovery_success');
        } else {
          console.error('❌ Session recovery failed');
          this.updateHealthMetrics('recovery_failed');
        }
      }

      // Update session activity
      this.sessionStateMachine.updateActivity();

    } catch (error) {
      console.error('❌ Error in session maintenance:', error);
      this.updateHealthMetrics('maintenance_error');
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      console.log('🏥 Performing session health check...');
      
      const health = this.sessionStateMachine.getSessionHealth();
      const currentState = this.sessionStateMachine.getCurrentState();
      
      // Update health metrics
      this.healthMetrics.lastHealthCheck = Date.now();
      
      // Check session health score
      if (health.healthScore < 30) {
        console.warn('⚠️ Session health score is low:', health.healthScore);
        
        // Attempt to improve health
        if (currentState === 'active' && health.needsRefresh) {
          console.log('🔄 Attempting to improve session health...');
          await this.sessionStateMachine.refreshSession();
        }
      }
      
      // Check for stuck states
      if (currentState === 'refreshing') {
        const refreshStartTime = Date.now() - 30000; // 30 seconds ago
        
        if (refreshStartTime > 30000) { // Stuck in refreshing for more than 30 seconds
          console.warn('⚠️ Session stuck in refreshing state, attempting recovery...');
          
          // Force refresh
          if (context.userId) {
            const newTokens = await this.tokenManager.forceRefreshToken(context.userId);
            if (newTokens) {
              console.log('✅ Forced refresh successful');
            }
          }
        }
      }
      
      console.log('✅ Health check completed');

    } catch (error) {
      console.error('❌ Error in health check:', error);
      this.updateHealthMetrics('health_check_error');
    }
  }

  /**
   * Update metrics
   */
  private updateMetrics(): void {
    try {
      const health = this.sessionStateMachine.getSessionHealth();
      
      // Update average session duration
      if (health.isHealthy) {
        this.healthMetrics.averageSessionDuration += 1;
      }
      
      // Update active sessions count
      this.healthMetrics.activeSessions = health.isHealthy ? 1 : 0;
      
      // Calculate user experience score
      let score = this.healthMetrics.userExperienceScore;
      
      if (health.isHealthy) {
        score = Math.min(100, score + 1);
      } else {
        score = Math.max(0, score - 1);
      }
      
      this.healthMetrics.userExperienceScore = score;
      
    } catch (error) {
      console.error('❌ Error updating metrics:', error);
    }
  }

  /**
   * Update health metrics based on events
   */
  private updateHealthMetrics(event: string): void {
    switch (event) {
      case 'refresh_success':
        this.healthMetrics.tokenRefreshSuccessRate = Math.min(100, this.healthMetrics.tokenRefreshSuccessRate + 5);
        break;
      case 'refresh_failed':
        this.healthMetrics.tokenRefreshSuccessRate = Math.max(0, this.healthMetrics.tokenRefreshSuccessRate - 10);
        this.healthMetrics.failedAuthAttempts += 1;
        break;
      case 'recovery_success':
        this.healthMetrics.userExperienceScore = Math.min(100, this.healthMetrics.userExperienceScore + 5);
        break;
      case 'recovery_failed':
        this.healthMetrics.sessionExpiryEvents += 1;
        this.healthMetrics.userExperienceScore = Math.max(0, this.healthMetrics.userExperienceScore - 10);
        break;
      case 'maintenance_error':
        this.healthMetrics.failedAuthAttempts += 1;
        this.healthMetrics.userExperienceScore = Math.max(0, this.healthMetrics.userExperienceScore - 5);
        break;
      case 'health_check_error':
        this.healthMetrics.userExperienceScore = Math.max(0, this.healthMetrics.userExperienceScore - 2);
        break;
    }
  }

  /**
   * Get current health metrics
   */
  getHealthMetrics(): SessionHealthMetrics {
    return { ...this.healthMetrics };
  }

  /**
   * Reset health metrics (for testing/debugging)
   */
  resetHealthMetrics(): void {
    this.healthMetrics = {
      activeSessions: 0,
      averageSessionDuration: 0,
      tokenRefreshSuccessRate: 100,
      failedAuthAttempts: 0,
      sessionExpiryEvents: 0,
      userExperienceScore: 100,
      lastHealthCheck: Date.now()
    };
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      healthMetrics: this.healthMetrics,
      sessionState: this.sessionStateMachine.getCurrentState(),
      sessionHealth: this.sessionStateMachine.getSessionHealth()
    };
  }
}
