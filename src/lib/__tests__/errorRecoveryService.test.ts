import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorRecoveryService, ErrorType } from '../errorRecoveryService';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    supabaseUrl: 'https://test.supabase.co',
    supabaseKey: 'test-key',
    auth: {
      refreshSession: vi.fn()
    }
  }
}));

// Mock fetch
global.fetch = vi.fn();

describe('ErrorRecoveryService', () => {
  let errorRecoveryService: ErrorRecoveryService;

  beforeEach(() => {
    vi.clearAllMocks();
    errorRecoveryService = ErrorRecoveryService.getInstance();
    errorRecoveryService.clearErrorLog();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Classification', () => {
    it('should classify network errors correctly', async () => {
      const networkError = new Error('Network connection failed');
      
      const result = await errorRecoveryService.executeWithRetry(
        async () => {
          throw networkError;
        },
        { test: 'network' },
        { maxRetries: 0 } // Don't retry for this test
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(networkError);
      
      const errorLog = errorRecoveryService.getErrorLog();
      expect(errorLog).toHaveLength(1);
      expect(errorLog[0].type).toBe(ErrorType.NETWORK);
    });

    it('should classify authentication errors correctly', async () => {
      const authError = new Error('Invalid token provided');
      
      const result = await errorRecoveryService.executeWithRetry(
        async () => {
          throw authError;
        },
        { test: 'auth' },
        { maxRetries: 0 }
      );

      expect(result.success).toBe(false);
      
      const errorLog = errorRecoveryService.getErrorLog();
      expect(errorLog[0].type).toBe(ErrorType.AUTHENTICATION);
    });

    it('should classify database errors correctly', async () => {
      const dbError = new Error('Database query failed');
      
      const result = await errorRecoveryService.executeWithRetry(
        async () => {
          throw dbError;
        },
        { test: 'database' },
        { maxRetries: 0 }
      );

      expect(result.success).toBe(false);
      
      const errorLog = errorRecoveryService.getErrorLog();
      expect(errorLog[0].type).toBe(ErrorType.DATABASE);
    });

    it('should classify timeout errors correctly', async () => {
      const timeoutError = new Error('Request timed out');
      
      const result = await errorRecoveryService.executeWithRetry(
        async () => {
          throw timeoutError;
        },
        { test: 'timeout' },
        { maxRetries: 0 }
      );

      expect(result.success).toBe(false);
      
      const errorLog = errorRecoveryService.getErrorLog();
      expect(errorLog[0].type).toBe(ErrorType.TIMEOUT);
    });
  });

  describe('Retry Logic', () => {
    it('should retry retryable errors', async () => {
      let attempts = 0;
      const networkError = new Error('Network connection failed');
      
      const result = await errorRecoveryService.executeWithRetry(
        async () => {
          attempts++;
          if (attempts < 3) {
            throw networkError;
          }
          return 'success';
        },
        { test: 'retry' },
        { maxRetries: 3, baseDelay: 10 } // Fast retry for testing
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(3);
      expect(attempts).toBe(3);
    });

    it('should not retry non-retryable errors', async () => {
      let attempts = 0;
      const validationError = new Error('Validation failed');
      
      const result = await errorRecoveryService.executeWithRetry(
        async () => {
          attempts++;
          throw validationError;
        },
        { test: 'no-retry' },
        { maxRetries: 3 }
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(attempts).toBe(1);
    });

    it('should respect max retry limit', async () => {
      let attempts = 0;
      const networkError = new Error('Network connection failed');
      
      const result = await errorRecoveryService.executeWithRetry(
        async () => {
          attempts++;
          throw networkError;
        },
        { test: 'max-retry' },
        { maxRetries: 2, baseDelay: 10 }
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3); // maxRetries + 1
      expect(attempts).toBe(3);
    });

    it('should calculate exponential backoff correctly', async () => {
      const delays: number[] = [];
      let attempts = 0;
      
      // Mock setTimeout to capture delays
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = vi.fn((callback, delay) => {
        delays.push(delay);
        return originalSetTimeout(callback, 0); // Execute immediately for testing
      }) as any;

      const networkError = new Error('Network connection failed');
      
      await errorRecoveryService.executeWithRetry(
        async () => {
          attempts++;
          throw networkError;
        },
        { test: 'backoff' },
        { maxRetries: 3, baseDelay: 100, backoffMultiplier: 2 }
      );

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;

      expect(delays).toHaveLength(3);
      expect(delays[0]).toBe(100); // First retry: 100ms
      expect(delays[1]).toBe(200); // Second retry: 200ms
      expect(delays[2]).toBe(400); // Third retry: 400ms
    });
  });

  describe('Authentication Token Refresh', () => {
    it('should attempt token refresh for authentication errors', async () => {
      const { supabase } = require('@/integrations/supabase/client');
      supabase.auth.refreshSession.mockResolvedValue({
        data: { session: { access_token: 'new-token' } },
        error: null
      });

      let attempts = 0;
      const authError = new Error('Invalid token provided');
      
      const result = await errorRecoveryService.executeWithRetry(
        async () => {
          attempts++;
          if (attempts === 1) {
            throw authError;
          }
          return 'success after refresh';
        },
        { test: 'token-refresh' },
        { maxRetries: 1, baseDelay: 10 }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBe('success after refresh');
      expect(result.recoveryActions).toContain('token_refreshed');
      expect(supabase.auth.refreshSession).toHaveBeenCalled();
    });

    it('should handle token refresh failure', async () => {
      const { supabase } = require('@/integrations/supabase/client');
      supabase.auth.refreshSession.mockResolvedValue({
        data: null,
        error: new Error('Refresh failed')
      });

      const authError = new Error('Invalid token provided');
      
      const result = await errorRecoveryService.executeWithRetry(
        async () => {
          throw authError;
        },
        { test: 'token-refresh-fail' },
        { maxRetries: 1, baseDelay: 10 }
      );

      expect(result.success).toBe(false);
      expect(result.recoveryActions).toContain('token_refresh_failed');
    });
  });

  describe('Connectivity Testing', () => {
    it('should test connectivity successfully', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValue({
        ok: true
      } as Response);

      const isConnected = await errorRecoveryService.testConnectivity();
      
      expect(isConnected).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://test.supabase.co/rest/v1/',
        expect.objectContaining({
          method: 'HEAD',
          headers: expect.objectContaining({
            'apikey': 'test-key'
          })
        })
      );
    });

    it('should handle connectivity test failure', async () => {
      const mockFetch = vi.mocked(fetch);
      mockFetch.mockRejectedValue(new Error('Network error'));

      const isConnected = await errorRecoveryService.testConnectivity();
      
      expect(isConnected).toBe(false);
    });
  });

  describe('Error Logging and Statistics', () => {
    it('should log errors with detailed information', async () => {
      const testError = new Error('Test error');
      
      await errorRecoveryService.executeWithRetry(
        async () => {
          throw testError;
        },
        { operation: 'test', userId: '123' },
        { maxRetries: 0 }
      );

      const errorLog = errorRecoveryService.getErrorLog();
      expect(errorLog).toHaveLength(1);
      
      const logEntry = errorLog[0];
      expect(logEntry.message).toBe('Test error');
      expect(logEntry.context.operation).toBe('test');
      expect(logEntry.context.userId).toBe('123');
      expect(logEntry.timestamp).toBeDefined();
      expect(logEntry.userAgent).toBeDefined();
      expect(logEntry.url).toBeDefined();
    });

    it('should provide error statistics', async () => {
      // Generate some errors
      await errorRecoveryService.executeWithRetry(
        async () => { throw new Error('Network error'); },
        {},
        { maxRetries: 0 }
      );
      
      await errorRecoveryService.executeWithRetry(
        async () => { throw new Error('Database query failed'); },
        {},
        { maxRetries: 0 }
      );

      const stats = errorRecoveryService.getErrorStats();
      
      expect(stats.totalErrors).toBe(2);
      expect(stats.errorsByType[ErrorType.NETWORK]).toBe(1);
      expect(stats.errorsByType[ErrorType.DATABASE]).toBe(1);
      expect(stats.sessionId).toBeDefined();
    });

    it('should limit error log size', async () => {
      // Generate more than 100 errors
      for (let i = 0; i < 105; i++) {
        await errorRecoveryService.executeWithRetry(
          async () => { throw new Error(`Error ${i}`); },
          {},
          { maxRetries: 0 }
        );
      }

      const errorLog = errorRecoveryService.getErrorLog();
      expect(errorLog).toHaveLength(100); // Should be limited to 100
    });

    it('should clear error log', async () => {
      await errorRecoveryService.executeWithRetry(
        async () => { throw new Error('Test error'); },
        {},
        { maxRetries: 0 }
      );

      expect(errorRecoveryService.getErrorLog()).toHaveLength(1);
      
      errorRecoveryService.clearErrorLog();
      
      expect(errorRecoveryService.getErrorLog()).toHaveLength(0);
    });
  });

  describe('Custom Configuration', () => {
    it('should use custom retry configuration', async () => {
      let attempts = 0;
      
      const result = await errorRecoveryService.executeWithRetry(
        async () => {
          attempts++;
          throw new Error('Network error');
        },
        { test: 'custom-config' },
        {
          maxRetries: 5,
          baseDelay: 50,
          maxDelay: 1000,
          backoffMultiplier: 3
        }
      );

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(6); // maxRetries + 1
      expect(attempts).toBe(6);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ErrorRecoveryService.getInstance();
      const instance2 = ErrorRecoveryService.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });
});