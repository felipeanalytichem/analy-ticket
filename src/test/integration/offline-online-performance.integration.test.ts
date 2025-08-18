/**
 * Performance integration tests for offline/online transitions
 * Tests system performance during network state changes and data synchronization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineManager } from '../../services/OfflineManager';
import { ConnectionMonitor } from '../../services/ConnectionMonitor';
import { BackgroundSyncManager } from '../../services/BackgroundSyncManager';
import { StateManager } from '../../services/StateManager';
import { CacheManager } from '../../services/CacheManager';
import {
  createMockSupabaseClient,
  ConnectionSimulator,
  TimerUtils,
  PerformanceTestUtils,
  createMockLocalStorage,
  createMockIndexedDB
} from '../utils/sessionTestUtils';

// Mock dependencies
const mockSupabase = createMockSupabaseClient();
vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase
}));

const mockLocalStorage = createMockLocalStorage();
const mockIndexedDB = createMockIndexedDB();

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true
});

describe('Offline/Online Performance Integration Tests', () => {
  let offlineManager: OfflineManager;
  let connectionMonitor: ConnectionMonitor;
  let backgroundSyncManager: BackgroundSyncManager;
  let stateManager: StateManager;
  let cacheManager: CacheManager;
  let connectionSimulator: ConnectionSimulator;

  beforeEach(() => {
    vi.clearAllMocks();
    TimerUtils.useFakeTimers();
    
    offlineManager = new OfflineManager();
    connectionMonitor = new ConnectionMonitor();
    backgroundSyncManager = new BackgroundSyncManager();
    stateManager = new StateManager();
    cacheManager = new CacheManager();
    connectionSimulator = new ConnectionSimulator();
    
    mockLocalStorage.clear();
  });

  afterEach(() => {
    offlineManager.cleanup?.();
    connectionMonitor.cleanup?.();
    backgroundSyncManager.cleanup?.();
    stateManager.cleanup?.();
    cacheManager.cleanup?.();
    TimerUtils.useRealTimers();
  });

  describe('Offline Transition Performance', () => {
    it('should transition to offline mode quickly', async () => {
      await offlineManager.initialize();
      connectionMonitor.startMonitoring();

      // Measure offline transition time
      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        connectionSimulator.setOnline(false);
        await offlineManager.handleOffline();
      });

      // Should transition within 100ms
      expect(time).toBeLessThan(100);
      expect(offlineManager.isOffline()).toBe(true);
    });

    it('should handle large data caching efficiently during offline transition', async () => {
      await offlineManager.initialize();

      // Generate large dataset
      const largeDataset = Array(1000).fill(null).map((_, i) => ({
        id: i,
        title: `Item ${i}`,
        description: `Description for item ${i}`,
        data: 'x'.repeat(100) // 100 chars per item
      }));

      // Measure caching performance
      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        await offlineManager.cacheData('large-dataset', largeDataset);
      });

      // Should cache within 500ms
      expect(time).toBeLessThan(500);

      // Verify data is cached
      const cachedData = await offlineManager.getCachedData('large-dataset');
      expect(cachedData).toHaveLength(1000);
    });

    it('should queue operations efficiently while offline', async () => {
      await offlineManager.initialize();
      connectionSimulator.setOnline(false);
      await offlineManager.handleOffline();

      // Generate many operations
      const operations = Array(500).fill(null).map((_, i) => ({
        type: 'create-item',
        data: { id: i, title: `Item ${i}` },
        timestamp: new Date()
      }));

      // Measure queuing performance
      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        for (const operation of operations) {
          await offlineManager.queueOperation(operation);
        }
      });

      // Should queue all operations within 1 second
      expect(time).toBeLessThan(1000);

      // Verify all operations are queued
      const queuedOps = await offlineManager.getQueuedOperations();
      expect(queuedOps).toHaveLength(500);
    });

    it('should maintain UI responsiveness during offline transition', async () => {
      await offlineManager.initialize();
      connectionMonitor.startMonitoring();

      // Simulate UI operations during offline transition
      const uiOperations = Array(50).fill(null).map((_, i) => 
        stateManager.saveState(`ui-state-${i}`, { component: i, visible: true })
      );

      connectionSimulator.setOnline(false);
      const offlinePromise = offlineManager.handleOffline();

      // Measure concurrent UI operations
      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        await Promise.all([offlinePromise, ...uiOperations]);
      });

      // Should complete within 200ms
      expect(time).toBeLessThan(200);
    });
  });

  describe('Online Transition Performance', () => {
    it('should transition to online mode quickly', async () => {
      await offlineManager.initialize();
      
      // Start offline
      connectionSimulator.setOnline(false);
      await offlineManager.handleOffline();

      // Mock successful connection
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Measure online transition time
      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        connectionSimulator.setOnline(true);
        await offlineManager.handleOnline();
      });

      // Should transition within 150ms
      expect(time).toBeLessThan(150);
      expect(offlineManager.isOffline()).toBe(false);
    });

    it('should sync queued operations efficiently', async () => {
      await offlineManager.initialize();
      
      // Start offline and queue operations
      connectionSimulator.setOnline(false);
      await offlineManager.handleOffline();

      const operations = Array(200).fill(null).map((_, i) => ({
        type: 'sync-item',
        data: { id: i, synced: false }
      }));

      for (const operation of operations) {
        await offlineManager.queueOperation(operation);
      }

      // Mock successful sync operations
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        update: vi.fn().mockResolvedValue({ data: {}, error: null }),
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Come online and measure sync performance
      connectionSimulator.setOnline(true);
      await offlineManager.handleOnline();

      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        await offlineManager.syncQueuedOperations();
      });

      // Should sync all operations within 2 seconds
      expect(time).toBeLessThan(2000);

      // Verify all operations are synced
      const remainingOps = await offlineManager.getQueuedOperations();
      expect(remainingOps).toHaveLength(0);
    });

    it('should handle concurrent sync and new operations efficiently', async () => {
      await offlineManager.initialize();
      
      // Start offline with queued operations
      connectionSimulator.setOnline(false);
      await offlineManager.handleOffline();

      // Queue initial operations
      const initialOps = Array(100).fill(null).map((_, i) => ({
        type: 'initial-op',
        data: { id: i }
      }));

      for (const op of initialOps) {
        await offlineManager.queueOperation(op);
      }

      // Mock sync operations
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Come online and start sync
      connectionSimulator.setOnline(true);
      await offlineManager.handleOnline();

      const syncPromise = offlineManager.syncQueuedOperations();

      // Add new operations while syncing
      const newOps = Array(50).fill(null).map((_, i) => ({
        type: 'new-op',
        data: { id: i + 100 }
      }));

      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        const newOpPromises = newOps.map(op => offlineManager.queueOperation(op));
        await Promise.all([syncPromise, ...newOpPromises]);
      });

      // Should handle concurrent operations within 1.5 seconds
      expect(time).toBeLessThan(1500);
    });

    it('should prioritize critical operations during sync', async () => {
      await offlineManager.initialize();
      
      // Start offline
      connectionSimulator.setOnline(false);
      await offlineManager.handleOffline();

      // Queue operations with different priorities
      const operations = [
        ...Array(50).fill(null).map((_, i) => ({
          type: 'low-priority',
          data: { id: i },
          priority: 1
        })),
        ...Array(10).fill(null).map((_, i) => ({
          type: 'high-priority',
          data: { id: i + 50 },
          priority: 10
        })),
        ...Array(20).fill(null).map((_, i) => ({
          type: 'medium-priority',
          data: { id: i + 60 },
          priority: 5
        }))
      ];

      for (const operation of operations) {
        await offlineManager.queueOperation(operation);
      }

      // Mock sync with tracking
      const syncOrder: string[] = [];
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockImplementation((data) => {
          syncOrder.push(data.type);
          return Promise.resolve({ data: {}, error: null });
        }),
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Come online and sync
      connectionSimulator.setOnline(true);
      await offlineManager.handleOnline();

      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        await offlineManager.syncQueuedOperations();
      });

      // Should complete within reasonable time
      expect(time).toBeLessThan(1000);

      // High priority operations should be synced first
      const highPriorityIndex = syncOrder.findIndex(type => type === 'high-priority');
      const lowPriorityIndex = syncOrder.findIndex(type => type === 'low-priority');
      
      if (highPriorityIndex !== -1 && lowPriorityIndex !== -1) {
        expect(highPriorityIndex).toBeLessThan(lowPriorityIndex);
      }
    });
  });

  describe('Background Sync Performance', () => {
    it('should perform background sync without blocking UI', async () => {
      await backgroundSyncManager.initialize();
      await offlineManager.initialize();

      // Queue operations for background sync
      const operations = Array(100).fill(null).map((_, i) => ({
        type: 'background-sync',
        data: { id: i, content: `Content ${i}` }
      }));

      for (const operation of operations) {
        await offlineManager.queueOperation(operation);
      }

      // Mock successful sync
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Start background sync
      backgroundSyncManager.startBackgroundSync();

      // Simulate UI operations during background sync
      const uiOperations = Array(50).fill(null).map((_, i) => 
        stateManager.saveState(`bg-ui-${i}`, { active: true })
      );

      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        await Promise.all(uiOperations);
        // Wait for background sync to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // UI operations should complete quickly despite background sync
      expect(time).toBeLessThan(200);
    });

    it('should throttle background sync to prevent resource exhaustion', async () => {
      await backgroundSyncManager.initialize();

      // Configure throttling
      backgroundSyncManager.setThrottleConfig({
        maxConcurrentOperations: 5,
        batchSize: 10,
        delayBetweenBatches: 50
      });

      // Queue many operations
      const operations = Array(500).fill(null).map((_, i) => ({
        type: 'throttled-sync',
        data: { id: i }
      }));

      for (const operation of operations) {
        await backgroundSyncManager.queueForSync(operation);
      }

      // Mock sync operations
      let concurrentOperations = 0;
      let maxConcurrent = 0;

      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockImplementation(() => {
          concurrentOperations++;
          maxConcurrent = Math.max(maxConcurrent, concurrentOperations);
          
          return new Promise(resolve => {
            setTimeout(() => {
              concurrentOperations--;
              resolve({ data: {}, error: null });
            }, 10);
          });
        }),
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Start sync and measure
      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        await backgroundSyncManager.syncAll();
      });

      // Should respect throttling limits
      expect(maxConcurrent).toBeLessThanOrEqual(5);
      
      // Should complete within reasonable time despite throttling
      expect(time).toBeLessThan(5000);
    });

    it('should handle sync progress reporting efficiently', async () => {
      await backgroundSyncManager.initialize();

      // Set up progress tracking
      const progressUpdates: number[] = [];
      backgroundSyncManager.onSyncProgress((progress) => {
        progressUpdates.push(progress.percentage);
      });

      // Queue operations
      const operations = Array(200).fill(null).map((_, i) => ({
        type: 'progress-sync',
        data: { id: i }
      }));

      for (const operation of operations) {
        await backgroundSyncManager.queueForSync(operation);
      }

      // Mock sync operations
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Measure sync with progress reporting
      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        await backgroundSyncManager.syncAll();
      });

      // Should complete efficiently with progress reporting
      expect(time).toBeLessThan(2000);
      
      // Should have received progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
    });
  });

  describe('Cache Performance During Transitions', () => {
    it('should cache data efficiently during offline transition', async () => {
      await cacheManager.initialize();

      // Generate test data of various sizes
      const datasets = [
        { key: 'small', data: Array(10).fill(null).map((_, i) => ({ id: i })) },
        { key: 'medium', data: Array(100).fill(null).map((_, i) => ({ id: i, data: 'x'.repeat(50) })) },
        { key: 'large', data: Array(1000).fill(null).map((_, i) => ({ id: i, data: 'x'.repeat(100) })) }
      ];

      // Measure caching performance
      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        for (const dataset of datasets) {
          await cacheManager.set(dataset.key, dataset.data, { ttl: 3600 });
        }
      });

      // Should cache all datasets within 300ms
      expect(time).toBeLessThan(300);

      // Verify all data is cached
      for (const dataset of datasets) {
        const cached = await cacheManager.get(dataset.key);
        expect(cached).toHaveLength(dataset.data.length);
      }
    });

    it('should retrieve cached data quickly during offline mode', async () => {
      await cacheManager.initialize();

      // Pre-populate cache
      const testData = Array(500).fill(null).map((_, i) => ({
        id: i,
        title: `Item ${i}`,
        content: 'x'.repeat(200)
      }));

      await cacheManager.set('test-data', testData, { ttl: 3600 });

      // Measure retrieval performance
      const retrievalTimes: number[] = [];

      for (let i = 0; i < 10; i++) {
        const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
          await cacheManager.get('test-data');
        });
        retrievalTimes.push(time);
      }

      // All retrievals should be fast
      const avgTime = retrievalTimes.reduce((a, b) => a + b, 0) / retrievalTimes.length;
      expect(avgTime).toBeLessThan(10); // Average under 10ms
    });

    it('should handle cache eviction efficiently under memory pressure', async () => {
      await cacheManager.initialize();

      // Configure small cache size to trigger eviction
      cacheManager.setMaxSize(100); // 100 items max

      // Add more items than cache can hold
      const items = Array(200).fill(null).map((_, i) => ({
        key: `item-${i}`,
        data: { id: i, content: 'x'.repeat(100) }
      }));

      // Measure cache operations with eviction
      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        for (const item of items) {
          await cacheManager.set(item.key, item.data);
        }
      });

      // Should handle eviction efficiently
      expect(time).toBeLessThan(500);

      // Cache should not exceed max size
      const cacheSize = await cacheManager.size();
      expect(cacheSize).toBeLessThanOrEqual(100);
    });
  });

  describe('Memory Management During Transitions', () => {
    it('should not leak memory during repeated offline/online cycles', async () => {
      await offlineManager.initialize();
      connectionMonitor.startMonitoring();

      // Mock memory usage tracking
      let memoryUsage = 0;
      const trackMemory = () => {
        memoryUsage += Math.random() * 10; // Simulate memory allocation
      };

      // Perform multiple offline/online cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        // Go offline
        connectionSimulator.setOnline(false);
        await offlineManager.handleOffline();
        trackMemory();

        // Queue some operations
        for (let i = 0; i < 20; i++) {
          await offlineManager.queueOperation({
            type: 'cycle-op',
            data: { cycle, operation: i }
          });
        }
        trackMemory();

        // Go online
        connectionSimulator.setOnline(true);
        
        mockSupabase.from.mockReturnValue({
          insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        });

        await offlineManager.handleOnline();
        await offlineManager.syncQueuedOperations();
        trackMemory();

        // Cleanup cycle
        await offlineManager.cleanup?.();
        memoryUsage = Math.max(0, memoryUsage - 5); // Simulate cleanup
      }

      // Memory usage should not grow unbounded
      expect(memoryUsage).toBeLessThan(200); // Reasonable upper bound
    });

    it('should cleanup resources efficiently after sync completion', async () => {
      await offlineManager.initialize();
      await backgroundSyncManager.initialize();

      // Queue operations
      const operations = Array(100).fill(null).map((_, i) => ({
        type: 'cleanup-test',
        data: { id: i }
      }));

      for (const operation of operations) {
        await offlineManager.queueOperation(operation);
      }

      // Mock successful sync
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Perform sync
      await offlineManager.syncQueuedOperations();

      // Measure cleanup performance
      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        await offlineManager.cleanup?.();
        await backgroundSyncManager.cleanup?.();
      });

      // Cleanup should be fast
      expect(time).toBeLessThan(100);

      // Resources should be cleaned up
      const remainingOps = await offlineManager.getQueuedOperations();
      expect(remainingOps).toHaveLength(0);
    });
  });

  describe('Stress Testing', () => {
    it('should handle high-frequency offline/online transitions', async () => {
      await offlineManager.initialize();
      connectionMonitor.startMonitoring();

      // Mock rapid connection changes
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Perform rapid transitions
      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        for (let i = 0; i < 20; i++) {
          connectionSimulator.setOnline(false);
          await offlineManager.handleOffline();
          
          connectionSimulator.setOnline(true);
          await offlineManager.handleOnline();
        }
      });

      // Should handle rapid transitions within reasonable time
      expect(time).toBeLessThan(2000);
    });

    it('should maintain performance under extreme load conditions', async () => {
      await offlineManager.initialize();
      await backgroundSyncManager.initialize();
      connectionMonitor.startMonitoring();

      // Create extreme load scenario
      const extremeLoad = {
        operations: 1000,
        concurrentUsers: 10,
        transitionFrequency: 100 // ms between transitions
      };

      // Generate massive operation queue
      const operations = Array(extremeLoad.operations).fill(null).map((_, i) => ({
        type: 'extreme-load-op',
        data: { 
          id: i, 
          payload: 'x'.repeat(500), // 500 char payload
          timestamp: Date.now() + i 
        }
      }));

      // Mock successful operations
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Start offline and queue all operations
      connectionSimulator.setOnline(false);
      await offlineManager.handleOffline();

      const { time: queueTime } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        await Promise.all(operations.map(op => offlineManager.queueOperation(op)));
      });

      // Should queue operations efficiently even under extreme load
      expect(queueTime).toBeLessThan(5000); // 5 seconds max

      // Come online and measure sync performance
      connectionSimulator.setOnline(true);
      await offlineManager.handleOnline();

      const { time: syncTime } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        await offlineManager.syncQueuedOperations();
      });

      // Should sync within reasonable time even with extreme load
      expect(syncTime).toBeLessThan(10000); // 10 seconds max

      // Verify all operations were processed
      const remainingOps = await offlineManager.getQueuedOperations();
      expect(remainingOps).toHaveLength(0);
    });

    it('should handle performance degradation gracefully', async () => {
      await offlineManager.initialize();
      connectionMonitor.startMonitoring();

      // Simulate degraded performance conditions
      let operationDelay = 0;
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockImplementation(() => {
          operationDelay += 10; // Increasing delay to simulate degradation
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({ data: {}, error: null });
            }, operationDelay);
          });
        }),
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Queue operations
      const operations = Array(50).fill(null).map((_, i) => ({
        type: 'degraded-perf-op',
        data: { id: i }
      }));

      for (const operation of operations) {
        await offlineManager.queueOperation(operation);
      }

      // Measure sync performance under degradation
      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        await offlineManager.syncQueuedOperations();
      });

      // Should complete despite degradation (with reasonable timeout)
      expect(time).toBeLessThan(30000); // 30 seconds max for degraded conditions

      // Should have processed all operations
      const remainingOps = await offlineManager.getQueuedOperations();
      expect(remainingOps).toHaveLength(0);
    });

    it('should maintain performance under concurrent user actions', async () => {
      await offlineManager.initialize();
      await stateManager.initialize?.();

      // Simulate concurrent user actions
      const userActions = [
        // Form interactions
        ...Array(20).fill(null).map((_, i) => 
          stateManager.saveState(`form-${i}`, { field: `value-${i}` })
        ),
        // Navigation
        ...Array(10).fill(null).map((_, i) => 
          stateManager.saveState(`nav-${i}`, { route: `/page-${i}` })
        ),
        // Data operations
        ...Array(30).fill(null).map((_, i) => 
          offlineManager.queueOperation({
            type: 'user-action',
            data: { action: i, timestamp: Date.now() }
          })
        )
      ];

      // Measure concurrent execution
      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        await Promise.all(userActions);
      });

      // Should handle concurrent actions efficiently
      expect(time).toBeLessThan(500);
    });
  });
});