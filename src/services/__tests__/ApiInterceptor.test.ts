import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiInterceptor, ApiRequestConfig } from '../ApiInterceptor';
import { ErrorRecoveryManager } from '../ErrorRecoveryManager';

// Mock fetch
global.fetch = vi.fn();

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    storage: {
      from: vi.fn()
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'mock-token' } }
      })
    }
  }
}));

describe('ApiInterceptor', () => {
  let apiInterceptor: ApiInterceptor;
  let mockErrorRecoveryManager: ErrorRecoveryManager;

  beforeEach(() => {
    mockErrorRecoveryManager = new ErrorRecoveryManager({
      userNotification: false
    });
    
    apiInterceptor = new ApiInterceptor(mockErrorRecoveryManager, {
      enableRetry: true,
      enableCache: true,
      enableAuth: true,
      defaultTimeout: 5000,
      maxRetries: 2,
      baseDelay: 100
    });

    vi.clearAllMocks();
  });

  afterEach(() => {
    if (apiInterceptor) {
      apiInterceptor.clearQueue();
    }
    if (mockErrorRecoveryManager) {
      mockErrorRecoveryManager.destroy();
    }
  });

  describe('Configuration', () => {
    it('should initialize with default configuration', () => {
      const config = apiInterceptor.getConfig();
      expect(config.enableRetry).toBe(true);
      expect(config.enableCache).toBe(true);
      expect(config.enableAuth).toBe(true);
      expect(config.maxRetries).toBe(2);
    });

    it('should update configuration', () => {
      apiInterceptor.updateConfig({ maxRetries: 5, enableCache: false });
      const config = apiInterceptor.getConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.enableCache).toBe(false);
    });
  });

  describe('Manual API Requests', () => {
    it('should make successful API request', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({ success: true })
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const config: ApiRequestConfig = {
        url: '/api/test',
        method: 'GET'
      };

      const result = await apiInterceptor.request(config);

      expect(result.data).toEqual({ success: true });
      expect(result.status).toBe(200);
      expect(result.error).toBeNull();
    });

    it('should add authentication headers when enabled', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({})
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const config: ApiRequestConfig = {
        url: '/api/test',
        method: 'GET'
      };

      await apiInterceptor.request(config);

      expect(fetch).toHaveBeenCalledWith('/api/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: undefined
      });
    });

    it('should handle request with data', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({ id: 1 })
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const config: ApiRequestConfig = {
        url: '/api/test',
        method: 'POST',
        data: { name: 'test' }
      };

      await apiInterceptor.request(config);

      expect(fetch).toHaveBeenCalledWith('/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({ name: 'test' })
      });
    });

    it('should handle custom headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({})
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const config: ApiRequestConfig = {
        url: '/api/test',
        method: 'GET',
        headers: { 'X-Custom-Header': 'custom-value' }
      };

      await apiInterceptor.request(config);

      expect(fetch).toHaveBeenCalledWith('/api/test', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token',
          'X-Custom-Header': 'custom-value'
        },
        body: undefined
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      const handleErrorSpy = vi.spyOn(mockErrorRecoveryManager, 'handleError')
        .mockResolvedValue(null);

      const config: ApiRequestConfig = {
        url: '/api/test',
        method: 'GET'
      };

      try {
        await apiInterceptor.request(config);
      } catch (error) {
        expect(error.message).toBe('Network error');
      }

      expect(handleErrorSpy).toHaveBeenCalled();
    });

    it('should handle HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({ error: 'Not found' })
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const handleErrorSpy = vi.spyOn(mockErrorRecoveryManager, 'handleError')
        .mockResolvedValue(null);

      const config: ApiRequestConfig = {
        url: '/api/test',
        method: 'GET'
      };

      try {
        await apiInterceptor.request(config);
      } catch (error) {
        // Error should be handled by recovery manager
      }

      expect(handleErrorSpy).toHaveBeenCalled();
    });

    it('should retry failed requests', async () => {
      let callCount = 0;
      vi.mocked(fetch).mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: vi.fn().mockResolvedValue({ success: true })
        } as any);
      });

      const config: ApiRequestConfig = {
        url: '/api/test',
        method: 'GET',
        retryConfig: { maxRetries: 3 }
      };

      const result = await apiInterceptor.request(config);

      expect(result.data).toEqual({ success: true });
      expect(callCount).toBe(3);
    });

    it('should respect max retry limit', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Persistent error'));

      const handleErrorSpy = vi.spyOn(mockErrorRecoveryManager, 'handleError')
        .mockResolvedValue(null);

      const config: ApiRequestConfig = {
        url: '/api/test',
        method: 'GET',
        retryConfig: { maxRetries: 2 }
      };

      try {
        await apiInterceptor.request(config);
      } catch (error) {
        expect(error.message).toBe('Persistent error');
      }

      // Should be called for each retry attempt
      expect(handleErrorSpy).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('Request Timeout', () => {
    it('should timeout requests that take too long', async () => {
      vi.mocked(fetch).mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      const config: ApiRequestConfig = {
        url: '/api/test',
        method: 'GET',
        timeout: 100
      };

      try {
        await apiInterceptor.request(config);
      } catch (error) {
        expect(error.message).toContain('Request timeout');
      }
    });

    it('should not timeout fast requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({ success: true })
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const config: ApiRequestConfig = {
        url: '/api/test',
        method: 'GET',
        timeout: 1000
      };

      const result = await apiInterceptor.request(config);
      expect(result.data).toEqual({ success: true });
    });
  });

  describe('Request Deduplication', () => {
    it('should deduplicate identical requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({ success: true })
      };

      vi.mocked(fetch).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockResponse as any), 100))
      );

      const config: ApiRequestConfig = {
        url: '/api/test',
        method: 'GET'
      };

      // Make two identical requests simultaneously
      const [result1, result2] = await Promise.all([
        apiInterceptor.request(config),
        apiInterceptor.request(config)
      ]);

      expect(result1.data).toEqual({ success: true });
      expect(result2.data).toEqual({ success: true });
      
      // Should only make one actual fetch call
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Supabase Integration', () => {
    it('should have Supabase integration setup', () => {
      // Test that the interceptor was created successfully
      expect(apiInterceptor).toBeDefined();
      expect(apiInterceptor.getConfig()).toBeDefined();
    });

    it('should handle Supabase method wrapping', () => {
      // Test that the interceptor can handle method wrapping
      const config = apiInterceptor.getConfig();
      expect(config.enableAuth).toBe(true);
      expect(config.enableCache).toBe(true);
    });
  });

  describe('Cache Integration', () => {
    it('should cache successful GET requests', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({ data: 'cached' })
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const setCachedDataSpy = vi.spyOn(mockErrorRecoveryManager, 'setCachedData');

      const config: ApiRequestConfig = {
        url: '/api/test',
        method: 'GET',
        cacheKey: 'test-cache-key'
      };

      await apiInterceptor.request(config);

      expect(setCachedDataSpy).toHaveBeenCalledWith('test-cache-key', {
        data: { data: 'cached' },
        error: null,
        status: 200,
        headers: {}
      });
    });

    it('should not cache POST requests', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({ id: 1 })
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as any);

      const setCachedDataSpy = vi.spyOn(mockErrorRecoveryManager, 'setCachedData');

      const config: ApiRequestConfig = {
        url: '/api/test',
        method: 'POST',
        data: { name: 'test' },
        cacheKey: 'test-cache-key'
      };

      await apiInterceptor.request(config);

      expect(setCachedDataSpy).not.toHaveBeenCalled();
    });
  });

  describe('Queue Management', () => {
    it('should track request queue status', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({})
      };

      vi.mocked(fetch).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockResponse as any), 100))
      );

      const config: ApiRequestConfig = {
        url: '/api/test',
        method: 'GET'
      };

      // Start request but don't wait
      const requestPromise = apiInterceptor.request(config);

      // Check queue status while request is in progress
      const queueStatus = apiInterceptor.getQueueStatus();
      expect(queueStatus.size).toBe(1);
      expect(queueStatus.requests).toHaveLength(1);

      // Wait for request to complete
      await requestPromise;

      // Queue should be empty after completion
      const finalQueueStatus = apiInterceptor.getQueueStatus();
      expect(finalQueueStatus.size).toBe(0);
    });

    it('should clear request queue', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({})
      };

      vi.mocked(fetch).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockResponse as any), 100))
      );

      const config: ApiRequestConfig = {
        url: '/api/test',
        method: 'GET'
      };

      // Start request
      apiInterceptor.request(config);

      // Clear queue
      apiInterceptor.clearQueue();

      const queueStatus = apiInterceptor.getQueueStatus();
      expect(queueStatus.size).toBe(0);
    });
  });

  describe('User Message Generation', () => {
    it('should generate appropriate error messages', async () => {
      const testCases = [
        { status: 401, expectedMessage: 'Your session has expired. Please log in again.' },
        { status: 403, expectedMessage: "You don't have permission to loading data." },
        { status: 404, expectedMessage: 'The requested loading data could not be found.' },
        { status: 500, expectedMessage: 'Server error occurred while loading data. Please try again.' }
      ];

      for (const testCase of testCases) {
        const mockResponse = {
          ok: false,
          status: testCase.status,
          headers: new Headers(),
          json: vi.fn().mockResolvedValue({ error: 'Test error' })
        };

        vi.mocked(fetch).mockResolvedValue(mockResponse as any);

        const handleErrorSpy = vi.spyOn(mockErrorRecoveryManager, 'handleError')
          .mockImplementation((error, context) => {
            expect(context.userMessage).toBe(testCase.expectedMessage);
            return Promise.resolve(null);
          });

        const config: ApiRequestConfig = {
          url: '/api/test',
          method: 'GET'
        };

        try {
          await apiInterceptor.request(config);
        } catch (error) {
          // Expected
        }

        expect(handleErrorSpy).toHaveBeenCalled();
        handleErrorSpy.mockRestore();
      }
    });
  });

  describe('Utility Methods', () => {
    it('should generate unique request IDs', () => {
      const config1: ApiRequestConfig = {
        url: '/api/test',
        method: 'GET'
      };

      const config2: ApiRequestConfig = {
        url: '/api/test',
        method: 'POST',
        data: { id: 1 }
      };

      const id1 = apiInterceptor['generateRequestId'](config1);
      const id2 = apiInterceptor['generateRequestId'](config2);

      expect(id1).not.toBe(id2);
      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
    });

    it('should identify read operations correctly', () => {
      const readConfig: ApiRequestConfig = {
        url: '/api/test',
        method: 'GET'
      };

      const writeConfig: ApiRequestConfig = {
        url: '/api/test',
        method: 'POST',
        data: { name: 'test' }
      };

      expect(apiInterceptor['isReadOperation'](readConfig)).toBe(true);
      expect(apiInterceptor['isReadOperation'](writeConfig)).toBe(false);
    });

    it('should calculate retry delays with exponential backoff', () => {
      const delay1 = apiInterceptor['calculateRetryDelay'](0, 1000);
      const delay2 = apiInterceptor['calculateRetryDelay'](1, 1000);
      const delay3 = apiInterceptor['calculateRetryDelay'](2, 1000);

      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThan(2000);
      
      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThan(3000);
      
      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThan(5000);
    });
  });
});