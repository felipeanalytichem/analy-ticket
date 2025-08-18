import { supabase } from '@/lib/supabase';

export enum NotificationErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  SUBSCRIPTION_ERROR = 'SUBSCRIPTION_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface NotificationError {
  type: NotificationErrorType;
  message: string;
  code?: string;
  details?: any;
  timestamp: Date;
  operationId: string;
  userId?: string;
  retryable: boolean;
}

export interface ErrorContext {
  operationId: string;
  operation: string;
  userId?: string;
  notificationId?: string;
  metadata?: Record<string, any>;
}

export interface RetryItem {
  operationId: string;
  operation: () => Promise<any>;
  context: ErrorContext;
  attempts: number;
  lastAttempt: Date;
  nextRetry: Date;
  maxRetries: number;
}

export interface ErrorHandlerConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  enableLogging: boolean;
  enableMonitoring: boolean;
  retryableErrors: NotificationErrorType[];
}

export class NotificationErrorHandler {
  private static instance: NotificationErrorHandler;
  private retryQueue: Map<string, RetryItem> = new Map();
  private errorLog: NotificationError[] = [];
  private config: ErrorHandlerConfig;
  private retryTimer: NodeJS.Timeout | null = null;

  private constructor(config?: Partial<ErrorHandlerConfig>) {
    this.config = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      enableLogging: true,
      enableMonitoring: true,
      retryableErrors: [
        NotificationErrorType.NETWORK_ERROR,
        NotificationErrorType.DATABASE_ERROR,
        NotificationErrorType.SUBSCRIPTION_ERROR,
        NotificationErrorType.CACHE_ERROR
      ],
      ...config
    };

    this.startRetryProcessor();
  }

  static getInstance(config?: Partial<ErrorHandlerConfig>): NotificationErrorHandler {
    if (!NotificationErrorHandler.instance) {
      NotificationErrorHandler.instance = new NotificationErrorHandler(config);
    }
    return NotificationErrorHandler.instance;
  }

  /**
   * Main error handling entry point
   */
  async handleError(error: any, context: ErrorContext): Promise<void> {
    const notificationError = this.categorizeError(error, context);
    
    if (this.config.enableLogging) {
      this.logError(notificationError);
    }

    if (this.config.enableMonitoring) {
      await this.reportToMonitoring(notificationError);
    }

    if (notificationError.retryable && this.shouldRetry(context.operationId)) {
      await this.queueForRetry(notificationError, context);
    } else {
      await this.handleFinalFailure(notificationError, context);
    }
  }

  /**
   * Categorize errors into specific types
   */
  private categorizeError(error: any, context: ErrorContext): NotificationError {
    const baseError: Omit<NotificationError, 'type' | 'retryable'> = {
      message: error.message || 'Unknown error occurred',
      code: error.code,
      details: error.details || error,
      timestamp: new Date(),
      operationId: context.operationId,
      userId: context.userId
    };

    // Check each error type in order of specificity
    
    // Permission/Authentication errors (check first as they're most specific)
    if (this.isPermissionError(error)) {
      return {
        ...baseError,
        type: NotificationErrorType.PERMISSION_ERROR,
        retryable: false
      };
    }

    // Validation errors
    if (this.isValidationError(error)) {
      return {
        ...baseError,
        type: NotificationErrorType.VALIDATION_ERROR,
        retryable: false
      };
    }

    // Rate limiting errors
    if (this.isRateLimitError(error)) {
      return {
        ...baseError,
        type: NotificationErrorType.RATE_LIMIT_ERROR,
        retryable: true
      };
    }

    // Database errors (check before network as some DB errors might include 'connection')
    if (this.isDatabaseError(error)) {
      return {
        ...baseError,
        type: NotificationErrorType.DATABASE_ERROR,
        retryable: true
      };
    }

    // Subscription errors
    if (this.isSubscriptionError(error)) {
      return {
        ...baseError,
        type: NotificationErrorType.SUBSCRIPTION_ERROR,
        retryable: true
      };
    }

    // Cache errors
    if (this.isCacheError(error)) {
      return {
        ...baseError,
        type: NotificationErrorType.CACHE_ERROR,
        retryable: true
      };
    }

    // Network-related errors (check last as they're most general)
    if (this.isNetworkError(error)) {
      return {
        ...baseError,
        type: NotificationErrorType.NETWORK_ERROR,
        retryable: true
      };
    }

    // Default to unknown error
    return {
      ...baseError,
      type: NotificationErrorType.UNKNOWN_ERROR,
      retryable: false
    };
  }

  /**
   * Error type detection methods
   */
  private isNetworkError(error: any): boolean {
    return (
      error.name === 'NetworkError' ||
      error.code === 'NETWORK_ERROR' ||
      error.message?.includes('fetch') ||
      error.message?.includes('network') ||
      error.message?.includes('connection') ||
      !navigator.onLine
    );
  }

  private isPermissionError(error: any): boolean {
    return (
      error.code === 'PGRST301' || // RLS policy violation
      error.code === 'PGRST302' || // JWT expired
      error.code === '42501' ||    // Insufficient privilege
      error.message?.includes('permission') ||
      error.message?.includes('unauthorized') ||
      error.message?.includes('forbidden')
    );
  }

  private isValidationError(error: any): boolean {
    return (
      error.code === '23505' ||    // Unique violation
      error.code === '23502' ||    // Not null violation
      error.code === '23514' ||    // Check violation
      error.message?.includes('validation') ||
      error.message?.includes('invalid') ||
      error.message?.includes('constraint')
    );
  }

  private isDatabaseError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    const code = error.code || '';
    
    return (
      code.startsWith('08') ||  // Connection errors
      code.startsWith('53') ||  // Insufficient resources
      code.startsWith('57') ||  // Operator intervention
      message.includes('database') ||
      message.includes('connection timeout') ||
      message.includes('postgres') ||
      message.includes('supabase')
    );
  }

  private isRateLimitError(error: any): boolean {
    return (
      error.code === '429' ||
      error.status === 429 ||
      error.message?.includes('rate limit') ||
      error.message?.includes('too many requests')
    );
  }

  private isSubscriptionError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    const code = error.code || '';
    
    return (
      message.includes('subscription') ||
      message.includes('realtime') ||
      message.includes('websocket') ||
      message.includes('socket') ||
      code === 'SUBSCRIPTION_ERROR'
    );
  }

  private isCacheError(error: any): boolean {
    return (
      error.message?.includes('cache') ||
      error.code === 'CACHE_ERROR' ||
      error.name === 'CacheError'
    );
  }

  /**
   * Retry logic
   */
  private shouldRetry(operationId: string): boolean {
    const existingRetry = this.retryQueue.get(operationId);
    return !existingRetry || existingRetry.attempts < this.config.maxRetries;
  }

  private async queueForRetry(error: NotificationError, context: ErrorContext): Promise<void> {
    const existingRetry = this.retryQueue.get(context.operationId);
    const attempts = existingRetry ? existingRetry.attempts + 1 : 1;
    
    const delay = this.calculateRetryDelay(attempts, error.type);
    const nextRetry = new Date(Date.now() + delay);

    const retryItem: RetryItem = {
      operationId: context.operationId,
      operation: () => this.recreateOperation(context),
      context,
      attempts,
      lastAttempt: new Date(),
      nextRetry,
      maxRetries: this.config.maxRetries
    };

    this.retryQueue.set(context.operationId, retryItem);
    
    console.warn(`Queuing retry ${attempts}/${this.config.maxRetries} for operation ${context.operationId} in ${delay}ms`);
  }

  private calculateRetryDelay(attempt: number, errorType: NotificationErrorType): number {
    let baseDelay = this.config.baseDelay;
    
    // Adjust base delay based on error type
    switch (errorType) {
      case NotificationErrorType.RATE_LIMIT_ERROR:
        baseDelay = 5000; // Longer delay for rate limits
        break;
      case NotificationErrorType.NETWORK_ERROR:
        baseDelay = 2000; // Medium delay for network issues
        break;
      default:
        baseDelay = this.config.baseDelay;
    }

    // Exponential backoff with jitter
    const exponentialDelay = baseDelay * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    const totalDelay = exponentialDelay + jitter;

    return Math.min(totalDelay, this.config.maxDelay);
  }

  private async recreateOperation(context: ErrorContext): Promise<any> {
    // This would need to be implemented based on the specific operation
    // For now, we'll throw an error to indicate it needs implementation
    throw new Error(`Operation recreation not implemented for: ${context.operation}`);
  }

  /**
   * Retry processor
   */
  private startRetryProcessor(): void {
    this.retryTimer = setInterval(() => {
      this.processRetryQueue();
    }, 1000);
  }

  private async processRetryQueue(): Promise<void> {
    const now = new Date();
    const readyForRetry = Array.from(this.retryQueue.values())
      .filter(item => item.nextRetry <= now);

    for (const item of readyForRetry) {
      try {
        await item.operation();
        this.retryQueue.delete(item.operationId);
        console.log(`✅ Retry successful for operation ${item.operationId}`);
      } catch (error) {
        if (item.attempts >= item.maxRetries) {
          this.retryQueue.delete(item.operationId);
          await this.handleFinalFailure(
            this.categorizeError(error, item.context),
            item.context
          );
        } else {
          await this.handleError(error, item.context);
        }
      }
    }
  }

  /**
   * Logging and monitoring
   */
  private logError(error: NotificationError): void {
    this.errorLog.push(error);
    
    // Keep only last 1000 errors to prevent memory issues
    if (this.errorLog.length > 1000) {
      this.errorLog = this.errorLog.slice(-1000);
    }

    console.error('NotificationError:', {
      type: error.type,
      message: error.message,
      operationId: error.operationId,
      userId: error.userId,
      timestamp: error.timestamp,
      retryable: error.retryable
    });
  }

  private async reportToMonitoring(error: NotificationError): Promise<void> {
    try {
      // Store error in database for monitoring
      await supabase
        .from('notification_analytics')
        .insert({
          user_id: error.userId,
          event_type: 'error',
          metadata: {
            errorType: error.type,
            errorMessage: error.message,
            errorCode: error.code,
            operationId: error.operationId,
            retryable: error.retryable,
            timestamp: error.timestamp.toISOString()
          }
        });
    } catch (monitoringError) {
      console.error('Failed to report error to monitoring:', monitoringError);
    }
  }

  private async handleFinalFailure(error: NotificationError, context: ErrorContext): Promise<void> {
    console.error(`❌ Final failure for operation ${context.operationId}:`, error);
    
    // Emit event for UI to handle
    window.dispatchEvent(new CustomEvent('notificationError', {
      detail: { error, context }
    }));

    // Store final failure for analytics
    if (this.config.enableMonitoring) {
      try {
        await supabase
          .from('notification_analytics')
          .insert({
            user_id: error.userId,
            event_type: 'final_failure',
            metadata: {
              errorType: error.type,
              errorMessage: error.message,
              operationId: error.operationId,
              context: context,
              timestamp: new Date().toISOString()
            }
          });
      } catch (monitoringError) {
        console.error('Failed to log final failure:', monitoringError);
      }
    }
  }

  /**
   * Public methods for external use
   */
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<NotificationErrorType, number>;
    activeRetries: number;
    recentErrors: NotificationError[];
  } {
    const errorsByType = this.errorLog.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<NotificationErrorType, number>);

    const recentErrors = this.errorLog
      .filter(error => Date.now() - error.timestamp.getTime() < 3600000) // Last hour
      .slice(-10);

    return {
      totalErrors: this.errorLog.length,
      errorsByType,
      activeRetries: this.retryQueue.size,
      recentErrors
    };
  }

  clearRetryQueue(): void {
    this.retryQueue.clear();
  }

  clearErrorLog(): void {
    this.errorLog = [];
  }

  updateConfig(newConfig: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Cleanup method
   */
  destroy(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
    this.retryQueue.clear();
    this.errorLog = [];
  }
}

// Export singleton instance
export const notificationErrorHandler = NotificationErrorHandler.getInstance();