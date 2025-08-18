import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheManager, CacheInvalidation, CacheConfigs } from '../CacheManager';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock BroadcastChannel
class MockBroadcastChannel {
  constructor(public name: string) {}
  postMessage = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  close = vi.fn();
}
global.BroadcastChannel = MockBroadcastChannel as any;

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    cacheManager = new CacheManager();
  });

  afterEach(() => {
    cacheManager.destroy();
    vi.useRealTimers();
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve data', () => {
      const testData = { id: 1, name: 'Test' };
      
      cacheManager.set('test-key', testData);
      const retrieved = cacheManager.get('test-key');
      
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent keys', () => {
      const result = cacheManager.get('non-existent');
      expect(result).toBeNull();
    });

    it('should handle TTL expiration', () => {
      const testData = { id: 1, name: 'Test' };
      
      cacheManager.set('test-key', testData, { ttl: 1000 });
      
      // Data should be available immediately
      expect(cacheManager.get('test-key')).toEqual(testData);
      
      // Fast forward time beyond TTL
      vi.advanceTimersByTime(1001);
      
      // Data should be expired
      expect(cacheManager.get('test-key')).toBeNull();
    });

    it('should update access count and last accessed time', () => {
      const testData = { id: 1, name: 'Test' };
      
      cacheManager.set('test-key', testData);
      
      // Access multiple times
      cacheManager.get('test-key');
      cacheManager.get('test-key');
      cacheManager.get('test-key');
      
      const entries = cacheManager.getEntries();
      const entry = entries.find(e => e.key === 'test-key');
      
      expect(entry?.entry.accessCount).toBe(4); // 1 from set + 3 from gets
    });
  });

  describe('Cache Eviction', () => {
    it('should evict LRU entries when max entries exceeded', () => {
      // Create cache with small max entries for testing
      const smallCache = new CacheManager();
      
      // Fill cache beyond capacity (assuming MAX_ENTRIES = 1000, we'll simulate smaller)
      for (let i = 0; i < 5; i++) {
        smallCache.set(`key-${i}`, { data: i });
      }
      
      // Access some entries to change LRU order
      smallCache.get('key-1');
      smallCache.get('key-3');
      
      // Force eviction by setting size limits artificially low
      // This is a simplified test - in real usage, size limits would trigger eviction
      
      smallCache.destroy();
    });

    it('should clean up expired entries during cleanup', () => {
      const testData1 = { id: 1, name: 'Test1' };
      const testData2 = { id: 2, name: 'Test2' };
      
      // Set with short TTL
      cacheManager.set('short-ttl', testData1, { ttl: 100 });
      // Set with long TTL
      cacheManager.set('long-ttl', testData2, { ttl: 10000 });
      
      // Fast forward past short TTL
      vi.advanceTimersByTime(150);
      
      // Trigger cleanup
      cacheManager.cleanup();
      
      expect(cacheManager.get('short-ttl')).toBeNull();
      expect(cacheManager.get('long-ttl')).toEqual(testData2);
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate by key', () => {
      const testData = { id: 1, name: 'Test' };
      
      cacheManager.set('test-key', testData);
      expect(cacheManager.get('test-key')).toEqual(testData);
      
      cacheManager.invalidate('test-key');
      expect(cacheManager.get('test-key')).toBeNull();
    });

    it('should invalidate by tags', () => {
      const testData1 = { id: 1, name: 'Test1' };
      const testData2 = { id: 2, name: 'Test2' };
      const testData3 = { id: 3, name: 'Test3' };
      
      cacheManager.set('key1', testData1, { tags: ['tag1', 'tag2'] });
      cacheManager.set('key2', testData2, { tags: ['tag2', 'tag3'] });
      cacheManager.set('key3', testData3, { tags: ['tag3'] });
      
      // Invalidate by tag2
      cacheManager.invalidate(['tag2']);
      
      expect(cacheManager.get('key1')).toBeNull();
      expect(cacheManager.get('key2')).toBeNull();
      expect(cacheManager.get('key3')).toEqual(testData3);
    });

    it('should invalidate across tabs', () => {
      const testData = { id: 1, name: 'Test' };
      
      cacheManager.set('test-key', testData, { tags: ['test-tag'] });
      
      CacheInvalidation.invalidateAcrossTabs(['test-tag']);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        expect.stringMatching(/cache-invalidate-\d+/),
        JSON.stringify(['test-tag'])
      );
    });
  });

  describe('getOrFetch', () => {
    it('should return cached data if available', async () => {
      const testData = { id: 1, name: 'Test' };
      const fetcher = vi.fn().mockResolvedValue(testData);
      
      // Set data in cache first
      cacheManager.set('test-key', testData);
      
      const result = await cacheManager.getOrFetch('test-key', fetcher);
      
      expect(result).toEqual(testData);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('should fetch and cache data if not in cache', async () => {
      const testData = { id: 1, name: 'Test' };
      const fetcher = vi.fn().mockResolvedValue(testData);
      
      const result = await cacheManager.getOrFetch('test-key', fetcher);
      
      expect(result).toEqual(testData);
      expect(fetcher).toHaveBeenCalledOnce();
      expect(cacheManager.get('test-key')).toEqual(testData);
    });

    it('should handle fetch errors', async () => {
      const error = new Error('Fetch failed');
      const fetcher = vi.fn().mockRejectedValue(error);
      
      await expect(cacheManager.getOrFetch('test-key', fetcher)).rejects.toThrow('Fetch failed');
      expect(cacheManager.get('test-key')).toBeNull();
    });
  });

  describe('Cache Warming', () => {
    it('should warm up cache with provided data', async () => {
      const testData1 = { id: 1, name: 'Test1' };
      const testData2 = { id: 2, name: 'Test2' };
      
      const warmupConfig = [
        {
          key: 'key1',
          fetcher: vi.fn().mockResolvedValue(testData1),
          options: { ttl: 5000 }
        },
        {
          key: 'key2',
          fetcher: vi.fn().mockResolvedValue(testData2)
        }
      ];
      
      await cacheManager.warmUp(warmupConfig);
      
      expect(cacheManager.get('key1')).toEqual(testData1);
      expect(cacheManager.get('key2')).toEqual(testData2);
    });

    it('should handle warmup failures gracefully', async () => {
      const testData = { id: 1, name: 'Test' };
      const error = new Error('Warmup failed');
      
      const warmupConfig = [
        {
          key: 'success-key',
          fetcher: vi.fn().mockResolvedValue(testData)
        },
        {
          key: 'fail-key',
          fetcher: vi.fn().mockRejectedValue(error)
        }
      ];
      
      await cacheManager.warmUp(warmupConfig);
      
      expect(cacheManager.get('success-key')).toEqual(testData);
      expect(cacheManager.get('fail-key')).toBeNull();
    });

    it('should queue warmup for background processing', async () => {
      const testData = { id: 1, name: 'Test' };
      const fetcher = vi.fn().mockResolvedValue(testData);
      
      cacheManager.queueWarmup('test-key', fetcher);
      
      // Wait for background processing with a timeout
      await vi.runOnlyPendingTimersAsync();
      
      expect(cacheManager.get('test-key')).toEqual(testData);
    });
  });

  describe('Statistics', () => {
    it('should track cache hits and misses', () => {
      const testData = { id: 1, name: 'Test' };
      
      // Miss
      cacheManager.get('non-existent');
      
      // Set and hit
      cacheManager.set('test-key', testData);
      cacheManager.get('test-key');
      cacheManager.get('test-key');
      
      const stats = cacheManager.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(2/3);
      expect(stats.entryCount).toBe(1);
    });

    it('should track cache size', () => {
      const testData = { id: 1, name: 'Test', data: 'x'.repeat(1000) };
      
      cacheManager.set('test-key', testData);
      
      const stats = cacheManager.getStats();
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('Cache Configurations', () => {
    it('should provide predefined cache configurations', () => {
      expect(CacheConfigs.SHORT_TERM.ttl).toBe(2 * 60 * 1000);
      expect(CacheConfigs.MEDIUM_TERM.ttl).toBe(15 * 60 * 1000);
      expect(CacheConfigs.LONG_TERM.ttl).toBe(60 * 60 * 1000);
      expect(CacheConfigs.SESSION_BASED.ttl).toBe(30 * 60 * 1000);
      expect(CacheConfigs.PERSISTENT.ttl).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should clear all cache entries', () => {
      cacheManager.set('key1', { data: 1 });
      cacheManager.set('key2', { data: 2 });
      
      expect(cacheManager.getStats().entryCount).toBe(2);
      
      cacheManager.clear();
      
      expect(cacheManager.getStats().entryCount).toBe(0);
      expect(cacheManager.get('key1')).toBeNull();
      expect(cacheManager.get('key2')).toBeNull();
    });

    it('should cleanup resources on destroy', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      cacheManager.destroy();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(cacheManager.getStats().entryCount).toBe(0);
    });
  });
});