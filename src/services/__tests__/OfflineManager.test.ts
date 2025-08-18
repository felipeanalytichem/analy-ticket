import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineManager } from '../OfflineManager';
import { connectionMonitor } from '../ConnectionMonitor';
import { supabase } from '@/lib/supabase';

// Mock dependencies
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn()
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        })),
        limit: vi.fn()
      }))
    }))
  }
}));

vi.mock('../ConnectionMonitor', () => ({
  connectionMonitor: {
    isOnline: vi.fn(),
    onConnectionChange: vi.fn()
  }
}));

vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve({
    transaction: vi.fn(() => ({
      objectStore: vi.fn(() => ({
        put: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn(() => []),
        delete: vi.fn(),
        clear: vi.fn()
      }))
    })),
    close: vi.fn()
  }))
}));

describe('OfflineManager', () => {
  let offlineManager: OfflineManager;
  let mockConnectionMonitor: any;
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create fresh instance for each test
    offlineManager = OfflineManager.createInstance();
    
    mockConnectionMonitor = connectionMonitor as any;
    mockSupabase = supabase as any;
    
    // Default mock implementations
    mockConnectionMonitor.isOnline.mockReturnValue(true);
    mockConnectionMonitor.onConnectionChange.mockImplementation(() => {});
  });

  afterEach(() => {
    offlineManager.cleanup();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(offlineManager.initialize()).resolves.not.toThrow();
    });

    it('should not initialize twice', async () => {
      await offlineManager.initialize();
      
      // Second initialization should not throw
      await expect(offlineManager.initialize()).resolves.not.toThrow();
    });

    it('should setup connection monitoring on initialization', async () => {
      await offlineManager.initialize();
      
      expect(mockConnectionMonitor.onConnectionChange).toHaveBeenCalled();
    });
  });

  describe('Offline Detection', () => {
    it('should detect offline status correctly', async () => {
      mockConnectionMonitor.isOnline.mockReturnValue(false);
      
      await offlineManager.initialize();
      
      expect(offlineManager.isOffline()).toBe(true);
    });

    it('should detect online status correctly', async () => {
      mockConnectionMonitor.isOnline.mockReturnValue(true);
      
      await offlineManager.initialize();
      
      expect(offlineManager.isOffline()).toBe(false);
    });

    it('should return correct offline status', async () => {
      mockConnectionMonitor.isOnline.mockReturnValue(false);
      
      await offlineManager.initialize();
      
      const status = offlineManager.getOfflineStatus();
      
      expect(status.isOffline).toBe(true);
      expect(status.syncInProgress).toBe(false);
      expect(status.lastSync).toBeNull();
    });
  });

  describe('Data Caching', () => {
    beforeEach(async () => {
      await offlineManager.initialize();
    });

    it('should cache data successfully', async () => {
      const testData = { id: '1', name: 'Test Item' };
      
      await expect(
        offlineManager.cacheData('test_table', testData)
      ).resolves.not.toThrow();
    });

    it('should cache data with custom TTL', async () => {
      const testData = { id: '1', name: 'Test Item' };
      const customTTL = 60000; // 1 minute
      
      await expect(
        offlineManager.cacheData('test_table', testData, customTTL)
      ).resolves.not.toThrow();
    });

    it('should retrieve cached data', async () => {
      const testData = { id: '1', name: 'Test Item' };
      
      await offlineManager.cacheData('test_table', testData);
      
      const cachedData = await offlineManager.getCachedData('test_table', '1');
      
      expect(Array.isArray(cachedData)).toBe(true);
    });

    it('should retrieve all cached data for a table', async () => {
      const testData1 = { id: '1', name: 'Test Item 1' };
      const testData2 = { id: '2', name: 'Test Item 2' };
      
      await offlineManager.cacheData('test_table', testData1);
      await offlineManager.cacheData('test_table', testData2);
      
      const cachedData = await offlineManager.getCachedData('test_table');
      
      expect(Array.isArray(cachedData)).toBe(true);
    });

    it('should invalidate specific cached data', async () => {
      const testData = { id: '1', name: 'Test Item' };
      
      await offlineManager.cacheData('test_table', testData);
      
      await expect(
        offlineManager.invalidateCache('test_table', '1')
      ).resolves.not.toThrow();
    });

    it('should invalidate all cached data for a table', async () => {
      const testData1 = { id: '1', name: 'Test Item 1' };
      const testData2 = { id: '2', name: 'Test Item 2' };
      
      await offlineManager.cacheData('test_table', testData1);
      await offlineManager.cacheData('test_table', testData2);
      
      await expect(
        offlineManager.invalidateCache('test_table')
      ).resolves.not.toThrow();
    });
  });

  describe('Action Queuing', () => {
    beforeEach(async () => {
      await offlineManager.initialize();
    });

    it('should queue CREATE action', async () => {
      const action = {
        type: 'CREATE' as const,
        table: 'test_table',
        payload: { name: 'Test Item' },
        maxRetries: 3,
        priority: 'medium' as const
      };
      
      const actionId = await offlineManager.queueAction(action);
      
      expect(typeof actionId).toBe('string');
      expect(actionId).toMatch(/^offline_/);
    });

    it('should queue UPDATE action', async () => {
      const action = {
        type: 'UPDATE' as const,
        table: 'test_table',
        payload: { id: '1', name: 'Updated Item' },
        maxRetries: 3,
        priority: 'high' as const
      };
      
      const actionId = await offlineManager.queueAction(action);
      
      expect(typeof actionId).toBe('string');
    });

    it('should queue DELETE action', async () => {
      const action = {
        type: 'DELETE' as const,
        table: 'test_table',
        payload: { id: '1' },
        maxRetries: 3,
        priority: 'low' as const
      };
      
      const actionId = await offlineManager.queueAction(action);
      
      expect(typeof actionId).toBe('string');
    });

    it('should retrieve queued actions', async () => {
      const action = {
        type: 'CREATE' as const,
        table: 'test_table',
        payload: { name: 'Test Item' },
        maxRetries: 3,
        priority: 'medium' as const
      };
      
      await offlineManager.queueAction(action);
      
      const queuedActions = await offlineManager.getQueuedActions();
      
      expect(Array.isArray(queuedActions)).toBe(true);
    });

    it('should remove queued action', async () => {
      const action = {
        type: 'CREATE' as const,
        table: 'test_table',
        payload: { name: 'Test Item' },
        maxRetries: 3,
        priority: 'medium' as const
      };
      
      const actionId = await offlineManager.queueAction(action);
      
      await expect(
        offlineManager.removeQueuedAction(actionId)
      ).resolves.not.toThrow();
    });

    it('should handle action with dependencies', async () => {
      const action = {
        type: 'CREATE' as const,
        table: 'test_table',
        payload: { name: 'Test Item' },
        maxRetries: 3,
        priority: 'medium' as const,
        dependencies: ['action1', 'action2']
      };
      
      const actionId = await offlineManager.queueAction(action);
      
      expect(typeof actionId).toBe('string');
    });
  });

  describe('Data Synchronization', () => {
    beforeEach(async () => {
      await offlineManager.initialize();
    });

    it('should not sync when offline', async () => {
      mockConnectionMonitor.isOnline.mockReturnValue(false);
      
      const result = await offlineManager.syncData();
      
      expect(result.success).toBe(false);
      expect(result.errors).toContain('Device is offline');
    });

    it('should not start sync when already in progress', async () => {
      mockConnectionMonitor.isOnline.mockReturnValue(true);
      
      // Start first sync (will be mocked to be slow)
      const firstSyncPromise = offlineManager.syncData();
      
      // Try to start second sync immediately
      const secondResult = await offlineManager.syncData();
      
      expect(secondResult.success).toBe(false);
      expect(secondResult.errors).toContain('Sync already in progress');
      
      // Wait for first sync to complete
      await firstSyncPromise;
    });

    it('should sync CREATE actions successfully', async () => {
      mockConnectionMonitor.isOnline.mockReturnValue(true);
      
      // Mock successful Supabase response
      const mockData = { id: '1', name: 'Test Item' };
      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: mockData, error: null }))
          }))
        }))
      });
      
      // Mock the database to return the queued action
      const mockAction = {
        id: 'test-action-1',
        type: 'CREATE',
        table: 'test_table',
        payload: { name: 'Test Item' },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        priority: 'medium'
      };
      
      // Mock getQueuedActions to return our test action
      vi.spyOn(offlineManager, 'getQueuedActions').mockResolvedValue([mockAction]);
      vi.spyOn(offlineManager, 'removeQueuedAction').mockResolvedValue();
      
      const result = await offlineManager.syncData();
      
      expect(result.success).toBe(true);
      expect(result.syncedActions).toBe(1);
      expect(result.failedActions).toBe(0);
    });

    it('should handle sync errors gracefully', async () => {
      mockConnectionMonitor.isOnline.mockReturnValue(true);
      
      // Mock Supabase error
      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: null, 
              error: { message: 'Database error' } 
            }))
          }))
        }))
      });
      
      // Mock the database to return the queued action
      const mockAction = {
        id: 'test-action-1',
        type: 'CREATE',
        table: 'test_table',
        payload: { name: 'Test Item' },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 1,
        priority: 'medium'
      };
      
      // Mock getQueuedActions to return our test action
      vi.spyOn(offlineManager, 'getQueuedActions').mockResolvedValue([mockAction]);
      vi.spyOn(offlineManager, 'removeQueuedAction').mockResolvedValue();
      
      const result = await offlineManager.syncData();
      
      expect(result.success).toBe(false);
      expect(result.failedActions).toBe(1);
    });

    it('should sync specific table', async () => {
      mockConnectionMonitor.isOnline.mockReturnValue(true);
      
      const result = await offlineManager.syncTable('test_table');
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('syncedActions');
      expect(result).toHaveProperty('failedActions');
    });

    it('should handle conflicts during sync', async () => {
      mockConnectionMonitor.isOnline.mockReturnValue(true);
      
      // Mock conflict scenario (unique constraint violation)
      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: null, 
              error: { code: '23505', message: 'Unique constraint violation' } 
            }))
          }))
        }))
      });
      
      // Mock the database to return the queued action
      const mockAction = {
        id: 'test-action-1',
        type: 'CREATE',
        table: 'test_table',
        payload: { name: 'Test Item' },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 1,
        priority: 'medium'
      };
      
      // Mock getQueuedActions to return our test action
      vi.spyOn(offlineManager, 'getQueuedActions').mockResolvedValue([mockAction]);
      vi.spyOn(offlineManager, 'removeQueuedAction').mockResolvedValue();
      
      const result = await offlineManager.syncData();
      
      expect(result.conflicts.length).toBeGreaterThan(0);
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await offlineManager.initialize();
    });

    it('should register offline status change callback', () => {
      const callback = vi.fn();
      
      expect(() => {
        offlineManager.onOfflineStatusChange(callback);
      }).not.toThrow();
    });

    it('should register sync progress callback', () => {
      const callback = vi.fn();
      
      expect(() => {
        offlineManager.onSyncProgress(callback);
      }).not.toThrow();
    });

    it('should register conflict detection callback', () => {
      const callback = vi.fn();
      
      expect(() => {
        offlineManager.onConflictDetected(callback);
      }).not.toThrow();
    });

    it('should handle connection change events', async () => {
      const statusCallback = vi.fn();
      offlineManager.onOfflineStatusChange(statusCallback);
      
      // Simulate connection change
      const connectionChangeCallback = mockConnectionMonitor.onConnectionChange.mock.calls[0][0];
      connectionChangeCallback({ isOnline: false });
      
      // Give time for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(statusCallback).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should throw error when not initialized', async () => {
      const uninitializedManager = OfflineManager.createInstance();
      
      await expect(
        uninitializedManager.cacheData('test', {})
      ).rejects.toThrow('OfflineManager not initialized');
      
      await expect(
        uninitializedManager.queueAction({
          type: 'CREATE',
          table: 'test',
          payload: {},
          maxRetries: 3,
          priority: 'medium'
        })
      ).rejects.toThrow('OfflineManager not initialized');
      
      uninitializedManager.cleanup();
    });

    it('should handle database initialization failure', async () => {
      // Mock idb to throw error
      const { openDB } = await import('idb');
      vi.mocked(openDB).mockRejectedValueOnce(new Error('Database error'));
      
      const failingManager = OfflineManager.createInstance();
      
      await expect(failingManager.initialize()).rejects.toThrow('Database error');
      
      failingManager.cleanup();
    });

    it('should handle cache operation errors gracefully', async () => {
      await offlineManager.initialize();
      
      // Mock database to throw error
      const mockDb = {
        transaction: vi.fn(() => {
          throw new Error('Transaction error');
        }),
        close: vi.fn()
      };
      
      // Replace the db instance
      (offlineManager as any).db = mockDb;
      
      await expect(
        offlineManager.cacheData('test', {})
      ).rejects.toThrow('Transaction error');
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', async () => {
      await offlineManager.initialize();
      
      expect(() => {
        offlineManager.cleanup();
      }).not.toThrow();
    });

    it('should clear all callbacks on cleanup', async () => {
      await offlineManager.initialize();
      
      const statusCallback = vi.fn();
      const progressCallback = vi.fn();
      const conflictCallback = vi.fn();
      
      offlineManager.onOfflineStatusChange(statusCallback);
      offlineManager.onSyncProgress(progressCallback);
      offlineManager.onConflictDetected(conflictCallback);
      
      offlineManager.cleanup();
      
      // Callbacks should be cleared and not called
      const connectionChangeCallback = mockConnectionMonitor.onConnectionChange.mock.calls[0][0];
      connectionChangeCallback({ isOnline: false });
      
      expect(statusCallback).not.toHaveBeenCalled();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = OfflineManager.getInstance();
      const instance2 = OfflineManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should reset instance for testing', () => {
      const instance1 = OfflineManager.getInstance();
      
      OfflineManager.resetInstance();
      
      const instance2 = OfflineManager.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
  });
});