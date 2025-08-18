import { gracefulDegradationService } from '../gracefulDegradationService';
import { vi } from 'vitest';

// Mock localStorage and sessionStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
});

describe('GracefulDegradationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gracefulDegradationService.clearAllCache();
  });

  describe('cacheData', () => {
    it('should cache data in all storage layers', () => {
      const testData = [{ id: 1, name: 'Test User' }];
      
      gracefulDegradationService.cacheData('test-key', testData);

      expect(sessionStorageMock.setItem).toHaveBeenCalledWith(
        'graceful_test-key',
        expect.stringContaining('"data":[{"id":1,"name":"Test User"}]')
      );
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'graceful_test-key',
        expect.stringContaining('"data":[{"id":1,"name":"Test User"}]')
      );
    });

    it('should handle storage errors gracefully', () => {
      const testData = [{ id: 1, name: 'Test User' }];
      sessionStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should not throw
      expect(() => {
        gracefulDegradationService.cacheData('test-key', testData);
      }).not.toThrow();
    });
  });

  describe('getCachedData', () => {
    it('should retrieve data from memory cache first', () => {
      const testData = [{ id: 1, name: 'Test User' }];
      
      // Cache data first
      gracefulDegradationService.cacheData('test-key', testData);
      
      // Retrieve should get from memory cache
      const cached = gracefulDegradationService.getCachedData('test-key');
      
      expect(cached).toBeTruthy();
      expect(cached?.data).toEqual(testData);
      
      // Should not call storage methods since memory cache is available
      expect(sessionStorageMock.getItem).not.toHaveBeenCalled();
      expect(localStorageMock.getItem).not.toHaveBeenCalled();
    });

    it('should fallback to session storage when memory cache is empty', () => {
      const testData = [{ id: 1, name: 'Test User' }];
      const cachedData = {
        data: testData,
        timestamp: Date.now(),
        version: '1.0.0'
      };

      sessionStorageMock.getItem.mockReturnValue(JSON.stringify(cachedData));
      
      const cached = gracefulDegradationService.getCachedData('test-key');
      
      expect(sessionStorageMock.getItem).toHaveBeenCalledWith('graceful_test-key');
      expect(cached?.data).toEqual(testData);
    });

    it('should fallback to local storage when session storage is empty', () => {
      const testData = [{ id: 1, name: 'Test User' }];
      const cachedData = {
        data: testData,
        timestamp: Date.now(),
        version: '1.0.0'
      };

      sessionStorageMock.getItem.mockReturnValue(null);
      localStorageMock.getItem.mockReturnValue(JSON.stringify(cachedData));
      
      const cached = gracefulDegradationService.getCachedData('test-key');
      
      expect(localStorageMock.getItem).toHaveBeenCalledWith('graceful_test-key');
      expect(cached?.data).toEqual(testData);
    });

    it('should return null when no valid cache is found', () => {
      sessionStorageMock.getItem.mockReturnValue(null);
      localStorageMock.getItem.mockReturnValue(null);
      
      const cached = gracefulDegradationService.getCachedData('nonexistent-key');
      
      expect(cached).toBeNull();
    });

    it('should reject expired cache data', () => {
      const expiredData = {
        data: [{ id: 1, name: 'Test User' }],
        timestamp: Date.now() - (31 * 60 * 1000), // 31 minutes ago (expired)
        version: '1.0.0'
      };

      sessionStorageMock.getItem.mockReturnValue(JSON.stringify(expiredData));
      
      const cached = gracefulDegradationService.getCachedData('test-key');
      
      expect(cached).toBeNull();
    });

    it('should reject cache data with wrong version', () => {
      const wrongVersionData = {
        data: [{ id: 1, name: 'Test User' }],
        timestamp: Date.now(),
        version: '0.9.0' // Wrong version
      };

      sessionStorageMock.getItem.mockReturnValue(JSON.stringify(wrongVersionData));
      
      const cached = gracefulDegradationService.getCachedData('test-key');
      
      expect(cached).toBeNull();
    });
  });

  describe('loadWithGracefulDegradation', () => {
    it('should return primary data when load succeeds', async () => {
      const testData = [{ id: 1, name: 'Test User' }];
      const primaryLoader = vi.fn().mockResolvedValue(testData);

      const result = await gracefulDegradationService.loadWithGracefulDegradation(
        'test-key',
        primaryLoader
      );

      expect(result.data).toEqual(testData);
      expect(result.isPartial).toBe(false);
      expect(result.missingFeatures).toEqual([]);
      expect(result.cacheSource).toBe('none');
    });

    it('should return cached data when primary load fails', async () => {
      const cachedData = [{ id: 1, name: 'Cached User' }];
      const primaryLoader = vi.fn().mockRejectedValue(new Error('Network error'));

      // Pre-cache some data
      gracefulDegradationService.cacheData('test-key', cachedData);

      const result = await gracefulDegradationService.loadWithGracefulDegradation(
        'test-key',
        primaryLoader,
        { enablePartialLoad: true }
      );

      expect(result.data).toEqual(cachedData);
      expect(result.isPartial).toBe(true);
      expect(result.missingFeatures).toContain('real-time-updates');
      expect(result.cacheSource).toBe('memory');
    });

    it('should limit partial data to maxPartialItems', async () => {
      const cachedData = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `User ${i}` }));
      const primaryLoader = jest.fn().mockRejectedValue(new Error('Network error'));

      gracefulDegradationService.cacheData('test-key', cachedData);

      const result = await gracefulDegradationService.loadWithGracefulDegradation(
        'test-key',
        primaryLoader,
        { 
          enablePartialLoad: true,
          maxPartialItems: 10
        }
      );

      expect(result.data).toHaveLength(10);
      expect(result.isPartial).toBe(true);
    });

    it('should determine missing features based on error type', async () => {
      const primaryLoader = vi.fn().mockRejectedValue(new Error('Database connection failed'));

      gracefulDegradationService.cacheData('test-key', []);

      const result = await gracefulDegradationService.loadWithGracefulDegradation(
        'test-key',
        primaryLoader,
        { enablePartialLoad: true }
      );

      expect(result.missingFeatures).toContain('data-persistence');
      expect(result.missingFeatures).toContain('create-operations');
    });

    it('should throw error when graceful degradation is disabled', async () => {
      const primaryLoader = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        gracefulDegradationService.loadWithGracefulDegradation(
          'test-key',
          primaryLoader,
          { enablePartialLoad: false }
        )
      ).rejects.toThrow('Network error');
    });

    it('should return empty data when no cache is available', async () => {
      const primaryLoader = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await gracefulDegradationService.loadWithGracefulDegradation(
        'nonexistent-key',
        primaryLoader,
        { enablePartialLoad: true }
      );

      expect(result.data).toEqual([]);
      expect(result.isPartial).toBe(true);
      expect(result.missingFeatures).toContain('data-loading');
      expect(result.cacheSource).toBe('none');
    });
  });

  describe('clearCache', () => {
    it('should clear cache for specific key', () => {
      gracefulDegradationService.clearCache('test-key');

      expect(sessionStorageMock.removeItem).toHaveBeenCalledWith('graceful_test-key');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('graceful_test-key');
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      // Mock storage keys
      Object.defineProperty(sessionStorage, 'length', { value: 2 });
      Object.keys = vi.fn()
        .mockReturnValueOnce(['graceful_key1', 'graceful_key2', 'other_key'])
        .mockReturnValueOnce(['graceful_key1', 'other_key']);

      sessionStorageMock.getItem.mockReturnValue('{"data":"test"}');
      localStorageMock.getItem.mockReturnValue('{"data":"test"}');

      const stats = gracefulDegradationService.getCacheStats();

      expect(stats.sessionItems).toBe(2);
      expect(stats.localItems).toBe(1);
      expect(stats.totalSize).toBeGreaterThan(0);
    });

    it('should handle errors in getting cache stats', () => {
      Object.keys = vi.fn().mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      const stats = gracefulDegradationService.getCacheStats();

      expect(stats.memoryItems).toBe(0);
      expect(stats.sessionItems).toBe(0);
      expect(stats.localItems).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });
});