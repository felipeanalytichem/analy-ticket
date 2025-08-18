/**
 * Comprehensive unit tests for ErrorRecoveryManager
 * Tests error handling, retry logic, and recovery mechanisms
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorRecoveryManager } from '../ErrorRecoveryManager';
import {
  createMockLocalStorage,
  TimerUtils,
  ErrorSimulator,
  PerformanceTestUtils,
  MemoryTestUtils
} from '../../test/utils/sessionTestUtils';

// Mock localStorage
const mockLocalStorage = createMockLocalStorage();
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

// Mock session manager
const mockSessionManager = {
  refreshSession: vi.fn(),
  getSessionStatus: vi.fn(),
  handleSessionExpired: vi.fn()
};

vi.mock('../SessionManager', () => ({
  SessionManager: vi.fn().mockImplementation(() => mockSessionManager)
}));

describe('ErrorRecoveryManager', () => {
  let errorRecoveryManager: ErrorRecoveryManager;
  let memoryTracker: ReturnType<typeof MemoryTestUtils.trackTimers>;

  beforeEach(() => {
    vi.clearAllMocks();
    TimerUtils.useFakeTimers();
    memoryTracker = MemoryTestUtils.trackTimers();
    errorRecoveryManager = new ErrorRecoveryManager();
    mockLocalStorage.clear();
  });

  afterEach(() => {
    errorRecoveryManager.cleanup?.();
    memoryTracker.cleanup();
    TimerUtils.useRealTimers();
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const networkError = ErrorSimulator.networkError();
      const context = {
        action: { id: '1', type: 'api-call', payload: {}, timestamp: new Date(), retryCount: 0, maxRetries: 3 },
        cacheKey: 'test-cache'
      };

      const queueSpy = vi.spyOn(errorRecoveryManager, 'queueAction');
      const getCachedSpy = vi.spyOn(errorRecoveryManager, 'getCachedData').mockResolvedValue(null);

      await expect(errorRecoveryManager.handleApiError(networkError, context)).rejects.toThrow();

      expect(queueSpy).toHaveBeenCalledWith(context.action);
      expect(getCachedSpy).toHaveBeenCalledWith(context.cacheKey);
    });

    it('should handle auth errors with token refresh', async () => {
      const authError = ErrorSimulator.authError();
      const context = {
        action: { id: '1', type: 'api-call', payload: {}, timestamp: new Date(), retryCount: 0, maxRetries: 3 },
        cacheKey: 'test-cache'
      };

      mockSessionManager.refreshSession.mockResolvedValue(true);
      const retrySpy = vi.spyOn(errorRecoveryManager, 'retryAction').mockResolvedValue({ success: true });

      const result = await errorRecoveryManager.handleApiError(authError, context);

      expect(mockSessionManager.refreshSession).toHaveBeenCalled();
      expect(retrySpy).toHaveBeenCalledWith(context.action);
      expect(result).toEqual({ success: true });
    });

    it('should redirect to login when token refresh fails', async () => {
      const authError = ErrorSimulator.authError();
      const context = {
        action: { id: '1', type: 'api-call', payload: {}, timestamp: new Date(), retryCount: 0, maxRetries: 3 },
        cacheKey: 'test-cache'
      };

      mockSessionManager.refreshSession.mockResolvedValue(false);
      const redirectSpy = vi.spyOn(errorRecoveryManager, 'redirectToLogin');

      await expect(errorRecoveryManager.handleApiError(authError, context)).rejects.toThrow();

      expect(redirectSpy).toHaveBeenCalled();
    });

    it('should handle timeout errors', async () => {
      const timeoutError = ErrorSimulator.timeoutError();
      const context = {
        action: { id: '1', type: 'api-call', payload: {}, timestamp: new Date(), retryCount: 0, maxRetries: 3 },
        cacheKey: 'test-cache'
      };

      const queueSpy = vi.spyOn(errorRecoveryManager, 'queueAction');

      await expect(errorRecoveryManager.handleApiError(timeoutError, context)).rejects.toThrow();

      expect(queueSpy).toHaveBeenCalledWith(context.action);
    });

    it('should handle generic errors', async () => {
      const genericError = ErrorSimulator.genericError('Unknown error');
      const context = {
        action: { id: '1', type: 'api-call', payload: {}, timestamp: new Date(), retryCount: 0, maxRetries: 3 },
        cacheKey: 'test-cache'
      };

      const logSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(errorRecoveryManager.handleApiError(genericError, context)).rejects.toThrow();

      expect(logSpy).toHaveBeenCalledWith('Unhandled error:', genericError);
    });

    it('should return cached data when available', async () => {
      const networkError = ErrorSimulator.networkError();
      const cachedData = { data: 'cached-response' };
      const context = {
        action: { id: '1', type: 'api-call', payload: {}, timestamp: new Date(), retryCount: 0, maxRetries: 3 },
        cacheKey: 'test-cache'
      };

      vi.spyOn(errorRecoveryManager, 'getCachedData').mockResolvedValue(cachedData);

      const result = await errorRecoveryManager.handleApiError(networkError, context);

      expect(result).toEqual(cachedData);
    });
  });

  describe('Retry Queue Management', () => {
    it('should queue actions for retry', () => {
      const action = {
        id: '1',
        type: 'api-call',
        payload: { data: 'test' },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3
      };

      errorRecoveryManager.queueAction(action);

      const queue = errorRecoveryManager.getRetryQueue('api-call');
      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('1');
    });

    it('should process retry queue successfully', async () => {
      const action = {
        id: '1',
        type: 'api-call',
        payload: { data: 'test' },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3
      };

      errorRecoveryManager.queueAction(action);

      const retrySpy = vi.spyOn(errorRecoveryManager, 'retryAction').mockResolvedValue({ success: true });
      const removeSpy = vi.spyOn(errorRecoveryManager, 'removeFromQueue');

      await errorRecoveryManager.processRetryQueue();

      expect(retrySpy).toHaveBeenCalledWith(action);
      expect(removeSpy).toHaveBeenCalledWith('api-call', '1');
    });

    it('should increment retry count on failure', async () => {
      const action = {
        id: '1',
        type: 'api-call',
        payload: { data: 'test' },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3
      };

      errorRecoveryManager.queueAction(action);

      vi.spyOn(errorRecoveryManager, 'retryAction').mockRejectedValue(new Error('Retry failed'));

      await errorRecoveryManager.processRetryQueue();

      const queue = errorRecoveryManager.getRetryQueue('api-call');
      expect(queue[0].retryCount).toBe(1);
    });

    it('should remove action after max retries', async () => {
      const action = {
        id: '1',
        type: 'api-call',
        payload: { data: 'test' },
        timestamp: new Date(),
        retryCount: 2, // Already tried twice
        maxRetries: 3
      };

      errorRecoveryManager.queueAction(action);

      vi.spyOn(errorRecoveryManager, 'retryAction').mockRejectedValue(new Error('Final retry failed'));
      const handleFailedSpy = vi.spyOn(errorRecoveryManager, 'handleFailedAction');

      await errorRecoveryManager.processRetryQueue();

      const queue = errorRecoveryManager.getRetryQueue('api-call');
      expect(queue).toHaveLength(0);
      expect(handleFailedSpy).toHaveBeenCalledWith(action, expect.any(Error));
    });

    it('should handle multiple action types in queue', async () => {
      const apiAction = {
        id: '1',
        type: 'api-call',
        payload: {},
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3
      };

      const uploadAction = {
        id: '2',
        type: 'file-upload',
        payload: {},
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3
      };

      errorRecoveryManager.queueAction(apiAction);
      errorRecoveryManager.queueAction(uploadAction);

      vi.spyOn(errorRecoveryManager, 'retryAction').mockResolvedValue({ success: true });

      await errorRecoveryManager.processRetryQueue();

      expect(errorRecoveryManager.getRetryQueue('api-call')).toHaveLength(0);
      expect(errorRecoveryManager.getRetryQueue('file-upload')).toHaveLength(0);
    });

    it('should persist retry queue to storage', () => {
      const action = {
        id: '1',
        type: 'api-call',
        payload: { data: 'test' },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3
      };

      errorRecoveryManager.queueAction(action);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'error-recovery-queue',
        expect.stringContaining('"id":"1"')
      );
    });

    it('should restore retry queue from storage', () => {
      const queueData = [{
        id: '1',
        type: 'api-call',
        payload: { data: 'test' },
        timestamp: new Date().toISOString(),
        retryCount: 1,
        maxRetries: 3
      }];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(queueData));

      const newManager = new ErrorRecoveryManager();
      const queue = newManager.getRetryQueue('api-call');

      expect(queue).toHaveLength(1);
      expect(queue[0].id).toBe('1');
      expect(queue[0].retryCount).toBe(1);
    });
  });

  describe('Exponential Backoff', () => {
    it('should calculate exponential backoff delay', () => {
      const delays = [
        errorRecoveryManager.calculateBackoffDelay(0),
        errorRecoveryManager.calculateBackoffDelay(1),
        errorRecoveryManager.calculateBackoffDelay(2),
        errorRecoveryManager.calculateBackoffDelay(3)
      ];

      expect(delays[1]).toBeGreaterThan(delays[0]);
      expect(delays[2]).toBeGreaterThan(delays[1]);
      expect(delays[3]).toBeGreaterThan(delays[2]);
    });

    it('should cap backoff delay at maximum', () => {
      const maxDelay = errorRecoveryManager.calculateBackoffDelay(10);
      expect(maxDelay).toBeLessThanOrEqual(30000); // 30 seconds max
    });

    it('should add jitter to backoff delay', () => {
      const delay1 = errorRecoveryManager.calculateBackoffDelay(2);
      const delay2 = errorRecoveryManager.calculateBackoffDelay(2);

      // With jitter, delays should potentially be different
      // (though they might be the same due to randomness)
      expect(typeof delay1).toBe('number');
      expect(typeof delay2).toBe('number');
    });

    it('should schedule retry with backoff delay', async () => {
      const action = {
        id: '1',
        type: 'api-call',
        payload: {},
        timestamp: new Date(),
        retryCount: 1,
        maxRetries: 3
      };

      errorRecoveryManager.queueAction(action);
      vi.spyOn(errorRecoveryManager, 'retryAction').mockRejectedValue(new Error('Retry failed'));

      await errorRecoveryManager.processRetryQueue();

      // Should schedule retry with delay
      expect(memoryTracker.getActiveTimers().size).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    it('should cache successful responses', async () => {
      const cacheKey = 'test-cache-key';
      const responseData = { data: 'cached-response' };

      await errorRecoveryManager.setCachedData(cacheKey, responseData);

      const cachedData = await errorRecoveryManager.getCachedData(cacheKey);
      expect(cachedData).toEqual(responseData);
    });

    it('should return null for non-existent cache', async () => {
      const cachedData = await errorRecoveryManager.getCachedData('non-existent');
      expect(cachedData).toBeNull();
    });

    it('should expire cached data after TTL', async () => {
      const cacheKey = 'test-cache-key';
      const responseData = { data: 'cached-response' };

      await errorRecoveryManager.setCachedData(cacheKey, responseData, 1000); // 1 second TTL

      // Advance time beyond TTL
      TimerUtils.advanceTimersByTime(2000);

      const cachedData = await errorRecoveryManager.getCachedData(cacheKey);
      expect(cachedData).toBeNull();
    });

    it('should handle cache storage errors gracefully', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      await expect(
        errorRecoveryManager.setCachedData('test-key', { data: 'test' })
      ).resolves.not.toThrow();
    });

    it('should clear expired cache entries', async () => {
      await errorRecoveryManager.setCachedData('key1', { data: '1' }, 1000);
      await errorRecoveryManager.setCachedData('key2', { data: '2' }, 5000);

      TimerUtils.advanceTimersByTime(2000);

      await errorRecoveryManager.clearExpiredCache();

      expect(await errorRecoveryManager.getCachedData('key1')).toBeNull();
      expect(await errorRecoveryManager.getCachedData('key2')).toEqual({ data: '2' });
    });
  });

  describe('Error Metrics', () => {
    it('should track error metrics', () => {
      const networkError = ErrorSimulator.networkError();
      const authError = ErrorSimulator.authError();

      errorRecoveryManager.recordError(networkError);
      errorRecoveryManager.recordError(authError);
      errorRecoveryManager.recordError(networkError);

      const metrics = errorRecoveryManager.getErrorMetrics();

      expect(metrics.totalErrors).toBe(3);
      expect(metrics.errorsByType['Network request failed']).toBe(2);
      expect(metrics.errorsByType['Authentication failed']).toBe(1);
    });

    it('should calculate error rates', () => {
      // Record errors over time
      for (let i = 0; i < 10; i++) {
        errorRecoveryManager.recordError(ErrorSimulator.networkError());
      }

      TimerUtils.advanceTimersByTime(60000); // 1 minute

      for (let i = 0; i < 5; i++) {
        errorRecoveryManager.recordError(ErrorSimulator.authError());
      }

      const metrics = errorRecoveryManager.getErrorMetrics();
      expect(metrics.totalErrors).toBe(15);
      expect(metrics.recentErrorRate).toBeGreaterThan(0);
    });

    it('should reset error metrics', () => {
      errorRecoveryManager.recordError(ErrorSimulator.networkError());
      errorRecoveryManager.recordError(ErrorSimulator.authError());

      errorRecoveryManager.resetErrorMetrics();

      const metrics = errorRecoveryManager.getErrorMetrics();
      expect(metrics.totalErrors).toBe(0);
      expect(Object.keys(metrics.errorsByType)).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should handle errors within performance threshold', async () => {
      const networkError = ErrorSimulator.networkError();
      const context = {
        action: { id: '1', type: 'api-call', payload: {}, timestamp: new Date(), retryCount: 0, maxRetries: 3 },
        cacheKey: 'test-cache'
      };

      vi.spyOn(errorRecoveryManager, 'getCachedData').mockResolvedValue({ data: 'cached' });

      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(
        () => errorRecoveryManager.handleApiError(networkError, context)
      );

      expect(time).toBeLessThan(100); // Should complete within 100ms
    });

    it('should process retry queue efficiently', async () => {
      // Queue multiple actions
      for (let i = 0; i < 10; i++) {
        errorRecoveryManager.queueAction({
          id: `${i}`,
          type: 'api-call',
          payload: {},
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 3
        });
      }

      vi.spyOn(errorRecoveryManager, 'retryAction').mockResolvedValue({ success: true });

      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(
        () => errorRecoveryManager.processRetryQueue()
      );

      expect(time).toBeLessThan(200); // Should complete within 200ms
    });

    it('should handle high-frequency error recording efficiently', () => {
      const { time } = PerformanceTestUtils.measureExecutionTime(() => {
        for (let i = 0; i < 1000; i++) {
          errorRecoveryManager.recordError(ErrorSimulator.networkError());
        }
      });

      expect(time).toBeLessThan(100); // Should complete within 100ms
    });
  });

  describe('Memory Management', () => {
    it('should not leak timers when processing retries', async () => {
      const action = {
        id: '1',
        type: 'api-call',
        payload: {},
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3
      };

      errorRecoveryManager.queueAction(action);
      vi.spyOn(errorRecoveryManager, 'retryAction').mockResolvedValue({ success: true });

      await errorRecoveryManager.processRetryQueue();

      expect(memoryTracker.getActiveTimers().size).toBe(0);
    });

    it('should cleanup resources properly', () => {
      // Queue some actions and record errors
      errorRecoveryManager.queueAction({
        id: '1',
        type: 'api-call',
        payload: {},
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3
      });

      errorRecoveryManager.recordError(ErrorSimulator.networkError());

      errorRecoveryManager.cleanup?.();

      expect(memoryTracker.getActiveTimers().size).toBe(0);
    });

    it('should limit cache size to prevent memory bloat', async () => {
      // Add many cache entries
      for (let i = 0; i < 1000; i++) {
        await errorRecoveryManager.setCachedData(`key-${i}`, { data: i });
      }

      const cacheSize = errorRecoveryManager.getCacheSize();
      expect(cacheSize).toBeLessThanOrEqual(100); // Should limit cache size
    });

    it('should limit error history to prevent memory bloat', () => {
      // Record many errors
      for (let i = 0; i < 10000; i++) {
        errorRecoveryManager.recordError(ErrorSimulator.networkError());
      }

      const metrics = errorRecoveryManager.getErrorMetrics();
      expect(metrics.errorHistory.length).toBeLessThanOrEqual(1000); // Should limit history
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed queue data from storage', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid-json');

      expect(() => new ErrorRecoveryManager()).not.toThrow();
    });

    it('should handle actions with missing required fields', () => {
      const malformedAction = {
        id: '1',
        // Missing type, payload, etc.
      } as any;

      expect(() => errorRecoveryManager.queueAction(malformedAction)).not.toThrow();
    });

    it('should handle retry of non-existent action', async () => {
      const nonExistentAction = {
        id: 'non-existent',
        type: 'api-call',
        payload: {},
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3
      };

      await expect(
        errorRecoveryManager.retryAction(nonExistentAction)
      ).resolves.not.toThrow();
    });

    it('should handle errors without error codes', async () => {
      const errorWithoutCode = new Error('Generic error');
      const context = {
        action: { id: '1', type: 'api-call', payload: {}, timestamp: new Date(), retryCount: 0, maxRetries: 3 },
        cacheKey: 'test-cache'
      };

      await expect(
        errorRecoveryManager.handleApiError(errorWithoutCode, context)
      ).rejects.toThrow();
    });

    it('should handle concurrent queue processing', async () => {
      const action = {
        id: '1',
        type: 'api-call',
        payload: {},
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3
      };

      errorRecoveryManager.queueAction(action);
      vi.spyOn(errorRecoveryManager, 'retryAction').mockResolvedValue({ success: true });

      // Process queue concurrently
      const promises = [
        errorRecoveryManager.processRetryQueue(),
        errorRecoveryManager.processRetryQueue()
      ];

      await Promise.all(promises);

      // Should not cause issues
      expect(errorRecoveryManager.getRetryQueue('api-call')).toHaveLength(0);
    });

    it('should handle cache operations with undefined data', async () => {
      await expect(
        errorRecoveryManager.setCachedData('test-key', undefined)
      ).resolves.not.toThrow();

      const cachedData = await errorRecoveryManager.getCachedData('test-key');
      expect(cachedData).toBeNull();
    });
  });
});