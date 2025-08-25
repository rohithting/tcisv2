import { SessionStateMachine } from './session-state-machine';
import { TokenManager } from './token-manager';

export class SessionHeartbeat {
  private sessionStateMachine: SessionStateMachine;
  private tokenManager: TokenManager;
  private supabase: any;
  private pingInterval: NodeJS.Timeout | null = null;
  private realtimeChannel: any = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // Start with 1 second

  constructor(
    sessionStateMachine: SessionStateMachine,
    tokenManager: TokenManager,
    supabase: any
  ) {
    this.sessionStateMachine = sessionStateMachine;
    this.tokenManager = tokenManager;
    this.supabase = supabase;
  }

  /**
   * Start the heartbeat system
   */
  start(): void {
    console.log('💓 Starting session heartbeat...');
    
    // Start ping interval
    this.startPingInterval();
    
    // Connect to realtime
    this.connectRealtime();
  }

  /**
   * Stop the heartbeat system
   */
  stop(): void {
    console.log('🛑 Stopping session heartbeat...');
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
      this.realtimeChannel = null;
    }
    
    this.isConnected = false;
    console.log('✅ Session heartbeat stopped');
  }

  /**
   * Check if heartbeat is active
   */
  isActive(): boolean {
    return this.isConnected && this.pingInterval !== null;
  }

  /**
   * Start ping interval for session keepalive
   */
  private startPingInterval(): void {
    // Send ping every 30 seconds to keep session alive
    this.pingInterval = setInterval(async () => {
      try {
        await this.sendPing();
      } catch (error) {
        console.warn('⚠️ Ping failed:', error);
      }
    }, 30 * 1000); // 30 seconds
  }

  /**
   * Send a ping to keep session alive
   */
  private async sendPing(): Promise<void> {
    try {
      // Lightweight session validation
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        console.warn('⚠️ Ping validation failed:', error);
        return;
      }

      if (!session) {
        console.warn('⚠️ No session found during ping');
        return;
      }

      // Update session activity in state machine
      this.sessionStateMachine.updateActivity();
      
      // Check if session needs refresh
      if (this.sessionStateMachine.shouldRefreshSession()) {
        console.log('🔄 Session needs refresh during ping, initiating...');
        await this.sessionStateMachine.refreshSession();
      }

      console.log('💓 Ping sent successfully');
    } catch (error) {
      console.error('❌ Error sending ping:', error);
    }
  }

  /**
   * Connect to Supabase Realtime
   */
  private connectRealtime(): void {
    try {
      // Subscribe to auth state changes
      this.realtimeChannel = this.supabase.auth.onAuthStateChange(
        async (event: string, session: any) => {
          console.log(`🔔 Auth state change: ${event}`);
          
          switch (event) {
            case 'TOKEN_REFRESHED':
              console.log('🔄 Token refreshed via realtime');
              if (session) {
                // Update state machine with new session
                await this.handleTokenRefresh(session);
              }
              break;
              
            case 'SIGNED_OUT':
              console.log('🚪 User signed out via realtime');
              this.sessionStateMachine.resetSession();
              break;
              
            case 'SIGNED_IN':
              console.log('🚪 User signed in via realtime');
              if (session?.user?.id) {
                // Initialize session in state machine
                await this.sessionStateMachine.initializeSession(
                  session.user.id,
                  'user' // Default role, will be updated later
                );
              }
              break;
          }
        }
      );

      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      
      console.log('✅ Realtime connection established');
    } catch (error) {
      console.error('❌ Failed to connect to realtime:', error);
      this.handleRealtimeError();
    }
  }

  /**
   * Handle realtime connection errors
   */
  private handleRealtimeError(): void {
    this.isConnected = false;
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      // Exponential backoff for reconnection
      setTimeout(() => {
        this.connectRealtime();
      }, this.reconnectDelay);
      
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
    } else {
      console.error('❌ Max reconnection attempts reached, falling back to ping-only mode');
      // Continue with ping interval but without realtime
    }
  }

  /**
   * Handle token refresh from realtime
   */
  private async handleTokenRefresh(session: any): Promise<void> {
    try {
      if (!session?.user?.id) {
        console.warn('⚠️ Invalid session data during token refresh');
        return;
      }

      // Create new token strategy
      const newTokens = this.tokenManager.createTokenStrategy(session);
      
      // Update state machine
      const context = this.sessionStateMachine.getCurrentContext();
      if (context.userId === session.user.id) {
        // Update existing session
        await this.sessionStateMachine.refreshSession();
      } else {
        // Initialize new session
        await this.sessionStateMachine.initializeSession(
          session.user.id,
          context.platformRole || 'user'
        );
      }
      
      console.log('✅ Token refresh handled successfully via realtime');
    } catch (error) {
      console.error('❌ Error handling token refresh:', error);
    }
  }

  /**
   * Force a heartbeat check
   */
  async forceHeartbeat(): Promise<boolean> {
    try {
      await this.sendPing();
      return true;
    } catch (error) {
      console.error('❌ Force heartbeat failed:', error);
      return false;
    }
  }

  /**
   * Get heartbeat status
   */
  getStatus() {
    return {
      isConnected: this.isConnected,
      isActive: this.isActive(),
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      reconnectDelay: this.reconnectDelay
    };
  }

  /**
   * Reset reconnection state (for testing/debugging)
   */
  resetReconnectionState(): void {
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
  }
}
