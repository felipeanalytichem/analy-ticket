import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheManager } from '../CacheManager';

describe('CacheManager Performance Tests', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    vi.useFakeTimers();
    cacheManager = new CacheManager();
  });

  afterEach(() => {
    cacheManager.destroy();
    vi.useRealTimers();
  });

  describe('Performance Benchmarks', () => {
    it('should handle large number of cache entries efficiently', () => {
      const startTime = performance.now();
      const entryCount = 1000; // Reduced for faster testing

      // Set many entries
      for (let i = 0; i < entryCount; i++) {
        cacheManager.set(`key-${i}`, { id: i, data: `data-${i}` });
      }

      const setTime = performance.now() - startTime;
      expect(setTime).toBeLessThan(1000); // Should complete in less than 1 second

      // Get many entries
      const getStartTime = performance.now();
      for (let i = 0; i < entryCount; i++) {
        cacheManager.get(`key-${i}`);
      }

      const getTime = performance.now() - getStartTime;
      expect(getTime).toBeLessThan(500); // Should complete in less than 0.5 seconds

      expect(cacheManager.getStats().entryCount).toBe(entryCount);
    });

    it('should handle large data objects efficiently', () => {
      const largeData = {
        id: 1,
        content: 'x'.repeat(10000), // 10KB string (reduced)
        metadata: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item-${i}` }))
      };

      const startTime = performance.now();
      
      cacheManager.set('large-data', largeData);
      const retrieved = cacheManager.get('large-data');
      
      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // Should complete in less than 100ms
      expect(retrieved).toEqual(largeData);
    });

    it('should perform LRU eviction efficiently', () => {
      // Fill cache with many entries
      for (let i = 0; i < 1000; i++) {
        cacheManager.set(`key-${i}`, { id: i, data: `data-${i}` });
      }

      // Access some entries to change LRU order
      for (let i = 500; i < 600; i++) {
        cacheManager.get(`key-${i}`);
      }

      const startTime = performance.now();
      
      // Force eviction by adding more entries
      for (let i = 1000; i < 1100; i++) {
        cacheManager.set(`key-${i}`, { id: i, data: `data-${i}` });
      }

      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(200); // Eviction should be fast
    });

    it('should handle concurrent cache operations', async () => {
      const concurrentOperations = 100;
      const promises: Promise<any>[] = [];

      const startTime = performance.now();

      // Create concurrent set operations
      for (let i = 0; i < concurrentOperations; i++) {
        promises.push(
          Promise.resolve().then(() => {
            cacheManager.set(`concurrent-${i}`, { id: i, data: `data-${i}` });
            return cacheManager.get(`concurrent-${i}`);
          })
        );
      }

      const results = await Promise.all(promises);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should handle concurrency efficiently
      expect(results).toHaveLength(concurrentOperations);
      results.forEach((result, index) => {
        expect(result).toEqual({ id: index, data: `data-${index}` });
      });
    });

    it('should handle frequent cache invalidation efficiently', () => {
      // Set up cache with tagged entries
      for (let i = 0; i < 1000; i++) {
        const tags = [`tag-${i % 10}`, `category-${i % 5}`];
        cacheManager.set(`key-${i}`, { id: i }, { tags });
      }

      const startTime = performance.now();

      // Perform multiple invalidations
      for (let i = 0; i < 10; i++) {
        cacheManager.invalidate([`tag-${i}`]);
      }

      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // Invalidation should be fast
    });

    it('should handle cache cleanup efficiently', () => {
      // Set entries with various TTLs
      for (let i = 0; i < 1000; i++) {
        const ttl = i % 2 === 0 ? 100 : 10000; // Half will expire quickly
        cacheManager.set(`key-${i}`, { id: i }, { ttl });
      }

      // Fast forward to expire half the entries
      vi.advanceTimersByTime(150);

      const startTime = performance.now();
      cacheManager.cleanup();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // Cleanup should be fast
      expect(cacheManager.getStats().entryCount).toBeLessThan(1000);
    });
  });

  describe('Memory Usage', () => {
    it('should track memory usage accurately', () => {
      const testData = {
        id: 1,
        content: 'x'.repeat(10000), // 10KB string
        array: Array.from({ length: 100 }, (_, i) => i)
      };

      cacheManager.set('memory-test', testData);
      
      const stats = cacheManager.getStats();
      expect(stats.totalSize).toBeGreaterThan(10000); // Should track significant size
    });

    it('should handle memory pressure gracefully', () => {
      const largeData = 'x'.repeat(1000000); // 1MB string

      // Try to set many large entries
      for (let i = 0; i < 100; i++) {
        cacheManager.set(`large-${i}`, { id: i, data: largeData });
      }

      const stats = cacheManager.getStats();
      
      // Should have evicted entries to stay within limits
      expect(stats.entryCount).toBeLessThan(100);
      expect(stats.evictions).toBeGreaterThan(0);
    });
  });

  describe('Cache Warming Performance', () => {
    it('should warm up cache efficiently', async () => {
      const warmupCount = 100;
      const warmupConfig = Array.from({ length: warmupCount }, (_, i) => ({
        key: `warmup-${i}`,
        fetcher: () => Promise.resolve({ id: i, data: `data-${i}` }),
        options: { ttl: 60000 }
      }));

      const startTime = performance.now();
      await cacheManager.warmUp(warmupConfig);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete warmup quickly
      expect(cacheManager.getStats().entryCount).toBe(warmupCount);
    });

    it('should handle background warmup queue efficiently', async () => {
      const queueCount = 50;

      const startTime = performance.now();

      // Queue many warmup items
      for (let i = 0; i < queueCount; i++) {
        cacheManager.queueWarmup(
          `queue-${i}`,
          () => Promise.resolve({ id: i, data: `data-${i}` })
        );
      }

      // Wait for background processing
      await vi.runAllTimersAsync();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(500); // Should process queue efficiently
      expect(cacheManager.getStats().entryCount).toBe(queueCount);
    });
  });

  describe('Stress Tests', () => {
    it('should handle rapid cache operations without degradation', () => {
      const operationCount = 1000; // Reduced for faster testing
      const startTime = performance.now();

      // Perform rapid mixed operations
      for (let i = 0; i < operationCount; i++) {
        const operation = i % 4;
        
        switch (operation) {
          case 0: // Set
            cacheManager.set(`stress-${i}`, { id: i });
            break;
          case 1: // Get
            cacheManager.get(`stress-${i - 1}`);
            break;
          case 2: // Invalidate
            if (i > 10) cacheManager.invalidate(`stress-${i - 10}`);
            break;
          case 3: // Get stats
            cacheManager.getStats();
            break;
        }
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should handle stress efficiently
    });

    it('should maintain performance with high hit rate', () => {
      // Pre-populate cache
      for (let i = 0; i < 100; i++) {
        cacheManager.set(`popular-${i}`, { id: i, data: `data-${i}` });
      }

      const startTime = performance.now();
      
      // Perform many gets (high hit rate scenario)
      for (let i = 0; i < 1000; i++) { // Reduced for faster testing
        cacheManager.get(`popular-${i % 100}`);
      }

      const endTime = performance.now();
      
      expect(endTime - startTime).toBeLessThan(100); // High hit rate should be very fast
      
      const stats = cacheManager.getStats();
      expect(stats.hitRate).toBeGreaterThan(0.9); // Should have high hit rate
    });
  });

  describe('Resource Management', () => {
    it('should clean up resources properly on destroy', () => {
      // Set up cache with data and timers
      for (let i = 0; i < 100; i++) {
        cacheManager.set(`cleanup-${i}`, { id: i });
      }

      const initialStats = cacheManager.getStats();
      expect(initialStats.entryCount).toBe(100);

      const startTime = performance.now();
      cacheManager.destroy();
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // Cleanup should be fast
      
      const finalStats = cacheManager.getStats();
      expect(finalStats.entryCount).toBe(0);
      expect(finalStats.totalSize).toBe(0);
    });

    it('should handle timer cleanup efficiently', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      // Create and destroy multiple cache managers
      const managers = Array.from({ length: 10 }, () => new CacheManager());
      
      const startTime = performance.now();
      managers.forEach(manager => manager.destroy());
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(50); // Should cleanup timers quickly
      expect(clearIntervalSpy).toHaveBeenCalledTimes(10);
    });
  });
});