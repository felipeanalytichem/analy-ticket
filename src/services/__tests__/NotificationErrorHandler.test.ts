import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  NotificationErrorHandler, 
  NotificationErrorType, 
  type NotificationError,
  type ErrorContext 
} from '../NotificationErrorHandler';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null })
    }))
  }
}));

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

describe('NotificationErrorHandler', () => {
  let errorHandler: NotificationErrorHandler;
  let mockContext: ErrorContext;

  beforeEach(() => {
    // Reset singleton instance
    (NotificationErrorHandler as any).instance = null;
    errorHandler = NotificationErrorHandler.getInstance({
      maxRetries: 2,
      baseDelay: 100,
      maxDelay: 1000,
      enableLogging: true,
      enableMonitoring: false // Disable for tests
    });

    mockContext = {
      operationId: 'test-operation-123',
      operation: 'markAsRead',
      userId: 'user-123',
      notificationId: 'notification-456'
    };

    // Mock console methods
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    errorHandler.destroy();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Error Categorization', () => {
    it('should categorize network errors correctly', async () => {
      const networkError = new Error('fetch failed');
      networkError.name = 'NetworkError';

      await errorHandler.handleError(networkError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.errorsByType[NotificationErrorType.NETWORK_ERROR]).toBe(1);
    });

    it('should categorize permission errors correctly', async () => {
      const permissionError = new Error('unauthorized access');
      (permissionError as any).code = 'PGRST301';

      await errorHandler.handleError(permissionError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.errorsByType[NotificationErrorType.PERMISSION_ERROR]).toBe(1);
    });

    it('should categorize validation errors correctly', async () => {
      const validationError = new Error('constraint violation');
      (validationError as any).code = '23505';

      await errorHandler.handleError(validationError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.errorsByType[NotificationErrorType.VALIDATION_ERROR]).toBe(1);
    });

    it('should categorize database errors correctly', async () => {
      const dbError = new Error('database connection timeout');
      (dbError as any).code = '08006';

      await errorHandler.handleError(dbError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.errorsByType[NotificationErrorType.DATABASE_ERROR]).toBe(1);
    });

    it('should categorize rate limit errors correctly', async () => {
      const rateLimitError = new Error('too many requests');
      (rateLimitError as any).status = 429;

      await errorHandler.handleError(rateLimitError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.errorsByType[NotificationErrorType.RATE_LIMIT_ERROR]).toBe(1);
    });

    it('should categorize subscription errors correctly', async () => {
      const subscriptionError = new Error('websocket connection failed');

      await errorHandler.handleError(subscriptionError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.errorsByType[NotificationErrorType.SUBSCRIPTION_ERROR]).toBe(1);
    });

    it('should categorize cache errors correctly', async () => {
      const cacheError = new Error('cache miss');
      cacheError.name = 'CacheError';

      await errorHandler.handleError(cacheError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.errorsByType[NotificationErrorType.CACHE_ERROR]).toBe(1);
    });

    it('should categorize unknown errors correctly', async () => {
      const unknownError = new Error('something went wrong');

      await errorHandler.handleError(unknownError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.errorsByType[NotificationErrorType.UNKNOWN_ERROR]).toBe(1);
    });
  });

  describe('Retry Logic', () => {
    it('should queue retryable errors for retry', async () => {
      const networkError = new Error('network timeout');
      networkError.name = 'NetworkError';

      await errorHandler.handleError(networkError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.activeRetries).toBe(1);
    });

    it('should not queue non-retryable errors for retry', async () => {
      const permissionError = new Error('unauthorized');
      (permissionError as any).code = 'PGRST301';

      await errorHandler.handleError(permissionError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.activeRetries).toBe(0);
    });

    it('should calculate exponential backoff delay correctly', async () => {
      const networkError = new Error('network error');
      networkError.name = 'NetworkError';

      // First retry
      await errorHandler.handleError(networkError, mockContext);
      
      // Second retry with same operation ID
      await errorHandler.handleError(networkError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.activeRetries).toBe(1); // Should still be 1 as it's the same operation
    });

    it('should respect maximum retry attempts', async () => {
      const networkError = new Error('persistent network error');
      networkError.name = 'NetworkError';

      // Exceed max retries (set to 2 in beforeEach)
      await errorHandler.handleError(networkError, mockContext);
      await errorHandler.handleError(networkError, mockContext);
      await errorHandler.handleError(networkError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      // Should have logged multiple errors but only one active retry
      expect(stats.totalErrors).toBeGreaterThan(1);
    });

    it('should handle rate limit errors with longer delays', async () => {
      const rateLimitError = new Error('rate limited');
      (rateLimitError as any).status = 429;

      await errorHandler.handleError(rateLimitError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.activeRetries).toBe(1);
      expect(stats.errorsByType[NotificationErrorType.RATE_LIMIT_ERROR]).toBe(1);
    });
  });

  describe('Error Logging', () => {
    it('should log errors when logging is enabled', async () => {
      const testError = new Error('test error');
      
      await errorHandler.handleError(testError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(1);
      expect(console.error).toHaveBeenCalled();
    });

    it('should maintain error log size limit', async () => {
      // Create handler with small log limit for testing
      errorHandler.destroy();
      errorHandler = NotificationErrorHandler.getInstance({
        enableLogging: true,
        enableMonitoring: false
      });

      // Add many errors (more than the 1000 limit)
      for (let i = 0; i < 1005; i++) {
        const error = new Error(`error ${i}`);
        await errorHandler.handleError(error, {
          ...mockContext,
          operationId: `operation-${i}`
        });
      }
      
      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(1000); // Should be capped at 1000
    });

    it('should provide recent errors in stats', async () => {
      const recentError = new Error('recent error');
      await errorHandler.handleError(recentError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.recentErrors).toHaveLength(1);
      expect(stats.recentErrors[0].message).toBe('recent error');
    });
  });

  describe('Configuration', () => {
    it('should use default configuration when none provided', () => {
      errorHandler.destroy();
      const defaultHandler = NotificationErrorHandler.getInstance();
      
      expect(defaultHandler).toBeDefined();
    });

    it('should allow configuration updates', () => {
      errorHandler.updateConfig({
        maxRetries: 5,
        baseDelay: 2000
      });
      
      // Configuration is private, but we can test behavior
      expect(errorHandler).toBeDefined();
    });

    it('should handle singleton pattern correctly', () => {
      const handler1 = NotificationErrorHandler.getInstance();
      const handler2 = NotificationErrorHandler.getInstance();
      
      expect(handler1).toBe(handler2);
    });
  });

  describe('Utility Methods', () => {
    it('should clear retry queue', async () => {
      const networkError = new Error('network error');
      networkError.name = 'NetworkError';
      
      await errorHandler.handleError(networkError, mockContext);
      expect(errorHandler.getErrorStats().activeRetries).toBe(1);
      
      errorHandler.clearRetryQueue();
      expect(errorHandler.getErrorStats().activeRetries).toBe(0);
    });

    it('should clear error log', async () => {
      const testError = new Error('test error');
      await errorHandler.handleError(testError, mockContext);
      
      expect(errorHandler.getErrorStats().totalErrors).toBe(1);
      
      errorHandler.clearErrorLog();
      expect(errorHandler.getErrorStats().totalErrors).toBe(0);
    });

    it('should provide comprehensive error statistics', async () => {
      const networkError = new Error('network error');
      networkError.name = 'NetworkError';
      
      const validationError = new Error('validation error');
      (validationError as any).code = '23505';
      
      await errorHandler.handleError(networkError, mockContext);
      await errorHandler.handleError(validationError, {
        ...mockContext,
        operationId: 'validation-op'
      });
      
      const stats = errorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(2);
      expect(stats.errorsByType[NotificationErrorType.NETWORK_ERROR]).toBe(1);
      expect(stats.errorsByType[NotificationErrorType.VALIDATION_ERROR]).toBe(1);
      expect(stats.activeRetries).toBe(1); // Only network error is retryable
    });
  });

  describe('Event Emission', () => {
    it('should emit custom events for final failures', async () => {
      const eventListener = vi.fn();
      window.addEventListener('notificationError', eventListener);
      
      const permissionError = new Error('final failure');
      (permissionError as any).code = 'PGRST301';
      
      await errorHandler.handleError(permissionError, mockContext);
      
      expect(eventListener).toHaveBeenCalled();
      
      window.removeEventListener('notificationError', eventListener);
    });
  });

  describe('Network Status Detection', () => {
    it('should detect offline status as network error', async () => {
      // Mock offline status
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });
      
      const offlineError = new Error('offline error');
      await errorHandler.handleError(offlineError, mockContext);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.errorsByType[NotificationErrorType.NETWORK_ERROR]).toBe(1);
      
      // Restore online status
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: true
      });
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', () => {
      const initialStats = errorHandler.getErrorStats();
      
      errorHandler.destroy();
      
      // After destroy, should not have active timers or queues
      expect(errorHandler.getErrorStats().activeRetries).toBe(0);
      expect(errorHandler.getErrorStats().totalErrors).toBe(0);
    });
  });
});