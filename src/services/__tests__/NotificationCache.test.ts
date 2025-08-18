import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationCache } from '../NotificationCache';

describe('NotificationCache', () => {
  let cache: NotificationCache;

  beforeEach(() => {
    cache = new NotificationCache({
      maxSize: 5,
      defaultTTL: 1000, // 1 second for testing
      enableLRU: true,
      enableStats: true
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Basic Cache Operations', () => {
    it('should store and retrieve data', async () => {
      const testData = { id: '1', message: 'test' };
      await cache.set('test-key', testData);
      
      const retrieved = await cache.get('test-key');
      expect(retrieved).toEqual(testData);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should handle different data types', async () => {
      await cache.set('string', 'test string');
      await cache.set('number', 42);
      await cache.set('boolean', true);
      await cache.set('object', { key: 'value' });
      await cache.set('array', [1, 2, 3]);

      expect(await cache.get('string')).toBe('test string');
      expect(await cache.get('number')).toBe(42);
      expect(await cache.get('boolean')).toBe(true);
      expect(await cache.get('object')).toEqual({ key: 'value' });
      expect(await cache.get('array')).toEqual([1, 2, 3]);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', async () => {
      await cache.set('expiring-key', 'test data');
      
      // Data should be available immediately
      expect(await cache.get('expiring-key')).toBe('test data');
      
      // Fast forward time beyond TTL
      vi.advanceTimersByTime(1500);
      
      // Data should be expired
      expect(await cache.get('expiring-key')).toBeNull();
    });

    it('should use custom TTL when provided', async () => {
      await cache.set('custom-ttl', 'test data', 2000); // 2 seconds
      
      // Should still be available after default TTL
      vi.advanceTimersByTime(1500);
      expect(await cache.get('custom-ttl')).toBe('test data');
      
      // Should expire after custom TTL
      vi.advanceTimersByTime(1000);
      expect(await cache.get('custom-ttl')).toBeNull();
    });

    it('should not expire entries before TTL', async () => {
      await cache.set('not-expiring', 'test data');
      
      // Fast forward time but not beyond TTL
      vi.advanceTimersByTime(500);
      
      expect(await cache.get('not-expiring')).toBe('test data');
    });
  });

  describe('LRU Eviction', () => {
    it('should evict least recently used entries when cache is full', async () => {
      // Fill cache to capacity
      for (let i = 0; i < 5; i++) {
        await cache.set(`key-${i}`, `data-${i}`);
      }

      // Advance time to ensure different timestamps
      vi.advanceTimersByTime(10);

      // Access some entries to update their LRU status
      await cache.get('key-0'); // Make key-0 more recently used
      vi.advanceTimersByTime(10);
      await cache.get('key-1'); // Make key-1 more recently used
      vi.advanceTimersByTime(10);

      // Add one more entry to trigger eviction
      await cache.set('key-5', 'data-5');

      // key-2, key-3, or key-4 should be evicted (least recently used)
      // Since they weren't accessed, one of them will be evicted
      const evictedKeys = [];
      if (await cache.get('key-2') === null) evictedKeys.push('key-2');
      if (await cache.get('key-3') === null) evictedKeys.push('key-3');
      if (await cache.get('key-4') === null) evictedKeys.push('key-4');
      
      // Exactly one key should be evicted
      expect(evictedKeys.length).toBe(1);
      
      // Recently accessed entries should still be there
      expect(await cache.get('key-0')).toBe('data-0');
      expect(await cache.get('key-1')).toBe('data-1');
      expect(await cache.get('key-5')).toBe('data-5');
    });

    it('should update access count and timestamp on get', async () => {
      await cache.set('access-test', 'data');
      
      const initialMetadata = cache.getEntryMetadata('access-test');
      expect(initialMetadata?.accessCount).toBe(1);
      
      vi.advanceTimersByTime(100);
      await cache.get('access-test');
      
      const updatedMetadata = cache.getEntryMetadata('access-test');
      expect(updatedMetadata?.accessCount).toBe(2);
      expect(updatedMetadata?.lastAccessed).toBeGreaterThan(initialMetadata!.lastAccessed);
    });
  });

  describe('Cache Statistics', () => {
    it('should track hits and misses', async () => {
      await cache.set('hit-test', 'data');
      
      // Generate hits
      await cache.get('hit-test');
      await cache.get('hit-test');
      
      // Generate misses
      await cache.get('miss-1');
      await cache.get('miss-2');
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should track cache size', async () => {
      const initialStats = cache.getStats();
      expect(initialStats.size).toBe(0);
      
      await cache.set('size-test-1', 'data1');
      await cache.set('size-test-2', 'data2');
      
      const updatedStats = cache.getStats();
      expect(updatedStats.size).toBe(2);
    });

    it('should track evictions', async () => {
      // Create a fresh cache instance for this test
      const freshCache = new NotificationCache({
        maxSize: 3,
        defaultTTL: 1000,
        enableLRU: true,
        enableStats: true
      });
      
      // Fill cache to capacity
      await freshCache.set('key1', 'data1');
      await freshCache.set('key2', 'data2');
      await freshCache.set('key3', 'data3');
      
      expect(freshCache.getStats().size).toBe(3);
      expect(freshCache.getStats().evictions).toBe(0);
      
      // Add one more entry to trigger eviction
      await freshCache.set('key4', 'data4');
      
      const stats = freshCache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
      expect(stats.size).toBeLessThanOrEqual(3);
    });
  });

  describe('Pattern-based Invalidation', () => {
    it('should invalidate entries matching wildcard patterns', async () => {
      await cache.set('user:123:notifications', 'data1');
      await cache.set('user:123:unread-count', 'data2');
      await cache.set('user:456:notifications', 'data3');
      await cache.set('other:data', 'data4');
      
      await cache.invalidate('user:123:*');
      
      expect(await cache.get('user:123:notifications')).toBeNull();
      expect(await cache.get('user:123:unread-count')).toBeNull();
      expect(await cache.get('user:456:notifications')).toBe('data3');
      expect(await cache.get('other:data')).toBe('data4');
    });

    it('should handle complex patterns', async () => {
      await cache.set('notifications:user1:recent', 'data1');
      await cache.set('notifications:user2:recent', 'data2');
      await cache.set('preferences:user1:settings', 'data3');
      
      await cache.invalidate('notifications:*:recent');
      
      expect(await cache.get('notifications:user1:recent')).toBeNull();
      expect(await cache.get('notifications:user2:recent')).toBeNull();
      expect(await cache.get('preferences:user1:settings')).toBe('data3');
    });

    it('should handle exact match patterns', async () => {
      await cache.set('exact:match', 'data1');
      await cache.set('exact:match:extended', 'data2');
      
      await cache.invalidate('exact:match');
      
      expect(await cache.get('exact:match')).toBeNull();
      expect(await cache.get('exact:match:extended')).toBe('data2');
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate consistent keys for notifications', () => {
      const key1 = NotificationCache.generateKey('notifications', 'user123');
      const key2 = NotificationCache.generateKey('notifications', 'user123');
      
      expect(key1).toBe(key2);
      expect(key1).toBe('notifications:user123');
    });

    it('should generate keys with parameters', () => {
      const key = NotificationCache.generateKey('notifications', 'user123', {
        limit: 20,
        unread: true
      });
      
      expect(key).toBe('notifications:user123:limit=20&unread=true');
    });

    it('should sort parameters for consistent keys', () => {
      const key1 = NotificationCache.generateKey('notifications', 'user123', {
        unread: true,
        limit: 20
      });
      
      const key2 = NotificationCache.generateKey('notifications', 'user123', {
        limit: 20,
        unread: true
      });
      
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different types', () => {
      const notificationKey = NotificationCache.generateKey('notifications', 'user123');
      const countKey = NotificationCache.generateKey('unread-count', 'user123');
      const prefKey = NotificationCache.generateKey('preferences', 'user123');
      
      expect(notificationKey).toBe('notifications:user123');
      expect(countKey).toBe('unread-count:user123');
      expect(prefKey).toBe('preferences:user123');
    });
  });

  describe('Smart Invalidation', () => {
    it('should invalidate appropriate patterns for create events', async () => {
      await cache.set('notifications:user123:recent', 'data1');
      await cache.set('notifications:user123:all', 'data2');
      await cache.set('unread-count:user123', 5);
      await cache.set('notifications:user456:recent', 'data3');
      
      await cache.invalidateForNotificationEvent('user123', 'create');
      
      expect(await cache.get('notifications:user123:recent')).toBeNull();
      expect(await cache.get('notifications:user123:all')).toBeNull();
      expect(await cache.get('unread-count:user123')).toBeNull();
      expect(await cache.get('notifications:user456:recent')).toBe('data3');
    });

    it('should invalidate specific notification for update events', async () => {
      await cache.set('notification:notif123:details', 'data1');
      await cache.set('notifications:user123:all', 'data2');
      await cache.set('notification:notif456:details', 'data3');
      
      await cache.invalidateForNotificationEvent('user123', 'update', 'notif123');
      
      expect(await cache.get('notification:notif123:details')).toBeNull();
      expect(await cache.get('notifications:user123:all')).toBeNull();
      expect(await cache.get('notification:notif456:details')).toBe('data3');
    });

    it('should handle delete events properly', async () => {
      await cache.set('notification:notif123:details', 'data1');
      await cache.set('notifications:user123:all', 'data2');
      await cache.set('unread-count:user123', 5);
      
      await cache.invalidateForNotificationEvent('user123', 'delete', 'notif123');
      
      expect(await cache.get('notification:notif123:details')).toBeNull();
      expect(await cache.get('notifications:user123:all')).toBeNull();
      expect(await cache.get('unread-count:user123')).toBeNull();
    });
  });

  describe('Cache Warming and Preloading', () => {
    it('should warm cache with provided data loader', async () => {
      const mockDataLoader = vi.fn().mockImplementation((key: string) => {
        if (key.includes('notifications')) return Promise.resolve([{ id: '1' }]);
        if (key.includes('unread-count')) return Promise.resolve(5);
        if (key.includes('preferences')) return Promise.resolve({ theme: 'dark' });
        return Promise.resolve(null);
      });

      await cache.warmCache('user123', mockDataLoader);

      expect(mockDataLoader).toHaveBeenCalledTimes(4); // 4 warming keys
      
      // Check that data was cached
      const notifications = await cache.get('notifications:user123:limit=20&unread=true');
      const count = await cache.get('unread-count:user123');
      const preferences = await cache.get('preferences:user123');
      
      expect(notifications).toEqual([{ id: '1' }]);
      expect(count).toBe(5);
      expect(preferences).toEqual({ theme: 'dark' });
    });

    it('should handle data loader errors gracefully', async () => {
      const mockDataLoader = vi.fn().mockRejectedValue(new Error('Data loading failed'));
      
      // Should not throw
      await expect(cache.warmCache('user123', mockDataLoader)).resolves.toBeUndefined();
    });

    it('should preload frequent data only if not cached', async () => {
      // Pre-populate one key with the exact key that will be generated
      await cache.set('notifications:user123:limit=10&recent=true', 'existing-data');
      
      const mockDataLoader = vi.fn().mockResolvedValue('new-data');
      
      await cache.preloadFrequentData('user123', mockDataLoader);
      
      // Should not have loaded data for the pre-existing key
      expect(await cache.get('notifications:user123:limit=10&recent=true')).toBe('existing-data');
      
      // Should have loaded data for other keys (2 out of 3 keys)
      expect(mockDataLoader).toHaveBeenCalledTimes(2); // Only for non-cached keys
    });
  });

  describe('Cache Cleanup', () => {
    it('should clean up expired entries', async () => {
      await cache.set('expire-1', 'data1', 500);
      await cache.set('expire-2', 'data2', 1500);
      await cache.set('no-expire', 'data3', 2000);
      
      // Fast forward past first expiry
      vi.advanceTimersByTime(1000);
      
      const cleanedCount = await cache.cleanup();
      
      expect(cleanedCount).toBe(1);
      expect(await cache.get('expire-1')).toBeNull();
      expect(await cache.get('expire-2')).toBe('data2');
      expect(await cache.get('no-expire')).toBe('data3');
    });

    it('should return 0 when no entries need cleanup', async () => {
      await cache.set('no-cleanup', 'data', 2000);
      
      const cleanedCount = await cache.cleanup();
      
      expect(cleanedCount).toBe(0);
      expect(await cache.get('no-cleanup')).toBe('data');
    });
  });

  describe('Clear Cache', () => {
    it('should clear all entries', async () => {
      await cache.set('key1', 'data1');
      await cache.set('key2', 'data2');
      await cache.set('key3', 'data3');
      
      expect(cache.getStats().size).toBe(3);
      
      await cache.clear();
      
      expect(cache.getStats().size).toBe(0);
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(await cache.get('key3')).toBeNull();
    });

    it('should update eviction stats when clearing', async () => {
      await cache.set('key1', 'data1');
      await cache.set('key2', 'data2');
      
      const statsBefore = cache.getStats();
      await cache.clear();
      const statsAfter = cache.getStats();
      
      expect(statsAfter.evictions).toBe(statsBefore.evictions + 2);
    });
  });

  describe('Entry Metadata', () => {
    it('should return entry metadata', async () => {
      await cache.set('metadata-test', 'data');
      
      const metadata = cache.getEntryMetadata('metadata-test');
      
      expect(metadata).toBeDefined();
      expect(metadata?.accessCount).toBe(1);
      expect(metadata?.ttl).toBe(1000);
      expect(typeof metadata?.timestamp).toBe('number');
      expect(typeof metadata?.lastAccessed).toBe('number');
    });

    it('should return null for non-existent entries', () => {
      const metadata = cache.getEntryMetadata('non-existent');
      expect(metadata).toBeNull();
    });

    it('should not include data in metadata', async () => {
      await cache.set('metadata-test', { sensitive: 'data' });
      
      const metadata = cache.getEntryMetadata('metadata-test');
      
      expect(metadata).not.toHaveProperty('data');
    });
  });

  describe('Cache Warming Intervals', () => {
    it('should set up and stop cache warming intervals', async () => {
      const mockDataLoader = vi.fn().mockResolvedValue('data');
      
      // Set up warming
      cache.setupCacheWarming('user123', mockDataLoader, 100);
      
      // Fast forward to trigger warming
      vi.advanceTimersByTime(150);
      
      expect(mockDataLoader).toHaveBeenCalled();
      
      // Stop warming
      cache.stopCacheWarming('user123');
      
      // Reset mock and advance time
      mockDataLoader.mockClear();
      vi.advanceTimersByTime(150);
      
      // Should not be called after stopping
      expect(mockDataLoader).not.toHaveBeenCalled();
    });

    it('should replace existing warming interval', async () => {
      const mockDataLoader1 = vi.fn().mockResolvedValue('data1');
      const mockDataLoader2 = vi.fn().mockResolvedValue('data2');
      
      // Set up first warming
      cache.setupCacheWarming('user123', mockDataLoader1, 100);
      
      // Replace with second warming
      cache.setupCacheWarming('user123', mockDataLoader2, 100);
      
      // Fast forward
      vi.advanceTimersByTime(150);
      
      // Only second loader should be called
      expect(mockDataLoader1).not.toHaveBeenCalled();
      expect(mockDataLoader2).toHaveBeenCalled();
    });
  });
});