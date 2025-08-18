import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackgroundSyncManager } from '../BackgroundSyncManager';
import { offlineManager } from '../OfflineManager';
import { connectionMonitor } from '../ConnectionMonitor';
import { supabase } from '@/lib/supabase';

// Mock dependencies
vi.mock('../OfflineManager', () => ({
  offlineManager: {
    isOffline: vi.fn(),
    getQueuedActions: vi.fn(),
    removeQueuedAction: vi.fn(),
    cacheData: vi.fn(),
    invalidateCache: vi.fn()
  }
}));

vi.mock('../ConnectionMonitor', () => ({
  connectionMonitor: {
    onConnectionChange: vi.fn()
  }
}));

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

describe('BackgroundSyncManager', () => {
  let backgroundSyncManager: BackgroundSyncManager;
  let mockOfflineManager: any;
  let mockConnectionMonitor: any;
  let mockSupabase: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create fresh instance for each test
    backgroundSyncManager = BackgroundSyncManager.createInstance();
    
    mockOfflineManager = offlineManager as any;
    mockConnectionMonitor = connectionMonitor as any;
    mockSupabase = supabase as any;
    
    // Default mock implementations
    mockOfflineManager.isOffline.mockReturnValue(false);
    mockOfflineManager.getQueuedActions.mockResolvedValue([]);
    mockOfflineManager.removeQueuedAction.mockResolvedValue();
    mockOfflineManager.cacheData.mockResolvedValue();
    mockOfflineManager.invalidateCache.mockResolvedValue();
    mockConnectionMonitor.onConnectionChange.mockImplementation(() => {});
  });

  afterEach(() => {
    backgroundSyncManager.cleanup();
  });

  describe('Configuration', () => {
    it('should have default configuration', () => {
      const config = backgroundSyncManager.getConfiguration();
      
      expect(config.batchSize).toBe(10);
      expect(config.maxConcurrentSyncs).toBe(3);
      expect(config.conflictResolutionStrategy).toBe('manual');
      expect(config.enableProgressTracking).toBe(true);
      expect(config.enableSelectiveSync).toBe(true);
    });

    it('should allow configuration updates', () => {
      const newConfig = {
        batchSize: 20,
        maxConcurrentSyncs: 5,
        conflictResolutionStrategy: 'server_wins' as const
      };
      
      backgroundSyncManager.configure(newConfig);
      
      const config = backgroundSyncManager.getConfiguration();
      expect(config.batchSize).toBe(20);
      expect(config.maxConcurrentSyncs).toBe(5);
      expect(config.conflictResolutionStrategy).toBe('server_wins');
    });

    it('should preserve existing config when partially updating', () => {
      const originalConfig = backgroundSyncManager.getConfiguration();
      
      backgroundSyncManager.configure({ batchSize: 15 });
      
      const updatedConfig = backgroundSyncManager.getConfiguration();
      expect(updatedConfig.batchSize).toBe(15);
      expect(updatedConfig.maxConcurrentSyncs).toBe(originalConfig.maxConcurrentSyncs);
    });
  });

  describe('Background Sync Control', () => {
    it('should start background sync', async () => {
      await backgroundSyncManager.startBackgroundSync();
      
      const status = backgroundSyncManager.getSyncStatus();
      expect(status.isRunning).toBe(true);
      expect(mockConnectionMonitor.onConnectionChange).toHaveBeenCalled();
    });

    it('should not start if already running', async () => {
      await backgroundSyncManager.startBackgroundSync();
      await backgroundSyncManager.startBackgroundSync(); // Second call
      
      const status = backgroundSyncManager.getSyncStatus();
      expect(status.isRunning).toBe(true);
      expect(mockConnectionMonitor.onConnectionChange).toHaveBeenCalledTimes(1);
    });

    it('should stop background sync', async () => {
      await backgroundSyncManager.startBackgroundSync();
      backgroundSyncManager.stopBackgroundSync();
      
      const status = backgroundSyncManager.getSyncStatus();
      expect(status.isRunning).toBe(false);
      expect(status.nextScheduledSync).toBeNull();
    });

    it('should not stop if not running', () => {
      expect(() => {
        backgroundSyncManager.stopBackgroundSync();
      }).not.toThrow();
      
      const status = backgroundSyncManager.getSyncStatus();
      expect(status.isRunning).toBe(false);
    });
  });

  describe('Sync Operations', () => {
    beforeEach(() => {
      // Mock successful Supabase responses with proper chaining
      const mockInsert = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { id: '1', name: 'Test Item' }, 
            error: null 
          }))
        }))
      }));
      
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: { id: '1', name: 'Updated Item' }, 
              error: null 
            }))
          }))
        }))
      }));
      
      const mockDelete = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }));
      
      const mockSelect = vi.fn((query) => {
        if (query === '*' || query === undefined) {
          return {
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ 
                data: { id: '1', name: 'Test Item' }, 
                error: null 
              }))
            })),
            limit: vi.fn(() => Promise.resolve({ 
              data: [{ id: '1', name: 'Test Item' }], 
              error: null 
            }))
          };
        }
        return {
          limit: vi.fn(() => Promise.resolve({ 
            data: [{ id: '1', name: 'Test Item' }], 
            error: null 
          }))
        };
      });
      
      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
        select: mockSelect
      });
    });

    it('should sync with filter', async () => {
      const mockActions = [
        {
          id: 'action1',
          type: 'CREATE' as const,
          table: 'test_table',
          payload: { name: 'Test Item' },
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'high' as const
        }
      ];
      
      mockOfflineManager.getQueuedActions.mockResolvedValue(mockActions);
      
      const filter = {
        tables: ['test_table'],
        priorities: ['high' as const]
      };
      
      const result = await backgroundSyncManager.syncWithFilter(filter);
      
      expect(result.success).toBe(true);
      expect(result.syncedActions).toBe(1);
      expect(result.failedActions).toBe(0);
    });

    it('should handle empty action queue', async () => {
      mockOfflineManager.getQueuedActions.mockResolvedValue([]);
      
      const result = await backgroundSyncManager.syncWithFilter({});
      
      expect(result.success).toBe(true);
      expect(result.syncedActions).toBe(0);
      expect(result.failedActions).toBe(0);
    });

    it('should force sync now', async () => {
      const mockActions = [
        {
          id: 'action1',
          type: 'CREATE' as const,
          table: 'test_table',
          payload: { name: 'Test Item' },
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'medium' as const
        }
      ];
      
      mockOfflineManager.getQueuedActions.mockResolvedValue(mockActions);
      
      const result = await backgroundSyncManager.forceSyncNow();
      
      expect(result.success).toBe(true);
      expect(result.syncedActions).toBe(1);
    });

    it('should not sync when offline', async () => {
      mockOfflineManager.isOffline.mockReturnValue(true);
      
      await expect(
        backgroundSyncManager.syncWithFilter({})
      ).rejects.toThrow('Cannot sync while offline');
      
      await expect(
        backgroundSyncManager.forceSyncNow()
      ).rejects.toThrow('Cannot sync while offline');
    });
  });

  describe('Progress Tracking', () => {
    it('should track sync progress', async () => {
      const mockActions = [
        {
          id: 'action1',
          type: 'CREATE' as const,
          table: 'test_table',
          payload: { name: 'Test Item 1' },
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'high' as const
        },
        {
          id: 'action2',
          type: 'CREATE' as const,
          table: 'test_table',
          payload: { name: 'Test Item 2' },
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'medium' as const
        }
      ];
      
      mockOfflineManager.getQueuedActions.mockResolvedValue(mockActions);
      
      let progressUpdates: any[] = [];
      backgroundSyncManager.onSyncProgress((progress) => {
        progressUpdates.push({ ...progress });
      });
      
      await backgroundSyncManager.syncWithFilter({});
      
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      const finalProgress = progressUpdates[progressUpdates.length - 1];
      expect(finalProgress.total).toBe(2);
      expect(finalProgress.completed).toBe(2);
      expect(finalProgress.percentage).toBe(100);
    });

    it('should return null progress when not syncing', () => {
      const progress = backgroundSyncManager.getSyncProgress();
      expect(progress).toBeNull();
    });
  });

  describe('Sync Status', () => {
    it('should return correct sync status', () => {
      const status = backgroundSyncManager.getSyncStatus();
      
      expect(status.isRunning).toBe(false);
      expect(status.lastSync).toBeNull();
      expect(status.nextScheduledSync).toBeNull();
      expect(status.totalActionsSynced).toBe(0);
      expect(status.totalConflictsResolved).toBe(0);
      expect(status.averageSyncTime).toBe(0);
      expect(Array.isArray(status.syncHistory)).toBe(true);
    });

    it('should update status after sync', async () => {
      const mockActions = [
        {
          id: 'action1',
          type: 'CREATE' as const,
          table: 'test_table',
          payload: { name: 'Test Item' },
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'high' as const
        }
      ];
      
      mockOfflineManager.getQueuedActions.mockResolvedValue(mockActions);
      
      await backgroundSyncManager.syncWithFilter({});
      
      const status = backgroundSyncManager.getSyncStatus();
      expect(status.totalActionsSynced).toBe(1);
      expect(status.syncHistory.length).toBe(1);
      expect(status.averageSyncTime).toBeGreaterThan(0);
    });
  });

  describe('Conflict Resolution', () => {
    it('should add conflict resolution rule', () => {
      const rule = {
        table: 'test_table',
        field: 'name',
        strategy: 'server_wins' as const
      };
      
      expect(() => {
        backgroundSyncManager.addConflictResolutionRule(rule);
      }).not.toThrow();
    });

    it('should remove conflict resolution rule', () => {
      const rule = {
        table: 'test_table',
        field: 'name',
        strategy: 'server_wins' as const
      };
      
      backgroundSyncManager.addConflictResolutionRule(rule);
      
      expect(() => {
        backgroundSyncManager.removeConflictResolutionRule('test_table', 'name');
      }).not.toThrow();
    });

    it('should handle conflict resolution with server_wins strategy', async () => {
      backgroundSyncManager.configure({ conflictResolutionStrategy: 'server_wins' });
      
      // Mock conflict scenario
      const serverData = { id: '1', name: 'Server Name', updated_at: '2023-01-02T00:00:00Z' };
      const clientData = { id: '1', name: 'Client Name', updated_at: '2023-01-01T00:00:00Z' };
      
      mockSupabase.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: serverData, error: null }))
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: serverData, error: null }))
            }))
          }))
        }))
      });
      
      const mockActions = [
        {
          id: 'action1',
          type: 'UPDATE' as const,
          table: 'test_table',
          payload: clientData,
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'high' as const
        }
      ];
      
      mockOfflineManager.getQueuedActions.mockResolvedValue(mockActions);
      
      const result = await backgroundSyncManager.syncWithFilter({});
      
      expect(result.success).toBe(true);
    });

    it('should throw error for non-existent conflict', async () => {
      await expect(
        backgroundSyncManager.resolveConflictManually('non-existent', {})
      ).rejects.toThrow('Conflict non-existent not found');
    });
  });

  describe('Event Handling', () => {
    it('should register sync progress callback', () => {
      const callback = vi.fn();
      
      expect(() => {
        backgroundSyncManager.onSyncProgress(callback);
      }).not.toThrow();
    });

    it('should register sync complete callback', () => {
      const callback = vi.fn();
      
      expect(() => {
        backgroundSyncManager.onSyncComplete(callback);
      }).not.toThrow();
    });

    it('should register conflict detected callback', () => {
      const callback = vi.fn();
      
      expect(() => {
        backgroundSyncManager.onConflictDetected(callback);
      }).not.toThrow();
    });

    it('should register sync error callback', () => {
      const callback = vi.fn();
      
      expect(() => {
        backgroundSyncManager.onSyncError(callback);
      }).not.toThrow();
    });

    it('should call sync complete callback', async () => {
      const callback = vi.fn();
      backgroundSyncManager.onSyncComplete(callback);
      
      const mockActions = [
        {
          id: 'action1',
          type: 'CREATE' as const,
          table: 'test_table',
          payload: { name: 'Test Item' },
          timestamp: new Date(),
          retryCount: 0,
          maxRetries: 3,
          priority: 'high' as const
        }
      ];
      
      mockOfflineManager.getQueuedActions.mockResolvedValue(mockActions);
      
      await backgroundSyncManager.syncWithFilter({});
      
      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          syncedActions: 1,
          failedActions: 0
        })
      );
    });
  });

  describe('Action Type Handling', () => {
    beforeEach(() => {
      mockOfflineManager.getQueuedActions.mockResolvedValue([]);
      
      // Setup proper Supabase mocks for each action type
      const mockInsert = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { id: '1', name: 'Test Item' }, 
            error: null 
          }))
        }))
      }));
      
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: { id: '1', name: 'Updated Item' }, 
              error: null 
            }))
          }))
        }))
      }));
      
      const mockDelete = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }));
      
      const mockSelect = vi.fn((query) => {
        if (query === '*' || query === undefined) {
          return {
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ 
                data: { id: '1', name: 'Test Item' }, 
                error: null 
              }))
            })),
            limit: vi.fn(() => Promise.resolve({ 
              data: [{ id: '1', name: 'Test Item' }], 
              error: null 
            }))
          };
        }
        return {
          limit: vi.fn(() => Promise.resolve({ 
            data: [{ id: '1', name: 'Test Item' }], 
            error: null 
          }))
        };
      });
      
      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
        select: mockSelect
      });
    });

    it('should handle CREATE actions', async () => {
      const mockAction = {
        id: 'action1',
        type: 'CREATE' as const,
        table: 'test_table',
        payload: { name: 'Test Item' },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        priority: 'high' as const
      };
      
      mockOfflineManager.getQueuedActions.mockResolvedValue([mockAction]);
      
      const result = await backgroundSyncManager.syncWithFilter({});
      
      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('test_table');
    });

    it('should handle UPDATE actions', async () => {
      const mockAction = {
        id: 'action1',
        type: 'UPDATE' as const,
        table: 'test_table',
        payload: { id: '1', name: 'Updated Item' },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        priority: 'high' as const
      };
      
      mockOfflineManager.getQueuedActions.mockResolvedValue([mockAction]);
      
      const result = await backgroundSyncManager.syncWithFilter({});
      
      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('test_table');
    });

    it('should handle DELETE actions', async () => {
      const mockAction = {
        id: 'action1',
        type: 'DELETE' as const,
        table: 'test_table',
        payload: { id: '1' },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        priority: 'high' as const
      };
      
      mockOfflineManager.getQueuedActions.mockResolvedValue([mockAction]);
      
      const result = await backgroundSyncManager.syncWithFilter({});
      
      expect(result.success).toBe(true);
      expect(mockOfflineManager.invalidateCache).toHaveBeenCalledWith('test_table', '1');
    });

    it('should handle QUERY actions', async () => {
      const mockAction = {
        id: 'action1',
        type: 'QUERY' as const,
        table: 'test_table',
        payload: { select: '*', limit: 10 },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        priority: 'high' as const
      };
      
      mockOfflineManager.getQueuedActions.mockResolvedValue([mockAction]);
      
      const result = await backgroundSyncManager.syncWithFilter({});
      
      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('test_table');
    });
  });

  describe('Filtering', () => {
    const mockActions = [
      {
        id: 'action1',
        type: 'CREATE' as const,
        table: 'table1',
        payload: { name: 'Item 1' },
        timestamp: new Date('2023-01-01'),
        retryCount: 0,
        maxRetries: 3,
        priority: 'high' as const
      },
      {
        id: 'action2',
        type: 'UPDATE' as const,
        table: 'table2',
        payload: { name: 'Item 2' },
        timestamp: new Date('2023-01-02'),
        retryCount: 0,
        maxRetries: 3,
        priority: 'medium' as const
      },
      {
        id: 'action3',
        type: 'DELETE' as const,
        table: 'table1',
        payload: { id: '1' },
        timestamp: new Date('2023-01-03'),
        retryCount: 0,
        maxRetries: 3,
        priority: 'low' as const
      }
    ];

    beforeEach(() => {
      // Setup proper Supabase mocks for filtering tests
      const mockInsert = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ 
            data: { id: '1', name: 'Test Item' }, 
            error: null 
          }))
        }))
      }));
      
      const mockUpdate = vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ 
              data: { id: '1', name: 'Updated Item' }, 
              error: null 
            }))
          }))
        }))
      }));
      
      const mockDelete = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }));
      
      const mockSelect = vi.fn((query) => {
        if (query === '*' || query === undefined) {
          return {
            eq: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ 
                data: { id: '1', name: 'Test Item' }, 
                error: null 
              }))
            })),
            limit: vi.fn(() => Promise.resolve({ 
              data: [{ id: '1', name: 'Test Item' }], 
              error: null 
            }))
          };
        }
        return {
          limit: vi.fn(() => Promise.resolve({ 
            data: [{ id: '1', name: 'Test Item' }], 
            error: null 
          }))
        };
      });
      
      mockSupabase.from.mockReturnValue({
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
        select: mockSelect
      });
    });

    it('should filter by tables', async () => {
      mockOfflineManager.getQueuedActions.mockResolvedValue(mockActions);
      
      const result = await backgroundSyncManager.syncWithFilter({
        tables: ['table1']
      });
      
      expect(result.success).toBe(true);
      expect(result.syncedActions).toBe(2); // action1 and action3
    });

    it('should filter by priorities', async () => {
      mockOfflineManager.getQueuedActions.mockResolvedValue(mockActions);
      
      const result = await backgroundSyncManager.syncWithFilter({
        priorities: ['high']
      });
      
      expect(result.success).toBe(true);
      expect(result.syncedActions).toBe(1); // action1 only
    });

    it('should filter by action types', async () => {
      mockOfflineManager.getQueuedActions.mockResolvedValue(mockActions);
      
      const result = await backgroundSyncManager.syncWithFilter({
        actionTypes: ['CREATE', 'UPDATE']
      });
      
      expect(result.success).toBe(true);
      expect(result.syncedActions).toBe(2); // action1 and action2
    });

    it('should filter by date range', async () => {
      mockOfflineManager.getQueuedActions.mockResolvedValue(mockActions);
      
      const result = await backgroundSyncManager.syncWithFilter({
        dateRange: {
          from: new Date('2023-01-01'),
          to: new Date('2023-01-02')
        }
      });
      
      expect(result.success).toBe(true);
      expect(result.syncedActions).toBe(2); // action1 and action2
    });

    it('should limit max actions', async () => {
      mockOfflineManager.getQueuedActions.mockResolvedValue(mockActions);
      
      const result = await backgroundSyncManager.syncWithFilter({
        maxActions: 1
      });
      
      expect(result.success).toBe(true);
      expect(result.syncedActions).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle sync errors gracefully', async () => {
      const mockAction = {
        id: 'action1',
        type: 'CREATE' as const,
        table: 'test_table',
        payload: { name: 'Test Item' },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        priority: 'high' as const
      };
      
      mockOfflineManager.getQueuedActions.mockResolvedValue([mockAction]);
      
      // Mock Supabase error - the error should be thrown, not returned in the response
      mockSupabase.from.mockReturnValue({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.reject(new Error('Database error')))
          }))
        }))
      });
      
      const result = await backgroundSyncManager.syncWithFilter({});
      
      expect(result.success).toBe(false);
      expect(result.failedActions).toBe(1);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should call error callback on sync failure', async () => {
      const errorCallback = vi.fn();
      backgroundSyncManager.onSyncError(errorCallback);
      
      await backgroundSyncManager.startBackgroundSync();
      
      // Mock a sync error by making getQueuedActions throw
      mockOfflineManager.getQueuedActions.mockRejectedValue(new Error('Database error'));
      
      // Wait a bit for the background sync to trigger
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // The error callback should have been called
      expect(errorCallback).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', () => {
      expect(() => {
        backgroundSyncManager.cleanup();
      }).not.toThrow();
      
      const status = backgroundSyncManager.getSyncStatus();
      expect(status.isRunning).toBe(false);
    });

    it('should clear all callbacks on cleanup', () => {
      const progressCallback = vi.fn();
      const completeCallback = vi.fn();
      const conflictCallback = vi.fn();
      const errorCallback = vi.fn();
      
      backgroundSyncManager.onSyncProgress(progressCallback);
      backgroundSyncManager.onSyncComplete(completeCallback);
      backgroundSyncManager.onConflictDetected(conflictCallback);
      backgroundSyncManager.onSyncError(errorCallback);
      
      backgroundSyncManager.cleanup();
      
      // Callbacks should be cleared
      expect(backgroundSyncManager.getSyncStatus().syncHistory).toEqual([]);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = BackgroundSyncManager.getInstance();
      const instance2 = BackgroundSyncManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should reset instance for testing', () => {
      const instance1 = BackgroundSyncManager.getInstance();
      
      BackgroundSyncManager.resetInstance();
      
      const instance2 = BackgroundSyncManager.getInstance();
      
      expect(instance1).not.toBe(instance2);
    });
  });
});