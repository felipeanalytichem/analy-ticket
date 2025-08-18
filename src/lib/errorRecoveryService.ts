import { supabase } from "@/integrations/supabase/client";

// Error types for classification
export enum ErrorType {
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATABASE = 'database',
  VALIDATION = 'validation',
  UNKNOWN = 'unknown'
}

// Error recovery configuration
interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: ErrorType[];
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableErrors: [
    ErrorType.NETWORK,
    ErrorType.TIMEOUT,
    ErrorType.DATABASE,
    ErrorType.AUTHENTICATION
  ]
};

// Error recovery result
interface RecoveryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
  recoveryActions: string[];
}

// Detailed error information for logging
interface ErrorDetails {
  type: ErrorType;
  message: string;
  originalError: Error;
  timestamp: string;
  context: Record<string, any>;
  stackTrace?: string;
  userAgent: string;
  url: string;
  sessionId?: string;
}

/**
 * Comprehensive error recovery service for user management operations
 * Provides automatic retry with exponential backoff, authentication token refresh,
 * and detailed error logging for debugging purposes.
 */
export class ErrorRecoveryService {
  private static instance: ErrorRecoveryService;
  private retryConfig: RetryConfig;
  private errorLog: ErrorDetails[] = [];
  private sessionId: string;

  private constructor(config?: Partial<RetryConfig>) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    this.sessionId = this.generateSessionId();
    
    console.log('🔧 ErrorRecoveryService initialized', {
      sessionId: this.sessionId,
      config: this.retryConfig
    });
  }

  public static getInstance(config?: Partial<RetryConfig>): ErrorRecoveryService {
    if (!ErrorRecoveryService.instance) {
      ErrorRecoveryService.instance = new ErrorRecoveryService(config);
    }
    return ErrorRecoveryService.instance;
  }

  /**
   * Generate a unique session ID for tracking errors across operations
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Classify error type based on error message and properties
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Network-related errors
    if (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('connection') ||
      message.includes('offline') ||
      name.includes('networkerror')
    ) {
      return ErrorType.NETWORK;
    }

    // Timeout errors
    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      name.includes('timeouterror')
    ) {
      return ErrorType.TIMEOUT;
    }

    // Authentication errors
    if (
      message.includes('unauthorized') ||
      message.includes('invalid_token') ||
      message.includes('token') ||
      message.includes('authentication') ||
      message.includes('session') ||
      message.includes('jwt')
    ) {
      return ErrorType.AUTHENTICATION;
    }

    // Authorization errors
    if (
      message.includes('forbidden') ||
      message.includes('access denied') ||
      message.includes('permission') ||
      message.includes('not allowed')
    ) {
      return ErrorType.AUTHORIZATION;
    }

    // Database errors
    if (
      message.includes('database') ||
      message.includes('query') ||
      message.includes('sql') ||
      message.includes('relation') ||
      message.includes('column')
    ) {
      return ErrorType.DATABASE;
    }

    // Validation errors
    if (
      message.includes('validation') ||
      message.includes('invalid') ||
      message.includes('required') ||
      message.includes('format')
    ) {
      return ErrorType.VALIDATION;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Log detailed error information for debugging
   */
  private logError(error: Error, context: Record<string, any> = {}): void {
    const errorDetails: ErrorDetails = {
      type: this.classifyError(error),
      message: error.message,
      originalError: error,
      timestamp: new Date().toISOString(),
      context,
      stackTrace: error.stack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: this.sessionId
    };

    this.errorLog.push(errorDetails);

    // Log to console with structured format
    console.error('🚨 Error Recovery Service - Error Logged:', {
      type: errorDetails.type,
      message: errorDetails.message,
      timestamp: errorDetails.timestamp,
      context: errorDetails.context,
      sessionId: errorDetails.sessionId
    });

    // Keep only last 100 errors to prevent memory issues
    if (this.errorLog.length > 100) {
      this.errorLog = this.errorLog.slice(-100);
    }

    // Send to external logging service if configured
    this.sendToExternalLogging(errorDetails);
  }

  /**
   * Send error details to external logging service (placeholder)
   */
  private async sendToExternalLogging(errorDetails: ErrorDetails): Promise<void> {
    try {
      // This is a placeholder for external logging integration
      // You can integrate with services like Sentry, LogRocket, etc.
      
      // For now, we'll just log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log('📊 External Logging (Dev Mode):', {
          error: errorDetails.message,
          type: errorDetails.type,
          timestamp: errorDetails.timestamp,
          url: errorDetails.url
        });
      }
    } catch (loggingError) {
      console.warn('⚠️ Failed to send error to external logging:', loggingError);
    }
  }

  /**
   * Check if an error type is retryable based on configuration
   */
  private isRetryableError(errorType: ErrorType): boolean {
    return this.retryConfig.retryableErrors.includes(errorType);
  }

  /**
   * Calculate delay for next retry attempt using exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    const delay = this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  /**
   * Attempt to refresh authentication token transparently
   */
  private async refreshAuthToken(): Promise<boolean> {
    try {
      console.log('🔄 Attempting to refresh authentication token...');
      
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.error('❌ Token refresh failed:', error);
        return false;
      }

      if (data.session) {
        console.log('✅ Authentication token refreshed successfully');
        return true;
      }

      console.warn('⚠️ Token refresh returned no session');
      return false;
    } catch (error) {
      console.error('❌ Exception during token refresh:', error);
      return false;
    }
  }

  /**
   * Perform recovery actions based on error type
   */
  private async performRecoveryActions(errorType: ErrorType): Promise<string[]> {
    const actions: string[] = [];

    switch (errorType) {
      case ErrorType.AUTHENTICATION:
        console.log('🔧 Performing authentication recovery...');
        const tokenRefreshed = await this.refreshAuthToken();
        if (tokenRefreshed) {
          actions.push('token_refreshed');
        } else {
          actions.push('token_refresh_failed');
        }
        break;

      case ErrorType.NETWORK:
        console.log('🔧 Performing network recovery...');
        // Check if we're online
        if (!navigator.onLine) {
          actions.push('offline_detected');
        } else {
          actions.push('network_check_passed');
        }
        break;

      case ErrorType.DATABASE:
        console.log('🔧 Performing database recovery...');
        // Could add database connection checks here
        actions.push('database_recovery_attempted');
        break;

      default:
        actions.push('no_specific_recovery');
        break;
    }

    return actions;
  }

  /**
   * Execute operation with automatic retry and recovery
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: Record<string, any> = {},
    customConfig?: Partial<RetryConfig>
  ): Promise<RecoveryResult<T>> {
    const config = { ...this.retryConfig, ...customConfig };
    const startTime = Date.now();
    let lastError: Error | null = null;
    let allRecoveryActions: string[] = [];

    console.log('🚀 Starting operation with retry capability', {
      context,
      config,
      sessionId: this.sessionId
    });

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      try {
        console.log(`🔄 Attempt ${attempt}/${config.maxRetries + 1}`);
        
        const result = await operation();
        const totalTime = Date.now() - startTime;

        console.log('✅ Operation succeeded', {
          attempt,
          totalTime,
          recoveryActions: allRecoveryActions
        });

        return {
          success: true,
          data: result,
          attempts: attempt,
          totalTime,
          recoveryActions: allRecoveryActions
        };

      } catch (error) {
        const typedError = error instanceof Error ? error : new Error(String(error));
        lastError = typedError;
        
        // Log the error with context
        this.logError(typedError, {
          ...context,
          attempt,
          maxRetries: config.maxRetries
        });

        const errorType = this.classifyError(typedError);
        console.log(`❌ Attempt ${attempt} failed with ${errorType} error:`, typedError.message);

        // If this is the last attempt or error is not retryable, don't retry
        if (attempt > config.maxRetries || !this.isRetryableError(errorType)) {
          console.log('🛑 Not retrying:', {
            isLastAttempt: attempt > config.maxRetries,
            isRetryable: this.isRetryableError(errorType),
            errorType
          });
          break;
        }

        // Perform recovery actions
        const recoveryActions = await this.performRecoveryActions(errorType);
        allRecoveryActions.push(...recoveryActions);

        // Calculate and wait for retry delay
        const delay = this.calculateRetryDelay(attempt);
        console.log(`⏳ Waiting ${delay}ms before retry ${attempt + 1}...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    const totalTime = Date.now() - startTime;
    
    console.log('❌ All retry attempts failed', {
      attempts: config.maxRetries + 1,
      totalTime,
      finalError: lastError?.message,
      recoveryActions: allRecoveryActions
    });

    return {
      success: false,
      error: lastError || new Error('Unknown error occurred'),
      attempts: config.maxRetries + 1,
      totalTime,
      recoveryActions: allRecoveryActions
    };
  }

  /**
   * Get error log for debugging purposes
   */
  public getErrorLog(): ErrorDetails[] {
    return [...this.errorLog];
  }

  /**
   * Clear error log
   */
  public clearErrorLog(): void {
    this.errorLog = [];
    console.log('🧹 Error log cleared');
  }

  /**
   * Get error statistics
   */
  public getErrorStats(): Record<string, any> {
    const stats = {
      totalErrors: this.errorLog.length,
      errorsByType: {} as Record<ErrorType, number>,
      recentErrors: this.errorLog.slice(-10),
      sessionId: this.sessionId
    };

    // Count errors by type
    this.errorLog.forEach(error => {
      stats.errorsByType[error.type] = (stats.errorsByType[error.type] || 0) + 1;
    });

    return stats;
  }

  /**
   * Test network connectivity
   */
  public async testConnectivity(): Promise<boolean> {
    try {
      console.log('🌐 Testing network connectivity...');
      
      // Try to fetch a small resource from Supabase
      const response = await fetch(supabase.supabaseUrl + '/rest/v1/', {
        method: 'HEAD',
        headers: {
          'apikey': supabase.supabaseKey
        }
      });

      const isConnected = response.ok;
      console.log(isConnected ? '✅ Connectivity test passed' : '❌ Connectivity test failed');
      
      return isConnected;
    } catch (error) {
      console.log('❌ Connectivity test failed with exception:', error);
      return false;
    }
  }
}

// Export singleton instance
export const errorRecoveryService = ErrorRecoveryService.getInstance();

// Export types for use in other components
export type { RecoveryResult, ErrorDetails };