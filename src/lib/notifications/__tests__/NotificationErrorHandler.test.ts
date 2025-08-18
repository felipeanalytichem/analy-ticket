import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationErrorHandler } from '../NotificationErrorHandler';

describe('NotificationErrorHandler', () => {
  let errorHandler: NotificationErrorHandler;

  beforeEach(() => {
    errorHandler = new NotificationErrorHandler();
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
  });

  afterEach(async () => {
    await errorHandler.cleanup();
    vi.clearAllTimers();
  });

  describe('handleError', () => {
    it('should log error and attempt recovery', async () => {
      const error = new Error('Test error');
      const context = {
        operation: 'getNotifications',
        userId: 'test-user-id'
      };

      await errorHandler.handleError(error, context);

      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(1);
      expect(stats.byOperation['getNotifications']).toBe(1);
    });

    it('should determine correct error severity', async () => {
      const networkError = new Error('network timeout');
      const databaseError = new Error('database connection failed');
      const authError = new Error('auth permission denied');

      await errorHandler.handleError(networkError, { operation: 'test' });
      await errorHandler.handleError(databaseError, { operation: 'test' });
      await errorHandler.handleError(authError, { operation: 'test' });

      const mediumErrors = errorHandler.getErrorsBySeverity('medium');
      const highErrors = errorHandler.getErrorsBySeverity('high');

      expect(mediumErrors).toHaveLength(1);
      expect(highErrors).toHaveLength(2);
    });

    it('should mark critical errors correctly', async () => {
      const error = new Error('Critical system failure');
      const context = {
        operation: 'createNotification',
        notification: { priority: 'high' }
      };

      await errorHandler.handleError(error, context);

      const criticalErrors = errorHandler.getErrorsBySeverity('critical');
      expect(criticalErrors).toHaveLength(1);
    });
  });

  describe('error recovery strategies', () => {
    it('should handle network errors with retry', async () => {
      const networkError = new Error('network connection failed');
      const context = { operation: 'getNotifications', userId: 'test-user' };

      await errorHandler.handleError(networkError, context);

      // Should have attempted recovery
      const recentErrors = errorHandler.getRecentErrors(1);
      expect(recentErrors[0].resolved).toBe(true);
    });

    it('should handle offline scenarios', async () => {
      // Mock offline state
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      const networkError = new Error('network timeout');
      const context = { operation: 'getNotifications', userId: 'test-user' };

      await errorHandler.handleError(networkError, context);

      const recentErrors = errorHandler.getRecentErrors(1);
      expect(recentErrors[0].resolved).toBe(false);
    });

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('request timeout');
      const context = { operation: 'markAsRead', notificationId: 'test-id' };

      await errorHandler.handleError(timeoutError, context);

      const recentErrors = errorHandler.getRecentErrors(1);
      expect(recentErrors[0].resolved).toBe(true);
    });
  });

  describe('error statistics', () => {
    it('should track error statistics correctly', async () => {
      const error1 = new Error('network error');
      const error2 = new Error('database error');
      const error3 = new Error('auth error');

      await errorHandler.handleError(error1, { operation: 'getNotifications' });
      await errorHandler.handleError(error2, { operation: 'createNotification' });
      await errorHandler.handleError(error3, { operation: 'getNotifications' });

      const stats = errorHandler.getErrorStats();

      expect(stats.total).toBe(3);
      expect(stats.resolved).toBe(2); // network and auth errors should be resolved
      expect(stats.unresolved).toBe(1); // database error
      expect(stats.byOperation['getNotifications']).toBe(2);
      expect(stats.byOperation['createNotification']).toBe(1);
    });

    it('should track errors by severity', async () => {
      const lowError = new Error('minor issue');
      const mediumError = new Error('network timeout');
      const highError = new Error('database connection failed');
      const criticalError = new Error('system failure');

      await errorHandler.handleError(lowError, { operation: 'test' });
      await errorHandler.handleError(mediumError, { operation: 'test' });
      await errorHandler.handleError(highError, { operation: 'test' });
      await errorHandler.handleError(criticalError, { 
        operation: 'createNotification',
        notification: { priority: 'high' }
      });

      const stats = errorHandler.getErrorStats();

      expect(stats.bySeverity.low).toBe(1);
      expect(stats.bySeverity.medium).toBe(1);
      expect(stats.bySeverity.high).toBe(1);
      expect(stats.bySeverity.critical).toBe(1);
    });
  });

  describe('getRecentErrors', () => {
    it('should return recent errors in chronological order', async () => {
      const error1 = new Error('First error');
      const error2 = new Error('Second error');
      const error3 = new Error('Third error');

      await errorHandler.handleError(error1, { operation: 'test1' });
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      await errorHandler.handleError(error2, { operation: 'test2' });
      await new Promise(resolve => setTimeout(resolve, 1));
      await errorHandler.handleError(error3, { operation: 'test3' });

      const recentErrors = errorHandler.getRecentErrors(2);

      expect(recentErrors).toHaveLength(2);
      expect(recentErrors[0].error.message).toBe('Third error');
      expect(recentErrors[1].error.message).toBe('Second error');
    });

    it('should respect limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await errorHandler.handleError(new Error(`Error ${i}`), { operation: 'test' });
      }

      const recentErrors = errorHandler.getRecentErrors(3);
      expect(recentErrors).toHaveLength(3);
    });
  });

  describe('getErrorsBySeverity', () => {
    it('should return errors filtered by severity', async () => {
      const networkError = new Error('network timeout');
      const databaseError = new Error('database failed');
      const authError = new Error('auth denied');

      await errorHandler.handleError(networkError, { operation: 'test' });
      await errorHandler.handleError(databaseError, { operation: 'test' });
      await errorHandler.handleError(authError, { operation: 'test' });

      const mediumErrors = errorHandler.getErrorsBySeverity('medium');
      const highErrors = errorHandler.getErrorsBySeverity('high');

      expect(mediumErrors).toHaveLength(1);
      expect(highErrors).toHaveLength(2);
    });
  });

  describe('clearResolvedErrors', () => {
    it('should clear only resolved errors', async () => {
      const networkError = new Error('network error'); // Will be resolved
      const databaseError = new Error('database error'); // Will not be resolved

      await errorHandler.handleError(networkError, { operation: 'getNotifications' });
      await errorHandler.handleError(databaseError, { operation: 'createNotification' });

      const clearedCount = errorHandler.clearResolvedErrors();

      expect(clearedCount).toBe(1); // Only network error should be cleared
      
      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(1); // Only database error should remain
    });
  });

  describe('clearAllErrors', () => {
    it('should clear all errors', async () => {
      await errorHandler.handleError(new Error('Error 1'), { operation: 'test1' });
      await errorHandler.handleError(new Error('Error 2'), { operation: 'test2' });
      await errorHandler.handleError(new Error('Error 3'), { operation: 'test3' });

      const clearedCount = errorHandler.clearAllErrors();

      expect(clearedCount).toBe(3);
      
      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(0);
    });
  });

  describe('shouldRetry', () => {
    it('should allow retries under the limit', () => {
      expect(errorHandler.shouldRetry('testOperation', 3)).toBe(true);
    });

    it('should prevent retries when limit is exceeded', async () => {
      // Add multiple recent errors for the same operation
      for (let i = 0; i < 4; i++) {
        await errorHandler.handleError(new Error(`Error ${i}`), { operation: 'testOperation' });
      }

      expect(errorHandler.shouldRetry('testOperation', 3)).toBe(false);
    });

    it('should only consider recent errors', async () => {
      // Add an old error (we'll mock the timestamp)
      await errorHandler.handleError(new Error('Old error'), { operation: 'testOperation' });
      
      // Mock the error to be older than 1 minute
      const recentErrors = errorHandler.getRecentErrors(1);
      if (recentErrors.length > 0) {
        recentErrors[0].timestamp = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      }

      expect(errorHandler.shouldRetry('testOperation', 3)).toBe(true);
    });
  });

  describe('error log management', () => {
    it('should remove oldest logs when limit is reached', async () => {
      // Mock MAX_ERROR_LOGS to a smaller value for testing
      const originalMaxLogs = (errorHandler as any).MAX_ERROR_LOGS;
      (errorHandler as any).MAX_ERROR_LOGS = 3;

      // Add more errors than the limit
      for (let i = 0; i < 5; i++) {
        await errorHandler.handleError(new Error(`Error ${i}`), { operation: 'test' });
      }

      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(3); // Should not exceed max

      // Restore original limit
      (errorHandler as any).MAX_ERROR_LOGS = originalMaxLogs;
    });
  });

  describe('recovery strategies', () => {
    it('should use specific strategy for known operations', async () => {
      const error = new Error('Test error');
      const context = { operation: 'getNotifications', userId: 'test-user' };

      await errorHandler.handleError(error, context);

      // getNotifications should have a recovery strategy that resolves to true
      const recentErrors = errorHandler.getRecentErrors(1);
      expect(recentErrors[0].resolved).toBe(true);
    });

    it('should handle unknown operations gracefully', async () => {
      const error = new Error('Test error');
      const context = { operation: 'unknownOperation' };

      // Should not throw error
      await expect(errorHandler.handleError(error, context)).resolves.not.toThrow();
    });
  });
});