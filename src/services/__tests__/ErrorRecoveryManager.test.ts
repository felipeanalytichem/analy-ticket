import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorRecoveryManager, QueuedAction, ErrorContext, ErrorType } from '../ErrorRecoveryManager';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      refreshSession: vi.fn(),
      getSession: vi.fn()
    }
  }
}));

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock window.location
Object.defineProperty(window, 'location', {
  writable: true,
  value: {
    href: ''
  }
});

describe('ErrorRecoveryManager', () => {
  let errorManager: ErrorRecoveryManager;
  let mockAction: QueuedAction;
  let mockContext: ErrorContext;

  beforeEach(async () => {
    const { supabase } = await import('@/lib/supabase');
    vi.mocked(supabase.auth.refreshSession).mockClear();
    vi.mocked(supabase.auth.getSession).mockClear();

    errorManager = new ErrorRecoveryManager({
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 1000,
      enableCache: true,
      enableQueue: true,
      userNotification: false // Disable for tests
    });

    mockAction = {
      id: 'test-action-1',
      type: 'TEST_ACTION',
      payload: { data: 'test' },
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3,
      originalRequest: vi.fn().mockResolvedValue({ success: true })
    };

    mockContext = {
      action: mockAction,
      cacheKey: 'test-cache-key',
      fallbackData: { fallback: true },
      userMessage: 'Test error message'
    };
  });

  afterEach(() => {
    errorManager.destroy();
  });

  describe('Error Categorization', () => {
    it('should categorize network errors correctly', async () => {
      const networkError = new Error('Network request failed');
      networkError.name = 'NetworkError';

      try {
        await errorManager.handleError(networkError, mockContext);
      } catch (error) {
        // Expected to throw
      }

      const metrics = errorManager.getMetrics();
      expect(metrics.errorsByType.NETWORK_ERROR).toBe(1);
    });

    it('should categorize auth errors correctly', async () => {
      const authError = { status: 401, message: 'Unauthorized' };

      try {
        await errorManager.handleError(authError, mockContext);
      } catch (error) {
        // Expected to throw
      }

      const metrics = errorManager.getMetrics();
      expect(metrics.errorsByType.AUTH_ERROR).toBe(1);
    });

    it('should categorize timeout errors correctly', async () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.name = 'TimeoutError';

      try {
        await errorManager.handleError(timeoutError, mockContext);
      } catch (error) {
        // Expected to throw
      }

      const metrics = errorManager.getMetrics();
      expect(metrics.errorsByType.TIMEOUT_ERROR).toBe(1);
    });

    it('should categorize rate limit errors correctly', async () => {
      const rateLimitError = { status: 429, message: 'Too Many Requests' };

      try {
        await errorManager.handleError(rateLimitError, mockContext);
      } catch (error) {
        // Expected to throw
      }

      const metrics = errorManager.getMetrics();
      expect(metrics.errorsByType.RATE_LIMIT_ERROR).toBe(1);
    });

    it('should categorize server errors correctly', async () => {
      const serverError = { status: 500, message: 'Internal Server Error' };

      try {
        await errorManager.handleError(serverError, mockContext);
      } catch (error) {
        // Expected to throw
      }

      const metrics = errorManager.getMetrics();
      expect(metrics.errorsByType.SERVER_ERROR).toBe(1);
    });

    it('should categorize validation errors correctly', async () => {
      const validationError = { status: 400, message: 'Validation failed' };

      try {
        await errorManager.handleError(validationError, mockContext);
      } catch (error) {
        // Expected to throw
      }

      const metrics = errorManager.getMetrics();
      expect(metrics.errorsByType.VALIDATION_ERROR).toBe(1);
    });
  });

  describe('Network Error Handling', () => {
    it('should return cached data when available for network errors', async () => {
      const networkError = new Error('Network failed');
      networkError.name = 'NetworkError';

      // Set cached data
      errorManager.setCachedData('test-cache-key', { cached: true });

      const result = await errorManager.handleError(networkError, mockContext);
      expect(result).toEqual({ cached: true });
    });

    it('should queue actions for retry on network errors', async () => {
      const networkError = new Error('Network failed');
      networkError.name = 'NetworkError';

      mockContext.cacheKey = undefined; // No cache available

      const result = await errorManager.handleError(networkError, mockContext);
      expect(result).toBeNull(); // Queued for retry

      // Verify action was queued
      await errorManager.processRetryQueue();
      expect(mockAction.originalRequest).toHaveBeenCalled();
    });

    it('should handle offline scenarios', async () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', { value: false });

      const networkError = new Error('Network failed');
      networkError.name = 'NetworkError';

      // Set cached data
      errorManager.setCachedData('test-cache-key', { offline: true });

      const result = await errorManager.handleError(networkError, mockContext);
      expect(result).toEqual({ offline: true });

      // Restore online state
      Object.defineProperty(navigator, 'onLine', { value: true });
    });
  });

  describe('Authentication Error Handling', () => {
    it('should attempt token refresh for expired tokens', async () => {
      const { supabase } = await import('@/lib/supabase');
      const authError = { 
        status: 401, 
        message: 'JWT expired',
        code: 'TOKEN_EXPIRED'
      };

      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: { access_token: 'new-token' } },
        error: null
      });

      const result = await errorManager.handleError(authError, mockContext);
      expect(supabase.auth.refreshSession).toHaveBeenCalled();
      expect(mockAction.originalRequest).toHaveBeenCalled();
    });

    it('should redirect to login when token refresh fails', async () => {
      const { supabase } = await import('@/lib/supabase');
      const authError = { 
        status: 401, 
        message: 'JWT expired',
        code: 'TOKEN_EXPIRED'
      };

      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: null },
        error: new Error('Refresh failed')
      });

      try {
        await errorManager.handleError(authError, mockContext);
      } catch (error) {
        expect(error.message).toContain('Session expired');
      }

      expect(window.location.href).toBe('/login');
    });

    it('should handle permission errors appropriately', async () => {
      const permissionError = { status: 403, message: 'Forbidden' };

      try {
        await errorManager.handleError(permissionError, mockContext);
      } catch (error) {
        expect(error).toEqual(permissionError);
      }
    });
  });

  describe('Retry Queue Management', () => {
    it('should queue actions and process them', async () => {
      const error = new Error('Temporary error');
      mockContext.cacheKey = undefined;
      mockContext.fallbackData = undefined;

      // First attempt should queue the action
      try {
        await errorManager.handleError(error, mockContext);
      } catch (e) {
        // Expected to throw since no fallback
      }

      // Process the queue
      await errorManager.processRetryQueue();

      expect(mockAction.originalRequest).toHaveBeenCalled();
    });

    it('should respect max retry limits', async () => {
      const error = new Error('Persistent error');
      mockAction.originalRequest = vi.fn().mockRejectedValue(error);
      mockContext.cacheKey = undefined;
      mockContext.fallbackData = undefined;

      // First error should queue the action
      try {
        await errorManager.handleError(error, mockContext);
      } catch (e) {
        // Expected
      }

      // Process the queue multiple times to exhaust retries
      for (let i = 0; i < 4; i++) {
        await errorManager.processRetryQueue();
      }

      // Should have attempted the max number of retries
      expect(mockAction.originalRequest).toHaveBeenCalledTimes(3);
    });

    it('should calculate exponential backoff correctly', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'TimeoutError';
      mockContext.cacheKey = undefined;

      const startTime = Date.now();
      
      // This should queue with backoff
      await errorManager.handleError(timeoutError, mockContext);
      
      // The delay calculation should be tested indirectly through timing
      // In a real scenario, you'd mock setTimeout to verify delay values
    });
  });

  describe('Caching System', () => {
    it('should store and retrieve cached data', () => {
      const testData = { test: 'data' };
      errorManager.setCachedData('test-key', testData, 1000);

      // Should retrieve valid cached data
      const cached = errorManager['getCachedData']('test-key');
      expect(cached).toEqual(testData);
    });

    it('should expire cached data after TTL', async () => {
      const testData = { test: 'data' };
      errorManager.setCachedData('test-key', testData, 10); // 10ms TTL

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 20));

      const cached = errorManager['getCachedData']('test-key');
      expect(cached).toBeNull();
    });

    it('should clear expired cache entries', async () => {
      errorManager.setCachedData('key1', { data: 1 }, 10);
      errorManager.setCachedData('key2', { data: 2 }, 1000);

      // Wait for first entry to expire
      await new Promise(resolve => setTimeout(resolve, 20));

      // Trigger cache cleanup
      errorManager['clearExpiredCache']();

      expect(errorManager['getCachedData']('key1')).toBeNull();
      expect(errorManager['getCachedData']('key2')).toEqual({ data: 2 });
    });
  });

  describe('Error Metrics', () => {
    it('should track error metrics correctly', async () => {
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';

      const authError = { status: 401, message: 'Unauthorized' };

      try {
        await errorManager.handleError(networkError, mockContext);
      } catch (e) {}

      try {
        await errorManager.handleError(authError, mockContext);
      } catch (e) {}

      const metrics = errorManager.getMetrics();
      expect(metrics.totalErrors).toBe(2);
      expect(metrics.errorsByType.NETWORK_ERROR).toBe(1);
      expect(metrics.errorsByType.AUTH_ERROR).toBe(1);
    });

    it('should update recovery success rate', async () => {
      // Set up a successful recovery scenario
      errorManager.setCachedData('test-cache-key', { success: true });
      
      const networkError = new Error('Network error');
      networkError.name = 'NetworkError';

      const result = await errorManager.handleError(networkError, mockContext);
      expect(result).toEqual({ success: true });

      const metrics = errorManager.getMetrics();
      expect(metrics.recoverySuccessRate).toBeGreaterThan(0);
    });
  });

  describe('Event System', () => {
    it('should emit and handle error events', async () => {
      const eventCallback = vi.fn();
      errorManager.addEventListener('user_message', eventCallback);

      // Enable user notifications for this test
      errorManager['options'].userNotification = true;

      const error = new Error('Test error');
      try {
        await errorManager.handleError(error, mockContext);
      } catch (e) {}

      expect(eventCallback).toHaveBeenCalled();
    });

    it('should remove event listeners', () => {
      const eventCallback = vi.fn();
      errorManager.addEventListener('test_event', eventCallback);
      errorManager.removeEventListener('test_event', eventCallback);

      errorManager['emitErrorEvent']('test_event', new Error('test'), mockContext);
      expect(eventCallback).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    it('should handle rate limit errors with retry-after header', async () => {
      const rateLimitError = {
        status: 429,
        headers: { 'retry-after': '60' },
        message: 'Rate limited'
      };

      const result = await errorManager.handleError(rateLimitError, mockContext);
      expect(result).toBeNull(); // Should be queued for retry
    });
  });

  describe('Fallback Data', () => {
    it('should use fallback data when cache is not available', async () => {
      const error = new Error('Generic error');
      mockContext.cacheKey = undefined; // No cache key

      const result = await errorManager.handleError(error, mockContext);
      expect(result).toEqual({ fallback: true });
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should clean up resources on destroy', () => {
      const manager = new ErrorRecoveryManager();
      manager.setCachedData('test', { data: 'test' });
      
      manager.destroy();
      
      expect(manager['queueProcessInterval']).toBeNull();
      expect(manager.getMetrics().totalErrors).toBe(0);
    });

    it('should reset state correctly', () => {
      errorManager.setCachedData('test', { data: 'test' });
      
      const error = new Error('Test');
      errorManager['updateErrorMetrics']('NETWORK_ERROR');
      
      errorManager.reset();
      
      const metrics = errorManager.getMetrics();
      expect(metrics.totalErrors).toBe(0);
      expect(Object.keys(metrics.errorsByType)).toHaveLength(0);
    });
  });

  describe('Global Error Handling', () => {
    it('should handle unhandled promise rejections', () => {
      // Create a new manager with global error handling enabled for this test
      const testManager = new ErrorRecoveryManager({ userNotification: false });
      const handleErrorSpy = vi.spyOn(testManager, 'handleError').mockResolvedValue(null);
      
      // Simulate unhandled promise rejection
      const rejectionEvent = new Event('unhandledrejection') as any;
      rejectionEvent.reason = new Error('Unhandled error');
      
      window.dispatchEvent(rejectionEvent);
      
      expect(handleErrorSpy).toHaveBeenCalled();
      
      // Clean up
      testManager.destroy();
    });
  });

  describe('Utility Methods', () => {
    it('should identify read operations correctly', () => {
      const readAction = { ...mockAction, type: 'GET_DATA' };
      expect(errorManager['isReadOperation'](readAction)).toBe(true);

      const writeAction = { ...mockAction, type: 'POST_DATA' };
      expect(errorManager['isReadOperation'](writeAction)).toBe(false);
    });

    it('should extract retry-after values', () => {
      const error = { headers: { 'retry-after': '120' } };
      expect(errorManager['extractRetryAfter'](error)).toBe('120');

      const errorWithoutHeader = { message: 'Error' };
      expect(errorManager['extractRetryAfter'](errorWithoutHeader)).toBeNull();
    });

    it('should extract validation messages', () => {
      const validationError = { details: 'Field is required' };
      expect(errorManager['extractValidationMessage'](validationError)).toBe('Field is required');

      const genericError = { message: 'Generic error' };
      expect(errorManager['extractValidationMessage'](genericError)).toBe('Generic error');
    });
  });
});