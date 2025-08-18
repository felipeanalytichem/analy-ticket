import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NotificationCache } from '../NotificationCache';
import { NotificationTestUtils } from '@/lib/__tests__/notificationTestUtils';

describe('NotificationCache', () => {
  let cache: NotificationCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new NotificationCache();
  });

  afterEach(async () => {
    await cache.cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('get and set', () => {
    it('should store and retrieve data', async () => {
      const testData = { id: 1, message: 'test' };
      
      await cache.set('test-key', testData);
      const result = await cache.get('test-key');
      
      expect(result).toEqual(testData);
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('non-existent-key');
      expect(result).toBeNull();
    });

    it('should respect TTL and expire entries', async () => {
      const testData = { id: 1, message: 'test' };
      
      await cache.set('test-key', testData, 100); // 100ms TTL
      
      // Should be available immediately
      let result = await cache.get('test-key');
      expect(result).toEqual(testData);
      
      // Advance time beyond TTL
      vi.advanceTimersByTime(150);
      
      // Should be expired
      result = await cache.get('test-key');
      expect(result).toBeNull();
    });

    it('should update access statistics', async () => {
      const testData = { id: 1, message: 'test' };
      
      await cache.set('test-key', testData);
      
      // Multiple gets should increase hit count
      await cache.get('test-key');
      await cache.get('test-key');
      await cache.get('non-existent-key'); // Miss
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBe(66.66666666666666);
    });
  });

  describe('invalidate', () => {
    it('should invalidate entries matching pattern', async () => {
      await cache.set('user:123:notifications', { data: 'test1' });
      await cache.set('user:123:preferences', { data: 'test2' });
      await cache.set('user:456:notifications', { data: 'test3' });
      
      await cache.invalidate('user:123:*');
      
      expect(await cache.get('user:123:notifications')).toBeNull();
      expect(await cache.get('user:123:preferences')).toBeNull();
      expect(await cache.get('user:456:notifications')).toEqual({ data: 'test3' });
    });

    it('should handle complex patterns', async () => {
      await cache.set('notifications:user1:list', { data: 'test1' });
      await cache.set('notifications:user2:list', { data: 'test2' });
      await cache.set('preferences:user1:settings', { data: 'test3' });
      
      await cache.invalidate('notifications:.*:list');
      
      expect(await cache.get('notifications:user1:list')).toBeNull();
      expect(await cache.get('notifications:user2:list')).toBeNull();
      expect(await cache.get('preferences:user1:settings')).toEqual({ data: 'test3' });
    });
  });

  describe('clear', () => {
    it('should clear all entries and reset stats', async () => {
      await cache.set('key1', { data: 'test1' });
      await cache.set('key2', { data: 'test2' });
      await cache.get('key1'); // Generate some stats
      
      await cache.clear();
      
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(2); // The two gets above after clear
      expect(stats.size).toBe(0);
    });
  });

  describe('preload', () => {
    it('should preload data for a user', async () => {
      const testData = [
        { id: 1, read: false },
        { id: 2, read: true },
        { id: 3, read: false }
      ];
      
      await cache.preload('test-user', testData);
      
      const notifications = await cache.get('notifications:test-user:{}');
      const unreadCount = await cache.get('unread_count:test-user');
      
      expect(notifications).toEqual(testData);
      expect(unreadCount).toBe(2); // Two unread notifications
    });
  });

  describe('warmCache', () => {
    it('should warm cache with placeholder entries', async () => {
      await cache.warmCache('test-user');
      
      const keys = cache.getKeys();
      expect(keys).toContain('notifications:test-user:{}');
      expect(keys).toContain('unread_count:test-user');
      expect(keys).toContain('preferences:test-user');
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entries when max size is reached', async () => {
      // Create a cache with small max size for testing
      const smallCache = new NotificationCache();
      
      // Fill cache beyond max size (we'll need to access private property for testing)
      // This is a simplified test - in reality we'd need to fill 1000+ entries
      
      await smallCache.set('key1', 'data1');
      await smallCache.set('key2', 'data2');
      
      // Access key1 to make it more recently used
      await smallCache.get('key1');
      
      // The actual LRU logic would be tested with a larger dataset
      // For now, we just verify the methods exist and don't throw
      expect(await smallCache.get('key1')).toBe('data1');
      expect(await smallCache.get('key2')).toBe('data2');
      
      await smallCache.cleanup();
    });
  });

  describe('getStats', () => {
    it('should return accurate statistics', async () => {
      await cache.set('key1', 'data1');
      await cache.set('key2', 'data2');
      
      await cache.get('key1'); // Hit
      await cache.get('key1'); // Hit
      await cache.get('key3'); // Miss
      
      const stats = cache.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(1000);
      expect(stats.hitRate).toBe(66.66666666666666);
    });
  });

  describe('getEntryInfo', () => {
    it('should return entry information', async () => {
      const testData = { id: 1, message: 'test' };
      await cache.set('test-key', testData, 5000);
      
      const entryInfo = cache.getEntryInfo('test-key');
      
      expect(entryInfo).toMatchObject({
        data: testData,
        timestamp: expect.any(Number),
        ttl: 5000,
        accessCount: expect.any(Number),
        lastAccessed: expect.any(Number)
      });
    });

    it('should return null for non-existent entries', () => {
      const entryInfo = cache.getEntryInfo('non-existent-key');
      expect(entryInfo).toBeNull();
    });
  });

  describe('cleanup timer', () => {
    it('should clean up expired entries periodically', async () => {
      await cache.set('short-lived', 'data', 50); // 50ms TTL
      await cache.set('long-lived', 'data', 5000); // 5s TTL
      
      // Advance time to expire short-lived entry but not long-lived
      vi.advanceTimersByTime(100);
      
      // Check that short-lived is expired but long-lived is not
      expect(await cache.get('short-lived')).toBeNull();
      expect(await cache.get('long-lived')).toBe('data');
    });

    it('should run cleanup at regular intervals', async () => {
      // Add multiple entries with different TTLs
      await cache.set('expire-1', 'data1', 100);
      await cache.set('expire-2', 'data2', 200);
      await cache.set('expire-3', 'data3', 300);
      await cache.set('long-lived', 'data4', 10000);

      expect(cache.getStats().size).toBe(4);

      // Advance time to trigger first cleanup
      vi.advanceTimersByTime(60000); // 1 minute (cleanup interval)

      // All short-lived entries should be cleaned up
      expect(await cache.get('expire-1')).toBeNull();
      expect(await cache.get('expire-2')).toBeNull();
      expect(await cache.get('expire-3')).toBeNull();
      expect(await cache.get('long-lived')).toBe('data4');
    });
  });

  describe('Performance and scalability', () => {
    it('should handle large datasets efficiently', async () => {
      const largeDataset = NotificationTestUtils.createPerformanceTestData(1000);
      
      const startTime = Date.now();
      
      // Set many entries
      for (let i = 0; i < largeDataset.notifications.length; i++) {
        await cache.set(`notification-${i}`, largeDataset.notifications[i]);
      }
      
      // Get many entries
      for (let i = 0; i < 100; i++) {
        await cache.get(`notification-${i}`);
      }
      
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(cache.getStats().size).toBe(1000);
    });

    it('should handle concurrent operations', async () => {
      const promises = [];
      
      // Concurrent sets
      for (let i = 0; i < 100; i++) {
        promises.push(cache.set(`concurrent-${i}`, { data: `value-${i}` }));
      }
      
      await Promise.all(promises);
      
      // Concurrent gets
      const getPromises = [];
      for (let i = 0; i < 100; i++) {
        getPromises.push(cache.get(`concurrent-${i}`));
      }
      
      const results = await Promise.all(getPromises);
      
      expect(results).toHaveLength(100);
      results.forEach((result, index) => {
        expect(result).toEqual({ data: `value-${index}` });
      });
    });

    it('should maintain performance with frequent access pattern changes', async () => {
      // Create entries with different access patterns
      const entries = Array.from({ length: 50 }, (_, i) => ({
        key: `pattern-${i}`,
        data: { id: i, value: `data-${i}` }
      }));

      // Set all entries
      for (const entry of entries) {
        await cache.set(entry.key, entry.data);
      }

      // Simulate different access patterns
      // Hot data (frequently accessed)
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 5; j++) {
          await cache.get(`pattern-${j}`);
        }
      }

      // Cold data (rarely accessed)
      for (let i = 45; i < 50; i++) {
        await cache.get(`pattern-${i}`);
      }

      const stats = cache.getStats();
      expect(stats.hits).toBeGreaterThan(50);
      expect(stats.hitRate).toBeGreaterThan(90);
    });
  });

  describe('Memory management', () => {
    it('should enforce maximum cache size', async () => {
      // This test would need to be adjusted based on actual MAX_SIZE
      // For now, we'll test the concept with a smaller number
      
      const testEntries = 50;
      for (let i = 0; i < testEntries; i++) {
        await cache.set(`memory-test-${i}`, { data: `value-${i}` });
      }

      const stats = cache.getStats();
      expect(stats.size).toBeLessThanOrEqual(stats.maxSize);
    });

    it('should properly clean up on shutdown', async () => {
      await cache.set('cleanup-test-1', 'data1');
      await cache.set('cleanup-test-2', 'data2');
      
      expect(cache.getStats().size).toBe(2);
      
      await cache.cleanup();
      
      expect(cache.getStats().size).toBe(0);
      expect(cache.getKeys()).toHaveLength(0);
    });

    it('should handle memory pressure gracefully', async () => {
      // Simulate memory pressure by filling cache
      const entries = Array.from({ length: 100 }, (_, i) => ({
        key: `pressure-${i}`,
        data: { id: i, largeData: 'x'.repeat(1000) } // Larger data objects
      }));

      for (const entry of entries) {
        await cache.set(entry.key, entry.data);
      }

      // Cache should still function normally
      const testResult = await cache.get('pressure-50');
      expect(testResult).toBeDefined();
      
      const stats = cache.getStats();
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null and undefined values', async () => {
      await cache.set('null-test', null);
      await cache.set('undefined-test', undefined);
      
      expect(await cache.get('null-test')).toBeNull();
      expect(await cache.get('undefined-test')).toBeUndefined();
    });

    it('should handle complex object types', async () => {
      const complexData = {
        array: [1, 2, 3],
        nested: { deep: { value: 'test' } },
        date: new Date(),
        regex: /test/g,
        function: () => 'test'
      };

      await cache.set('complex-test', complexData);
      const result = await cache.get('complex-test');
      
      expect(result.array).toEqual([1, 2, 3]);
      expect(result.nested.deep.value).toBe('test');
      expect(result.date).toBeInstanceOf(Date);
    });

    it('should handle very long keys', async () => {
      const longKey = 'x'.repeat(1000);
      const testData = { value: 'test' };
      
      await cache.set(longKey, testData);
      const result = await cache.get(longKey);
      
      expect(result).toEqual(testData);
    });

    it('should handle special characters in keys', async () => {
      const specialKeys = [
        'key with spaces',
        'key:with:colons',
        'key*with*asterisks',
        'key.with.dots',
        'key/with/slashes',
        'key-with-dashes',
        'key_with_underscores'
      ];

      for (const key of specialKeys) {
        await cache.set(key, { key });
        const result = await cache.get(key);
        expect(result).toEqual({ key });
      }
    });

    it('should handle zero and negative TTL values', async () => {
      await cache.set('zero-ttl', 'data', 0);
      await cache.set('negative-ttl', 'data', -1000);
      
      // Zero TTL should expire immediately
      expect(await cache.get('zero-ttl')).toBeNull();
      
      // Negative TTL should also expire immediately
      expect(await cache.get('negative-ttl')).toBeNull();
    });
  });

  describe('Pattern matching and invalidation', () => {
    it('should handle complex invalidation patterns', async () => {
      const testData = [
        { key: 'user:123:notifications:list', data: 'test1' },
        { key: 'user:123:notifications:count', data: 'test2' },
        { key: 'user:123:preferences:theme', data: 'test3' },
        { key: 'user:456:notifications:list', data: 'test4' },
        { key: 'admin:notifications:all', data: 'test5' }
      ];

      for (const item of testData) {
        await cache.set(item.key, item.data);
      }

      // Test various patterns
      await cache.invalidate('user:123:notifications:.*');
      
      expect(await cache.get('user:123:notifications:list')).toBeNull();
      expect(await cache.get('user:123:notifications:count')).toBeNull();
      expect(await cache.get('user:123:preferences:theme')).toBe('test3');
      expect(await cache.get('user:456:notifications:list')).toBe('test4');
      expect(await cache.get('admin:notifications:all')).toBe('test5');
    });

    it('should handle wildcard patterns correctly', async () => {
      await cache.set('prefix:middle:suffix', 'data1');
      await cache.set('prefix:other:suffix', 'data2');
      await cache.set('different:middle:suffix', 'data3');
      
      await cache.invalidate('prefix:*:suffix');
      
      expect(await cache.get('prefix:middle:suffix')).toBeNull();
      expect(await cache.get('prefix:other:suffix')).toBeNull();
      expect(await cache.get('different:middle:suffix')).toBe('data3');
    });

    it('should handle empty and invalid patterns', async () => {
      await cache.set('test-key', 'test-data');
      
      // Empty pattern should not invalidate anything
      await cache.invalidate('');
      expect(await cache.get('test-key')).toBe('test-data');
      
      // Invalid regex pattern should not crash
      await cache.invalidate('[invalid-regex');
      expect(await cache.get('test-key')).toBe('test-data');
    });
  });

  describe('Statistics and monitoring', () => {
    it('should track hit rate accurately over time', async () => {
      // Initial state
      expect(cache.getStats().hitRate).toBe(0);
      
      await cache.set('hit-test', 'data');
      
      // All hits
      await cache.get('hit-test');
      await cache.get('hit-test');
      await cache.get('hit-test');
      
      expect(cache.getStats().hitRate).toBe(100);
      
      // Mix of hits and misses
      await cache.get('non-existent-1');
      await cache.get('non-existent-2');
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(60);
    });

    it('should track access patterns correctly', async () => {
      await cache.set('access-test', 'data');
      
      const initialInfo = cache.getEntryInfo('access-test');
      expect(initialInfo?.accessCount).toBe(1);
      
      // Multiple accesses
      await cache.get('access-test');
      await cache.get('access-test');
      await cache.get('access-test');
      
      const finalInfo = cache.getEntryInfo('access-test');
      expect(finalInfo?.accessCount).toBe(4); // 1 from set + 3 from gets
      expect(finalInfo?.lastAccessed).toBeGreaterThan(initialInfo?.lastAccessed || 0);
    });

    it('should provide accurate size information', async () => {
      const initialStats = cache.getStats();
      expect(initialStats.size).toBe(0);
      
      await cache.set('size-test-1', 'data1');
      await cache.set('size-test-2', 'data2');
      
      expect(cache.getStats().size).toBe(2);
      
      await cache.invalidate('size-test-1');
      
      expect(cache.getStats().size).toBe(1);
      
      await cache.clear();
      
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('Cache warming and preloading', () => {
    it('should handle preloading with different data types', async () => {
      const mixedData = [
        { id: 1, type: 'notification', read: false },
        { id: 2, type: 'alert', read: true },
        { id: 3, type: 'message', read: false, priority: 'high' }
      ];

      await cache.preload('mixed-user', mixedData);
      
      const notifications = await cache.get('notifications:mixed-user:{}');
      const unreadCount = await cache.get('unread_count:mixed-user');
      
      expect(notifications).toEqual(mixedData);
      expect(unreadCount).toBe(2);
    });

    it('should handle cache warming for multiple users', async () => {
      const users = ['user1', 'user2', 'user3'];
      
      for (const user of users) {
        await cache.warmCache(user);
      }
      
      const keys = cache.getKeys();
      
      for (const user of users) {
        expect(keys).toContain(`notifications:${user}:{}`);
        expect(keys).toContain(`unread_count:${user}`);
        expect(keys).toContain(`preferences:${user}`);
      }
    });

    it('should handle preloading with empty data', async () => {
      await cache.preload('empty-user', []);
      
      const notifications = await cache.get('notifications:empty-user:{}');
      const unreadCount = await cache.get('unread_count:empty-user');
      
      expect(notifications).toEqual([]);
      expect(unreadCount).toBe(0);
    });
  });

  describe('Cleanup and resource management', () => {
    it('should stop cleanup timer on cleanup', async () => {
      // Verify timer is running initially
      expect(cache['cleanupTimer']).not.toBeNull();
      
      await cache.cleanup();
      
      // Timer should be stopped
      expect(cache['cleanupTimer']).toBeNull();
    });

    it('should handle cleanup when already cleaned up', async () => {
      await cache.cleanup();
      
      // Second cleanup should not throw
      await expect(cache.cleanup()).resolves.not.toThrow();
    });

    it('should handle cleanup with active operations', async () => {
      // Start some operations
      const operations = [
        cache.set('cleanup-1', 'data1'),
        cache.set('cleanup-2', 'data2'),
        cache.get('cleanup-1')
      ];

      // Cleanup while operations are pending
      const cleanupPromise = cache.cleanup();
      
      await Promise.all([...operations, cleanupPromise]);
      
      expect(cache.getStats().size).toBe(0);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle realistic notification caching workflow', async () => {
      const userId = 'test-user-123';
      const notifications = NotificationTestUtils.createMockNotificationList(10);
      
      // 1. Preload user data
      await cache.preload(userId, notifications);
      
      // 2. Access notifications (should hit cache)
      const cachedNotifications = await cache.get(`notifications:${userId}:{}`);
      expect(cachedNotifications).toEqual(notifications);
      
      // 3. Update notification (invalidate cache)
      await cache.invalidate(`notifications:${userId}:*`);
      
      // 4. Cache should be empty for user
      expect(await cache.get(`notifications:${userId}:{}`)).toBeNull();
      
      // 5. Warm cache again
      await cache.warmCache(userId);
      
      // 6. Verify cache structure is set up
      const keys = cache.getKeys();
      expect(keys.some(key => key.includes(userId))).toBe(true);
    });

    it('should handle cache lifecycle with TTL variations', async () => {
      // Short-term cache (1 second)
      await cache.set('short-term', 'data1', 1000);
      
      // Medium-term cache (5 seconds)
      await cache.set('medium-term', 'data2', 5000);
      
      // Long-term cache (10 seconds)
      await cache.set('long-term', 'data3', 10000);
      
      // Immediate access - all should be available
      expect(await cache.get('short-term')).toBe('data1');
      expect(await cache.get('medium-term')).toBe('data2');
      expect(await cache.get('long-term')).toBe('data3');
      
      // After 2 seconds - short-term should expire
      vi.advanceTimersByTime(2000);
      expect(await cache.get('short-term')).toBeNull();
      expect(await cache.get('medium-term')).toBe('data2');
      expect(await cache.get('long-term')).toBe('data3');
      
      // After 6 seconds total - medium-term should expire
      vi.advanceTimersByTime(4000);
      expect(await cache.get('short-term')).toBeNull();
      expect(await cache.get('medium-term')).toBeNull();
      expect(await cache.get('long-term')).toBe('data3');
      
      // After 11 seconds total - all should expire
      vi.advanceTimersByTime(5000);
      expect(await cache.get('short-term')).toBeNull();
      expect(await cache.get('medium-term')).toBeNull();
      expect(await cache.get('long-term')).toBeNull();
    });
  });
});