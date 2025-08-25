export interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryCondition?: (error: any) => boolean;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: any;
  attempts: number;
  totalTime: number;
}

export class RetryManager {
  private defaultOptions: RetryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true
  };

  /**
   * Retry an operation with exponential backoff
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    options: Partial<RetryOptions> = {}
  ): Promise<RetryResult<T>> {
    const config = { ...this.defaultOptions, ...options };
    const startTime = Date.now();
    let lastError: any;
    let attempt = 0;

    while (attempt <= config.maxRetries) {
      try {
        const result = await operation();
        
        return {
          success: true,
          data: result,
          attempts: attempt + 1,
          totalTime: Date.now() - startTime
        };
      } catch (error) {
        lastError = error;
        attempt++;

        // Check if we should retry
        if (attempt > config.maxRetries) {
          break;
        }

        // Check custom retry condition
        if (config.retryCondition && !config.retryCondition(error)) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.calculateDelay(attempt, config);
        
        console.log(`🔄 Retry attempt ${attempt}/${config.maxRetries} in ${delay}ms...`);
        
        // Wait before retrying
        await this.sleep(delay);
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: attempt,
      totalTime: Date.now() - startTime
    };
  }

  /**
   * Retry with custom retry logic
   */
  async retryWithCustomLogic<T>(
    operation: () => Promise<T>,
    retryLogic: (attempt: number, error: any) => Promise<boolean>
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    let attempt = 0;
    let lastError: any;

    while (true) {
      try {
        const result = await operation();
        
        return {
          success: true,
          data: result,
          attempts: attempt + 1,
          totalTime: Date.now() - startTime
        };
      } catch (error) {
        lastError = error;
        attempt++;

        // Use custom retry logic
        const shouldRetry = await retryLogic(attempt, error);
        
        if (!shouldRetry) {
          break;
        }
      }
    }

    return {
      success: false,
      error: lastError,
      attempts: attempt,
      totalTime: Date.now() - startTime
    };
  }

  /**
   * Retry with different strategies based on error type
   */
  async retryWithStrategy<T>(
    operation: () => Promise<T>,
    strategies: {
      authError?: () => Promise<boolean>;
      networkError?: () => Promise<boolean>;
      serverError?: () => Promise<boolean>;
      default?: () => Promise<boolean>;
    }
  ): Promise<RetryResult<T>> {
    return this.retryWithCustomLogic(operation, async (attempt, error) => {
      // Determine error type and use appropriate strategy
      if (this.isAuthError(error) && strategies.authError) {
        return await strategies.authError();
      }
      
      if (this.isNetworkError(error) && strategies.networkError) {
        return await strategies.networkError();
      }
      
      if (this.isServerError(error) && strategies.serverError) {
        return await strategies.serverError();
      }
      
      if (strategies.default) {
        return await strategies.default();
      }
      
      return false;
    });
  }

  /**
   * Calculate delay with exponential backoff
   */
  private calculateDelay(attempt: number, options: RetryOptions): number {
    let delay = options.baseDelay * Math.pow(options.backoffMultiplier, attempt - 1);
    
    // Add jitter to prevent thundering herd
    if (options.jitter) {
      const jitter = Math.random() * 0.1; // 10% jitter
      delay = delay * (1 + jitter);
    }
    
    // Cap at maximum delay
    return Math.min(delay, options.maxDelay);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if error is an authentication error
   */
  private isAuthError(error: any): boolean {
    return error?.status === 401 || 
           error?.status === 403 || 
           error?.error_code === 'E_UNAUTHORIZED' ||
           error?.message?.includes('authentication') ||
           error?.message?.includes('unauthorized');
  }

  /**
   * Check if error is a network error
   */
  private isNetworkError(error: any): boolean {
    return error?.name === 'TypeError' || 
           error?.message?.includes('fetch') ||
           error?.message?.includes('network') ||
           error?.code === 'NETWORK_ERROR';
  }

  /**
   * Check if error is a server error
   */
  private isServerError(error: any): boolean {
    return error?.status >= 500 && error?.status < 600;
  }

  /**
   * Create a retry manager with custom default options
   */
  static create(options: Partial<RetryOptions> = {}): RetryManager {
    const manager = new RetryManager();
    manager.defaultOptions = { ...manager.defaultOptions, ...options };
    return manager;
  }

  /**
   * Create a retry manager optimized for authentication operations
   */
  static createForAuth(): RetryManager {
    return RetryManager.create({
      maxRetries: 2,
      baseDelay: 500,
      maxDelay: 5000,
      backoffMultiplier: 1.5,
      jitter: true
    });
  }

  /**
   * Create a retry manager optimized for network operations
   */
  static createForNetwork(): RetryManager {
    return RetryManager.create({
      maxRetries: 5,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true
    });
  }

  /**
   * Create a retry manager optimized for server operations
   */
  static createForServer(): RetryManager {
    return RetryManager.create({
      maxRetries: 3,
      baseDelay: 2000,
      maxDelay: 20000,
      backoffMultiplier: 2,
      jitter: true
    });
  }
}
