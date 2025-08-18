import { supabase } from '@/lib/supabase';

export interface QueuedAction {
  id: string;
  type: string;
  payload: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  originalRequest?: () => Promise<any>;
}

export interface ErrorContext {
  action: QueuedAction;
  cacheKey?: string;
  fallbackData?: any;
  userMessage?: string;
}

export type ErrorType = 
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR' 
  | 'TIMEOUT_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'SERVER_ERROR'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';

export interface ErrorRecoveryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  enableCache?: boolean;
  enableQueue?: boolean;
  userNotification?: boolean;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<ErrorType, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
}

export class ErrorRecoveryManager {
  private retryQueues: Map<string, QueuedAction[]> = new Map();
  private errorMetrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByType: {} as Record<ErrorType, number>,
    recoverySuccessRate: 0,
    averageRecoveryTime: 0
  };
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private eventListeners: Map<string, ((error: any, context: ErrorContext) => void)[]> = new Map();
  private isProcessingQueue = false;
  private queueProcessInterval: NodeJS.Timeout | null = null;
  
  private readonly DEFAULT_OPTIONS: ErrorRecoveryOptions = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    enableCache: true,
    enableQueue: true,
    userNotification: true
  };

  constructor(private options: ErrorRecoveryOptions = {}) {
    this.options = { ...this.DEFAULT_OPTIONS, ...options };
    this.startQueueProcessor();
    
    // Only setup global error handling in production
    if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
      this.setupGlobalErrorHandling();
    }
  }

  /**
   * Main error handling entry point
   */
  async handleError(error: any, context: ErrorContext): Promise<any> {
    const startTime = Date.now();
    const errorType = this.categorizeError(error);
    
    // Update metrics
    this.updateErrorMetrics(errorType);
    
    // Log error for monitoring
    this.logError(error, context, errorType);
    
    try {
      let result;
      
      switch (errorType) {
        case 'NETWORK_ERROR':
          result = await this.handleNetworkError(error, context);
          break;
        case 'AUTH_ERROR':
          result = await this.handleAuthError(error, context);
          break;
        case 'TIMEOUT_ERROR':
          result = await this.handleTimeoutError(error, context);
          break;
        case 'RATE_LIMIT_ERROR':
          result = await this.handleRateLimitError(error, context);
          break;
        case 'SERVER_ERROR':
          result = await this.handleServerError(error, context);
          break;
        case 'VALIDATION_ERROR':
          result = await this.handleValidationError(error, context);
          break;
        default:
          result = await this.handleGenericError(error, context);
      }
      
      // Update success metrics
      const recoveryTime = Date.now() - startTime;
      this.updateRecoveryMetrics(true, recoveryTime);
      
      return result;
      
    } catch (recoveryError) {
      this.updateRecoveryMetrics(false, Date.now() - startTime);
      
      // Emit error event for listeners
      this.emitErrorEvent('recovery_failed', recoveryError, context);
      
      throw recoveryError;
    }
  }

  /**
   * Handle network-related errors
   */
  private async handleNetworkError(error: any, context: ErrorContext): Promise<any> {
    // Check if we're offline
    if (!navigator.onLine) {
      return this.handleOfflineError(error, context);
    }
    
    // Try to serve from cache first
    if (this.options.enableCache && context.cacheKey) {
      const cachedData = this.getCachedData(context.cacheKey);
      if (cachedData) {
        this.showUserMessage('Using cached data due to network issues', 'warning');
        return cachedData;
      }
    }
    
    // Queue for retry if enabled
    if (this.options.enableQueue && context.action.retryCount < (this.options.maxRetries || 3)) {
      this.queueAction(context.action);
      this.showUserMessage('Request queued for retry when connection is restored', 'info');
      return null;
    }
    
    // Show user-friendly error message
    if (this.options.userNotification) {
      this.showUserMessage(
        context.userMessage || 'Network connection issue. Please check your internet connection.',
        'error'
      );
    }
    
    throw error;
  }

  /**
   * Handle authentication errors
   */
  private async handleAuthError(error: any, context: ErrorContext): Promise<any> {
    // Check if it's a token expiration error
    if (this.isTokenExpiredError(error)) {
      try {
        // Attempt token refresh
        const { data, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !data.session) {
          // Refresh failed, redirect to login
          this.redirectToLogin('Your session has expired. Please log in again.');
          throw new Error('Session expired and refresh failed');
        }
        
        // Retry the original request with new token
        if (context.action.originalRequest) {
          return await context.action.originalRequest();
        }
        
        return null;
        
      } catch (refreshError) {
        this.redirectToLogin('Authentication failed. Please log in again.');
        throw refreshError;
      }
    }
    
    // Handle other auth errors
    if (this.isPermissionError(error)) {
      this.showUserMessage('You do not have permission to perform this action.', 'error');
      throw error;
    }
    
    // Generic auth error
    this.showUserMessage('Authentication error occurred. Please try logging in again.', 'error');
    throw error;
  }

  /**
   * Handle timeout errors
   */
  private async handleTimeoutError(error: any, context: ErrorContext): Promise<any> {
    // Try cached data first
    if (this.options.enableCache && context.cacheKey) {
      const cachedData = this.getCachedData(context.cacheKey);
      if (cachedData) {
        this.showUserMessage('Request timed out, showing cached data', 'warning');
        return cachedData;
      }
    }
    
    // Queue for retry with exponential backoff
    if (this.options.enableQueue && context.action.retryCount < (this.options.maxRetries || 3)) {
      context.action.retryCount++;
      const delay = this.calculateBackoffDelay(context.action.retryCount);
      
      setTimeout(() => {
        this.queueAction(context.action);
      }, delay);
      
      this.showUserMessage('Request timed out, retrying...', 'warning');
      return null;
    }
    
    this.showUserMessage('Request timed out. Please try again.', 'error');
    throw error;
  }

  /**
   * Handle rate limiting errors
   */
  private async handleRateLimitError(error: any, context: ErrorContext): Promise<any> {
    const retryAfter = this.extractRetryAfter(error) || 60; // Default to 60 seconds
    
    if (context.action.retryCount < (this.options.maxRetries || 3)) {
      context.action.retryCount++;
      
      setTimeout(() => {
        this.queueAction(context.action);
      }, retryAfter * 1000);
      
      this.showUserMessage(
        `Rate limit exceeded. Retrying in ${retryAfter} seconds...`,
        'warning'
      );
      
      return null;
    }
    
    this.showUserMessage('Too many requests. Please try again later.', 'error');
    throw error;
  }

  /**
   * Handle server errors (5xx)
   */
  private async handleServerError(error: any, context: ErrorContext): Promise<any> {
    // Try cached data for read operations
    if (this.options.enableCache && context.cacheKey && this.isReadOperation(context.action)) {
      const cachedData = this.getCachedData(context.cacheKey);
      if (cachedData) {
        this.showUserMessage('Server error occurred, showing cached data', 'warning');
        return cachedData;
      }
    }
    
    // Queue for retry with exponential backoff
    if (this.options.enableQueue && context.action.retryCount < (this.options.maxRetries || 3)) {
      context.action.retryCount++;
      const delay = this.calculateBackoffDelay(context.action.retryCount);
      
      setTimeout(() => {
        this.queueAction(context.action);
      }, delay);
      
      this.showUserMessage('Server error occurred, retrying...', 'warning');
      return null;
    }
    
    this.showUserMessage('Server error occurred. Please try again later.', 'error');
    throw error;
  }

  /**
   * Handle validation errors
   */
  private async handleValidationError(error: any, context: ErrorContext): Promise<any> {
    const validationMessage = this.extractValidationMessage(error);
    this.showUserMessage(validationMessage || 'Invalid data provided.', 'error');
    throw error;
  }

  /**
   * Handle generic errors
   */
  private async handleGenericError(error: any, context: ErrorContext): Promise<any> {
    // Try cached data as fallback
    if (this.options.enableCache && context.cacheKey) {
      const cachedData = this.getCachedData(context.cacheKey);
      if (cachedData) {
        this.showUserMessage('An error occurred, showing cached data', 'warning');
        return cachedData;
      }
    }
    
    // Use fallback data if provided
    if (context.fallbackData) {
      this.showUserMessage('An error occurred, showing default data', 'warning');
      return context.fallbackData;
    }
    
    this.showUserMessage('An unexpected error occurred. Please try again.', 'error');
    throw error;
  }

  /**
   * Handle offline scenarios
   */
  private async handleOfflineError(error: any, context: ErrorContext): Promise<any> {
    // Try cached data first
    if (this.options.enableCache && context.cacheKey) {
      const cachedData = this.getCachedData(context.cacheKey);
      if (cachedData) {
        this.showUserMessage('You are offline. Showing cached data.', 'warning');
        return cachedData;
      }
    }
    
    // Queue write operations for when online
    if (this.options.enableQueue && !this.isReadOperation(context.action)) {
      this.queueAction(context.action);
      this.showUserMessage('You are offline. Changes will be saved when connection is restored.', 'info');
      return null;
    }
    
    this.showUserMessage('You are offline and no cached data is available.', 'error');
    throw error;
  }

  /**
   * Queue an action for retry
   */
  private queueAction(action: QueuedAction): void {
    const queue = this.retryQueues.get(action.type) || [];
    
    // Avoid duplicate actions
    const existingIndex = queue.findIndex(a => a.id === action.id);
    if (existingIndex >= 0) {
      queue[existingIndex] = action;
    } else {
      queue.push({
        ...action,
        timestamp: new Date()
      });
    }
    
    this.retryQueues.set(action.type, queue);
  }

  /**
   * Process retry queue
   */
  async processRetryQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    
    this.isProcessingQueue = true;
    
    try {
      for (const [type, queue] of this.retryQueues.entries()) {
        const actionsToRetry = queue.filter(action => 
          action.retryCount < (this.options.maxRetries || 3)
        );
        
        for (const action of actionsToRetry) {
          try {
            if (action.originalRequest) {
              await action.originalRequest();
              this.removeFromQueue(type, action.id);
            }
          } catch (error) {
            action.retryCount++;
            if (action.retryCount >= (this.options.maxRetries || 3)) {
              this.removeFromQueue(type, action.id);
              this.handleFailedAction(action, error);
            }
          }
        }
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Cache data for fallback use
   */
  setCachedData(key: string, data: any, ttl: number = 300000): void { // 5 minutes default TTL
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Get cached data if still valid
   */
  private getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  /**
   * Clear expired cache entries
   */
  private clearExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.timestamp > cached.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Error categorization
   */
  private categorizeError(error: any): ErrorType {
    if (!error) return 'UNKNOWN_ERROR';
    
    // Network errors
    if (error.name === 'NetworkError' || error.code === 'NETWORK_ERROR' || !navigator.onLine) {
      return 'NETWORK_ERROR';
    }
    
    // Auth errors
    if (error.status === 401 || error.code === 'UNAUTHORIZED' || error.message?.includes('auth')) {
      return 'AUTH_ERROR';
    }
    
    // Timeout errors
    if (error.name === 'TimeoutError' || error.code === 'TIMEOUT' || error.message?.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    }
    
    // Rate limiting
    if (error.status === 429 || error.code === 'RATE_LIMIT_EXCEEDED') {
      return 'RATE_LIMIT_ERROR';
    }
    
    // Server errors
    if (error.status >= 500 || error.code === 'INTERNAL_SERVER_ERROR') {
      return 'SERVER_ERROR';
    }
    
    // Validation errors
    if (error.status === 400 || error.code === 'VALIDATION_ERROR' || error.message?.includes('validation')) {
      return 'VALIDATION_ERROR';
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(retryCount: number): number {
    const baseDelay = this.options.baseDelay || 1000;
    const maxDelay = this.options.maxDelay || 30000;
    const delay = Math.min(baseDelay * Math.pow(2, retryCount - 1), maxDelay);
    
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }

  /**
   * Utility methods
   */
  private isTokenExpiredError(error: any): boolean {
    return error.message?.includes('JWT expired') || 
           error.message?.includes('token expired') ||
           error.code === 'TOKEN_EXPIRED';
  }

  private isPermissionError(error: any): boolean {
    return error.status === 403 || error.code === 'FORBIDDEN';
  }

  private isReadOperation(action: QueuedAction): boolean {
    return action.type.includes('GET') || action.type.includes('READ') || action.type.includes('fetch');
  }

  private extractRetryAfter(error: any): number | null {
    return error.headers?.['retry-after'] || error.retryAfter || null;
  }

  private extractValidationMessage(error: any): string | null {
    return error.details || error.message || null;
  }

  private removeFromQueue(type: string, actionId: string): void {
    const queue = this.retryQueues.get(type) || [];
    const filteredQueue = queue.filter(action => action.id !== actionId);
    this.retryQueues.set(type, filteredQueue);
  }

  private handleFailedAction(action: QueuedAction, error: any): void {
    this.logError(error, { action }, 'RETRY_FAILED');
    this.showUserMessage(
      `Failed to complete action "${action.type}" after ${action.retryCount} attempts.`,
      'error'
    );
  }

  private redirectToLogin(message?: string): void {
    if (message) {
      this.showUserMessage(message, 'warning');
    }
    
    // Clear any stored session data
    localStorage.removeItem('supabase.auth.token');
    
    // Redirect to login page
    window.location.href = '/login';
  }

  private showUserMessage(message: string, type: 'info' | 'warning' | 'error'): void {
    if (!this.options.userNotification) return;
    
    // This would integrate with your toast/notification system
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // Emit event for UI components to handle
    this.emitErrorEvent('user_message', { message, type }, {} as ErrorContext);
  }

  private logError(error: any, context: ErrorContext, errorType?: ErrorType | string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code,
        status: error.status
      },
      context: {
        actionType: context.action?.type,
        actionId: context.action?.id,
        retryCount: context.action?.retryCount
      },
      errorType: errorType || this.categorizeError(error)
    };
    
    console.error('[ErrorRecoveryManager]', logEntry);
    
    // Here you could send to external logging service
    // await this.sendToLoggingService(logEntry);
  }

  private updateErrorMetrics(errorType: ErrorType): void {
    this.errorMetrics.totalErrors++;
    this.errorMetrics.errorsByType[errorType] = (this.errorMetrics.errorsByType[errorType] || 0) + 1;
  }

  private updateRecoveryMetrics(success: boolean, recoveryTime: number): void {
    // Simple moving average for recovery time
    this.errorMetrics.averageRecoveryTime = 
      (this.errorMetrics.averageRecoveryTime + recoveryTime) / 2;
    
    // Update success rate (simplified)
    const totalAttempts = this.errorMetrics.totalErrors;
    const currentSuccesses = Math.floor(this.errorMetrics.recoverySuccessRate * totalAttempts);
    const newSuccesses = success ? currentSuccesses + 1 : currentSuccesses;
    this.errorMetrics.recoverySuccessRate = newSuccesses / totalAttempts;
  }

  private startQueueProcessor(): void {
    this.queueProcessInterval = setInterval(() => {
      this.processRetryQueue();
      this.clearExpiredCache();
    }, 30000); // Process every 30 seconds
  }

  private setupGlobalErrorHandling(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason;
      const context: ErrorContext = {
        action: {
          id: `unhandled-${Date.now()}`,
          type: 'UNHANDLED_PROMISE_REJECTION',
          payload: null,
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 0
        }
      };
      
      this.handleError(error, context).catch(() => {
        // Prevent infinite loops
      });
    });
  }

  /**
   * Event system for error notifications
   */
  addEventListener(event: string, callback: (error: any, context: ErrorContext) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(callback);
  }

  removeEventListener(event: string, callback: (error: any, context: ErrorContext) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  private emitErrorEvent(event: string, error: any, context: ErrorContext): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(error, context);
        } catch (err) {
          console.error('Error in event listener:', err);
        }
      });
    }
  }

  /**
   * Get current error metrics
   */
  getMetrics(): ErrorMetrics {
    return { ...this.errorMetrics };
  }

  /**
   * Clear all queues and reset state
   */
  reset(): void {
    this.retryQueues.clear();
    this.cache.clear();
    this.errorMetrics = {
      totalErrors: 0,
      errorsByType: {} as Record<ErrorType, number>,
      recoverySuccessRate: 0,
      averageRecoveryTime: 0
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.queueProcessInterval) {
      clearInterval(this.queueProcessInterval);
      this.queueProcessInterval = null;
    }
    
    this.eventListeners.clear();
    this.reset();
  }
}

// Export singleton instance
export const errorRecoveryManager = new ErrorRecoveryManager();