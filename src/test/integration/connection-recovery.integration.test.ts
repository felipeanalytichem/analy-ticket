/**
 * Integration tests for connection recovery scenarios
 * Tests network failure handling, reconnection logic, and data synchronization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionMonitor } from '../../services/ConnectionMonitor';
import { AutoReconnectionService } from '../../services/AutoReconnectionService';
import { ErrorRecoveryManager } from '../../services/ErrorRecoveryManager';
import { OfflineManager } from '../../services/OfflineManager';
import {
  createMockSupabaseClient,
  ConnectionSimulator,
  TimerUtils,
  ErrorSimulator,
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

describe('Connection Recovery Integration Tests', () => {
  let connectionMonitor: ConnectionMonitor;
  let autoReconnectionService: AutoReconnectionService;
  let errorRecoveryManager: ErrorRecoveryManager;
  let offlineManager: OfflineManager;
  let connectionSimulator: ConnectionSimulator;

  beforeEach(() => {
    vi.clearAllMocks();
    TimerUtils.useFakeTimers();
    
    connectionMonitor = new ConnectionMonitor();
    autoReconnectionService = new AutoReconnectionService();
    errorRecoveryManager = new ErrorRecoveryManager();
    offlineManager = new OfflineManager();
    connectionSimulator = new ConnectionSimulator();
    
    mockLocalStorage.clear();
  });

  afterEach(() => {
    connectionMonitor.cleanup?.();
    autoReconnectionService.cleanup?.();
    errorRecoveryManager.cleanup?.();
    offlineManager.cleanup?.();
    TimerUtils.useRealTimers();
  });

  describe('Network Failure Detection and Recovery', () => {
    it('should detect network failure and initiate recovery', async () => {
      connectionMonitor.startMonitoring();

      // Set up connection change callback
      const connectionChangeCallback = vi.fn();
      connectionMonitor.onConnectionChange(connectionChangeCallback);

      // Simulate network failure
      connectionSimulator.setOnline(false);

      // Mock failed health check
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(ErrorSimulator.networkError())
          })
        })
      });

      await connectionMonitor.performHealthCheck();

      // Should detect offline status
      expect(connectionMonitor.getConnectionStatus().isOnline).toBe(false);
      expect(connectionChangeCallback).toHaveBeenCalledWith(
        expect.objectContaining({ isOnline: false })
      );
    });

    it('should handle cascading network failures with progressive recovery', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.startReconnection();
      
      // Set up comprehensive failure tracking
      const failureEvents: string[] = [];
      const recoveryEvents: string[] = [];
      
      connectionMonitor.onConnectionLost(() => failureEvents.push('connection_lost'));
      connectionMonitor.onReconnected(() => recoveryEvents.push('reconnected'));
      
      // Simulate multiple cascading failures
      const failures = [
        { type: 'network', delay: 100 },
        { type: 'dns', delay: 200 },
        { type: 'server', delay: 300 },
        { type: 'auth', delay: 400 }
      ];
      
      let healthCheckCount = 0;
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              healthCheckCount++;
              
              // Simulate different types of failures
              if (healthCheckCount <= failures.length) {
                const failure = failures[healthCheckCount - 1];
                return Promise.reject(new Error(`${failure.type} error`));
              }
              
              // Eventually succeed
              return Promise.resolve({ data: null, error: null });
            })
          })
        })
      });
      
      // Trigger initial failure
      await connectionMonitor.performHealthCheck();
      expect(connectionMonitor.getConnectionStatus().isOnline).toBe(false);
      
      // Simulate progressive recovery attempts
      for (let i = 0; i < failures.length; i++) {
        TimerUtils.advanceTimersByTime(Math.pow(2, i) * 1000); // Exponential backoff
      }
      
      // Final successful recovery
      TimerUtils.advanceTimersByTime(8000);
      
      // Verify recovery sequence
      expect(failureEvents.length).toBeGreaterThan(0);
      expect(recoveryEvents.length).toBeGreaterThan(0);
      expect(connectionMonitor.getConnectionStatus().isOnline).toBe(true);
    });

    it('should recover from network failure with exponential backoff', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.startReconnection();

      // Set up reconnection callback
      const reconnectedCallback = vi.fn();
      connectionMonitor.onReconnected(reconnectedCallback);

      // Simulate initial failure
      let healthCheckCount = 0;
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              healthCheckCount++;
              if (healthCheckCount <= 3) {
                return Promise.reject(ErrorSimulator.networkError());
              }
              return Promise.resolve({ data: null, error: null });
            })
          })
        })
      });

      // Perform initial failed check
      await connectionMonitor.performHealthCheck();
      expect(connectionMonitor.getConnectionStatus().isOnline).toBe(false);

      // Advance time to trigger reconnection attempts
      TimerUtils.advanceTimersByTime(1000); // First retry
      TimerUtils.advanceTimersByTime(2000); // Second retry
      TimerUtils.advanceTimersByTime(4000); // Third retry (should succeed)

      // Should eventually reconnect
      expect(connectionMonitor.getConnectionStatus().isOnline).toBe(true);
      expect(reconnectedCallback).toHaveBeenCalled();
      expect(healthCheckCount).toBe(4); // Initial + 3 retries
    });

    it('should handle intermittent connection issues', async () => {
      connectionMonitor.startMonitoring();

      // Simulate intermittent failures
      let healthCheckCount = 0;
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              healthCheckCount++;
              // Fail every other attempt
              if (healthCheckCount % 2 === 1) {
                return Promise.reject(ErrorSimulator.networkError());
              }
              return Promise.resolve({ data: null, error: null });
            })
          })
        })
      });

      // Perform multiple health checks
      for (let i = 0; i < 6; i++) {
        await connectionMonitor.performHealthCheck();
        TimerUtils.advanceTimersByTime(1000);
      }

      // Should handle intermittent failures gracefully
      expect(healthCheckCount).toBe(6);
      expect(connectionMonitor.getConnectionStatus().isOnline).toBe(true);
    });
  });

  describe('API Request Recovery', () => {
    it('should queue and retry failed API requests', async () => {
      const testAction = {
        id: 'test-api-call',
        type: 'api-request',
        payload: { endpoint: '/api/tickets', method: 'GET' },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3
      };

      // Simulate API failure
      const networkError = ErrorSimulator.networkError();
      const context = {
        action: testAction,
        cacheKey: 'tickets-list'
      };

      // Mock cached data
      vi.spyOn(errorRecoveryManager, 'getCachedData').mockResolvedValue(null);
      const queueSpy = vi.spyOn(errorRecoveryManager, 'queueAction');

      try {
        await errorRecoveryManager.handleApiError(networkError, context);
      } catch (error) {
        // Expected to throw since no cached data
      }

      // Should queue the action for retry
      expect(queueSpy).toHaveBeenCalledWith(testAction);

      // Mock successful retry
      vi.spyOn(errorRecoveryManager, 'retryAction').mockResolvedValue({ success: true });

      // Process retry queue
      await errorRecoveryManager.processRetryQueue();

      // Should have attempted retry
      expect(errorRecoveryManager.getRetryQueue('api-request')).toHaveLength(0);
    });

    it('should serve cached data during network failures', async () => {
      const testAction = {
        id: 'test-cached-call',
        type: 'api-request',
        payload: { endpoint: '/api/user-profile' },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3
      };

      const cachedData = { user: { id: '123', name: 'Test User' } };
      const networkError = ErrorSimulator.networkError();
      const context = {
        action: testAction,
        cacheKey: 'user-profile'
      };

      // Mock cached data availability
      vi.spyOn(errorRecoveryManager, 'getCachedData').mockResolvedValue(cachedData);

      const result = await errorRecoveryManager.handleApiError(networkError, context);

      // Should return cached data
      expect(result).toEqual(cachedData);
    });

    it('should handle authentication errors during recovery', async () => {
      const testAction = {
        id: 'test-auth-call',
        type: 'api-request',
        payload: { endpoint: '/api/protected-resource' },
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3
      };

      const authError = ErrorSimulator.authError();
      const context = {
        action: testAction,
        cacheKey: 'protected-resource'
      };

      // Mock session manager
      const mockSessionManager = {
        refreshSession: vi.fn().mockResolvedValue(true)
      };
      vi.doMock('../../services/SessionManager', () => ({
        SessionManager: vi.fn().mockImplementation(() => mockSessionManager)
      }));

      // Mock successful retry after auth refresh
      vi.spyOn(errorRecoveryManager, 'retryAction').mockResolvedValue({ success: true });

      const result = await errorRecoveryManager.handleApiError(authError, context);

      // Should refresh session and retry
      expect(mockSessionManager.refreshSession).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe('Offline Mode Integration', () => {
    it('should transition to offline mode and queue operations', async () => {
      await offlineManager.initialize();
      connectionMonitor.startMonitoring();

      // Set up offline detection
      const offlineCallback = vi.fn();
      connectionMonitor.onConnectionLost(offlineCallback);

      // Go offline
      connectionSimulator.setOnline(false);
      await offlineManager.handleOffline();

      expect(offlineCallback).toHaveBeenCalled();
      expect(offlineManager.isOffline()).toBe(true);

      // Queue some operations while offline
      const operations = [
        { type: 'create-ticket', data: { title: 'Offline ticket 1' } },
        { type: 'update-ticket', data: { id: '123', status: 'resolved' } },
        { type: 'delete-ticket', data: { id: '456' } }
      ];

      for (const operation of operations) {
        await offlineManager.queueOperation(operation);
      }

      // Verify operations are queued
      const queuedOps = await offlineManager.getQueuedOperations();
      expect(queuedOps).toHaveLength(3);
    });

    it('should sync queued operations when coming back online', async () => {
      await offlineManager.initialize();
      connectionMonitor.startMonitoring();

      // Start offline with queued operations
      connectionSimulator.setOnline(false);
      await offlineManager.handleOffline();

      const operations = [
        { type: 'create-ticket', data: { title: 'Sync test 1' } },
        { type: 'create-ticket', data: { title: 'Sync test 2' } }
      ];

      for (const operation of operations) {
        await offlineManager.queueOperation(operation);
      }

      // Come back online
      connectionSimulator.setOnline(true);
      
      // Mock successful API calls for sync
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

      // Verify operations were synced
      const remainingOps = await offlineManager.getQueuedOperations();
      expect(remainingOps).toHaveLength(0);
    });

    it('should handle sync conflicts during online transition', async () => {
      await offlineManager.initialize();

      // Queue conflicting operations
      const operations = [
        { 
          type: 'update-ticket', 
          data: { id: '123', title: 'Offline update', version: 1 } 
        }
      ];

      for (const operation of operations) {
        await offlineManager.queueOperation(operation);
      }

      // Mock conflict during sync (version mismatch)
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { code: 'CONFLICT', message: 'Version mismatch' } 
        }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { id: '123', title: 'Server update', version: 2 },
              error: null 
            })
          })
        })
      });

      // Mock conflict resolution
      const conflictResolver = vi.fn().mockResolvedValue({
        resolution: 'merge',
        data: { id: '123', title: 'Merged update', version: 3 }
      });

      vi.spyOn(offlineManager, 'resolveConflict').mockImplementation(conflictResolver);

      await offlineManager.syncQueuedOperations();

      // Should have attempted conflict resolution
      expect(conflictResolver).toHaveBeenCalled();
    });
  });

  describe('Data Synchronization', () => {
    it('should maintain data consistency during connection recovery', async () => {
      await offlineManager.initialize();
      connectionMonitor.startMonitoring();

      // Start with some cached data
      const initialData = [
        { id: '1', title: 'Ticket 1', status: 'open' },
        { id: '2', title: 'Ticket 2', status: 'closed' }
      ];

      await offlineManager.cacheData('tickets', initialData);

      // Go offline and make local changes
      connectionSimulator.setOnline(false);
      await offlineManager.handleOffline();

      // Queue local modifications
      await offlineManager.queueOperation({
        type: 'update-ticket',
        data: { id: '1', status: 'in-progress' }
      });

      await offlineManager.queueOperation({
        type: 'create-ticket',
        data: { id: '3', title: 'New ticket', status: 'open' }
      });

      // Come back online
      connectionSimulator.setOnline(true);

      // Mock server responses
      mockSupabase.from.mockReturnValue({
        update: vi.fn().mockResolvedValue({ data: {}, error: null }),
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      await offlineManager.handleOnline();
      await offlineManager.syncQueuedOperations();

      // Verify data consistency
      const syncedData = await offlineManager.getCachedData('tickets');
      expect(syncedData).toBeDefined();
    });

    it('should handle partial sync failures gracefully', async () => {
      await offlineManager.initialize();

      // Queue multiple operations
      const operations = [
        { type: 'create-ticket', data: { title: 'Success 1' } },
        { type: 'create-ticket', data: { title: 'Failure' } },
        { type: 'create-ticket', data: { title: 'Success 2' } }
      ];

      for (const operation of operations) {
        await offlineManager.queueOperation(operation);
      }

      // Mock partial failure
      let callCount = 0;
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 2) {
            return Promise.resolve({ 
              data: null, 
              error: { message: 'Server error' } 
            });
          }
          return Promise.resolve({ data: {}, error: null });
        }),
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      await offlineManager.syncQueuedOperations();

      // Should have one failed operation remaining in queue
      const remainingOps = await offlineManager.getQueuedOperations();
      expect(remainingOps).toHaveLength(1);
      expect(remainingOps[0].data.title).toBe('Failure');
    });
  });

  describe('Performance During Recovery', () => {
    it('should handle recovery operations efficiently', async () => {
      connectionMonitor.startMonitoring();
      await offlineManager.initialize();

      // Queue many operations
      const operations = Array(50).fill(null).map((_, i) => ({
        type: 'create-item',
        data: { id: i, title: `Item ${i}` }
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

      const startTime = Date.now();
      await offlineManager.syncQueuedOperations();
      const endTime = Date.now();

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds

      // All operations should be processed
      const remainingOps = await offlineManager.getQueuedOperations();
      expect(remainingOps).toHaveLength(0);
    });

    it('should throttle reconnection attempts to prevent overwhelming', async () => {
      connectionMonitor.startMonitoring();
      autoReconnectionService.startReconnection();

      // Mock persistent failures
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(ErrorSimulator.networkError())
          })
        })
      });

      const startTime = Date.now();

      // Trigger multiple failed attempts
      for (let i = 0; i < 10; i++) {
        await connectionMonitor.performHealthCheck();
        TimerUtils.advanceTimersByTime(1000);
      }

      const endTime = Date.now();

      // Should have throttled attempts (not immediate retries)
      expect(endTime - startTime).toBeGreaterThan(0);
      
      // Should not exceed maximum attempts
      const status = connectionMonitor.getConnectionStatus();
      expect(status.reconnectAttempts).toBeLessThanOrEqual(5);
    });
  });

  describe('Error Recovery Edge Cases', () => {
    it('should handle recovery when storage is unavailable', async () => {
      // Mock storage failures
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage unavailable');
      });

      mockIndexedDB.open.mockRejectedValue(new Error('IndexedDB unavailable'));

      await offlineManager.initialize();

      // Should still function with in-memory fallback
      await offlineManager.queueOperation({
        type: 'test-operation',
        data: { test: 'data' }
      });

      const queuedOps = await offlineManager.getQueuedOperations();
      expect(queuedOps).toHaveLength(1);
    });

    it('should recover from corrupted offline data', async () => {
      // Set up corrupted data
      mockLocalStorage.getItem.mockReturnValue('corrupted-json{invalid');

      await offlineManager.initialize();

      // Should handle corruption gracefully
      const queuedOps = await offlineManager.getQueuedOperations();
      expect(queuedOps).toEqual([]);

      // Should still be able to queue new operations
      await offlineManager.queueOperation({
        type: 'recovery-test',
        data: { recovered: true }
      });

      const newOps = await offlineManager.getQueuedOperations();
      expect(newOps).toHaveLength(1);
    });

    it('should handle simultaneous connection recovery and user actions', async () => {
      connectionMonitor.startMonitoring();
      await offlineManager.initialize();

      // Start offline
      connectionSimulator.setOnline(false);
      await offlineManager.handleOffline();

      // Queue operation while offline
      await offlineManager.queueOperation({
        type: 'offline-action',
        data: { action: 'test' }
      });

      // Simulate coming online while user is still performing actions
      connectionSimulator.setOnline(true);
      
      // Add more operations during recovery
      const recoveryPromise = offlineManager.handleOnline();
      
      await offlineManager.queueOperation({
        type: 'during-recovery',
        data: { action: 'concurrent' }
      });

      await recoveryPromise;

      // Mock successful sync
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      await offlineManager.syncQueuedOperations();

      // Should handle all operations correctly
      const remainingOps = await offlineManager.getQueuedOperations();
      expect(remainingOps).toHaveLength(0);
    });
  });
});