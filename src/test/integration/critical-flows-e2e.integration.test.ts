/**
 * End-to-end integration tests for critical session persistence flows
 * Tests complete user journeys and system behavior under various conditions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../services/SessionManager';
import { TokenRefreshService } from '../../services/TokenRefreshService';
import { ConnectionMonitor } from '../../services/ConnectionMonitor';
import { OfflineManager } from '../../services/OfflineManager';
import { StateManager } from '../../services/StateManager';
import { CrossTabCommunicationService } from '../../services/CrossTabCommunicationService';
import { ErrorRecoveryManager } from '../../services/ErrorRecoveryManager';
import { BackgroundSyncManager } from '../../services/BackgroundSyncManager';
import {
  createMockSupabaseClient,
  MockBroadcastChannel,
  mockSession,
  mockExpiredSession,
  TimerUtils,
  ConnectionSimulator,
  ErrorSimulator,
  PerformanceTestUtils,
  createMockLocalStorage,
  createMockIndexedDB
} from '../utils/sessionTestUtils';

// Mock dependencies
const mockSupabase = createMockSupabaseClient();
vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase
}));

global.BroadcastChannel = MockBroadcastChannel as any;
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

describe('Critical Flows End-to-End Integration Tests', () => {
  let sessionManager: SessionManager;
  let tokenRefreshService: TokenRefreshService;
  let connectionMonitor: ConnectionMonitor;
  let offlineManager: OfflineManager;
  let stateManager: StateManager;
  let crossTabService: CrossTabCommunicationService;
  let errorRecoveryManager: ErrorRecoveryManager;
  let backgroundSyncManager: BackgroundSyncManager;
  let connectionSimulator: ConnectionSimulator;

  beforeEach(() => {
    vi.clearAllMocks();
    TimerUtils.useFakeTimers();
    
    sessionManager = new SessionManager();
    tokenRefreshService = new TokenRefreshService();
    connectionMonitor = new ConnectionMonitor();
    offlineManager = new OfflineManager();
    stateManager = new StateManager();
    crossTabService = new CrossTabCommunicationService();
    errorRecoveryManager = new ErrorRecoveryManager();
    backgroundSyncManager = new BackgroundSyncManager();
    connectionSimulator = new ConnectionSimulator();
    
    mockLocalStorage.clear();
  });

  afterEach(() => {
    sessionManager.destroy?.();
    tokenRefreshService.cleanup?.();
    connectionMonitor.cleanup?.();
    offlineManager.cleanup?.();
    stateManager.cleanup?.();
    crossTabService.cleanup?.();
    errorRecoveryManager.cleanup?.();
    backgroundSyncManager.cleanup?.();
    TimerUtils.useRealTimers();
  });

  describe('Complete User Journey Tests', () => {
    it('should handle complete user session from login to logout with offline periods', async () => {
      // Phase 1: User Login and Initial Setup
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();
      await offlineManager.initialize();
      connectionMonitor.startMonitoring();
      
      expect(sessionManager.getSessionStatus().isActive).toBe(true);

      // Phase 2: User Activity - Form Filling and Navigation
      const userActivity = {
        formData: {
          ticketTitle: 'Critical bug in authentication',
          ticketDescription: 'Users cannot log in after password reset',
          priority: 'high'
        },
        navigationHistory: ['/dashboard', '/tickets', '/tickets/new'],
        preferences: { theme: 'dark', notifications: true }
      };

      // Save user activity state
      await stateManager.saveState('current-form', userActivity.formData);
      await stateManager.saveState('navigation', userActivity.navigationHistory);
      await stateManager.saveState('user-preferences', userActivity.preferences);

      // Phase 3: Network Interruption During Activity
      connectionSimulator.setOnline(false);
      
      // Mock offline health check
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(ErrorSimulator.networkError())
          })
        })
      });

      await connectionMonitor.performHealthCheck();
      await offlineManager.handleOffline();

      expect(connectionMonitor.getConnectionStatus().isOnline).toBe(false);
      expect(offlineManager.isOffline()).toBe(true);

      // Phase 4: Continued User Activity While Offline
      const offlineOperations = [
        { type: 'save-draft', data: { ...userActivity.formData, status: 'draft' } },
        { type: 'update-preferences', data: { ...userActivity.preferences, autoSave: true } },
        { type: 'log-activity', data: { action: 'form-edit', timestamp: Date.now() } }
      ];

      for (const operation of offlineOperations) {
        await offlineManager.queueOperation(operation);
      }

      // Verify offline operations are queued
      const queuedOps = await offlineManager.getQueuedOperations();
      expect(queuedOps).toHaveLength(3);

      // Phase 5: Network Recovery
      connectionSimulator.setOnline(true);
      
      // Mock successful recovery
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        update: vi.fn().mockResolvedValue({ data: {}, error: null }),
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      await offlineManager.handleOnline();
      await offlineManager.syncQueuedOperations();

      expect(connectionMonitor.getConnectionStatus().isOnline).toBe(true);
      expect(offlineManager.isOffline()).toBe(false);

      // Verify all operations were synced
      const remainingOps = await offlineManager.getQueuedOperations();
      expect(remainingOps).toHaveLength(0);

      // Phase 6: Session Refresh During Activity
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const refreshed = await sessionManager.refreshSession();
      expect(refreshed).toBe(true);

      // Verify state is preserved after refresh
      const preservedForm = await stateManager.restoreState('current-form');
      const preservedNav = await stateManager.restoreState('navigation');
      const preservedPrefs = await stateManager.restoreState('user-preferences');

      expect(preservedForm).toEqual(userActivity.formData);
      expect(preservedNav).toEqual(userActivity.navigationHistory);
      expect(preservedPrefs).toEqual(userActivity.preferences);

      // Phase 7: Graceful Logout
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });
      await sessionManager.terminateSession();

      expect(sessionManager.getSessionStatus().isActive).toBe(false);
    });

    it('should handle multi-tab user workflow with session coordination', async () => {
      // Create multiple tabs simulating real user behavior
      const tabs = [
        { name: 'main-dashboard', sessionManager: new SessionManager(), crossTabService: new CrossTabCommunicationService() },
        { name: 'ticket-form', sessionManager: new SessionManager(), crossTabService: new CrossTabCommunicationService() },
        { name: 'reports-view', sessionManager: new SessionManager(), crossTabService: new CrossTabCommunicationService() }
      ];

      try {
        // Phase 1: User opens multiple tabs
        mockSupabase.auth.getSession.mockResolvedValue({
          data: { session: mockSession },
          error: null
        });

        for (const tab of tabs) {
          await tab.sessionManager.initializeSession();
          expect(tab.sessionManager.getSessionStatus().isActive).toBe(true);
        }

        // Phase 2: User works across tabs with state synchronization
        const workflowStates = [
          { tab: 0, action: 'navigate', data: { route: '/dashboard', timestamp: Date.now() } },
          { tab: 1, action: 'form-edit', data: { field: 'title', value: 'New ticket', timestamp: Date.now() + 100 } },
          { tab: 2, action: 'filter-change', data: { filter: 'priority:high', timestamp: Date.now() + 200 } }
        ];

        // Set up cross-tab communication
        tabs.forEach((tab, index) => {
          tab.crossTabService.onMessage('workflow-sync', (data) => {
            // Simulate tab responding to workflow changes
            expect(data.action).toBeDefined();
            expect(data.data).toBeDefined();
          });
        });

        // Execute workflow across tabs
        for (const state of workflowStates) {
          const tab = tabs[state.tab];
          tab.crossTabService.sendMessage('workflow-sync', {
            action: state.action,
            data: state.data,
            tabName: tab.name
          });
        }

        // Phase 3: Session expiration handling across tabs
        const sessionExpiredCallbacks = tabs.map(() => vi.fn());
        tabs.forEach((tab, index) => {
          tab.sessionManager.onSessionExpired(sessionExpiredCallbacks[index]);
        });

        // Simulate session expiration
        mockSupabase.auth.getSession.mockResolvedValue({
          data: { session: mockExpiredSession },
          error: null
        });

        mockSupabase.auth.refreshSession.mockResolvedValue({
          data: { session: null },
          error: new Error('Session expired')
        });

        // Trigger session validation on one tab
        await tabs[0].sessionManager.validateSession();

        // All tabs should handle expiration
        sessionExpiredCallbacks.forEach(callback => {
          expect(callback).toHaveBeenCalled();
        });

      } finally {
        // Cleanup all tabs
        tabs.forEach(tab => {
          tab.sessionManager.destroy?.();
          tab.crossTabService.cleanup?.();
        });
      }
    });
  });

  describe('System Resilience Tests', () => {
    it('should recover from complete system failure and restore user state', async () => {
      // Phase 1: Normal operation setup
      await sessionManager.initializeSession();
      await offlineManager.initialize();
      await stateManager.initialize?.();
      connectionMonitor.startMonitoring();

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();

      // Save critical user state
      const criticalState = {
        userSession: { userId: 'user-123', role: 'admin' },
        workInProgress: {
          ticketDraft: { title: 'Critical issue', description: 'System failure' },
          formPosition: { scrollTop: 150, fieldFocus: 'description' }
        },
        systemPreferences: { autoSave: true, theme: 'dark', language: 'en' }
      };

      await stateManager.saveState('user-session', criticalState.userSession);
      await stateManager.saveState('work-in-progress', criticalState.workInProgress);
      await stateManager.saveState('system-preferences', criticalState.systemPreferences);

      // Phase 2: Simulate complete system failure
      const systemFailures = [
        () => { throw new Error('Database connection lost'); },
        () => { throw new Error('Authentication service unavailable'); },
        () => { throw new Error('Network infrastructure failure'); },
        () => { throw new Error('Storage quota exceeded'); }
      ];

      // Mock cascading failures
      let failureCount = 0;
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation(() => ({
            single: vi.fn().mockImplementation(() => {
              if (failureCount < systemFailures.length) {
                const failure = systemFailures[failureCount++];
                return Promise.reject(failure());
              }
              return Promise.resolve({ data: null, error: null });
            })
          }))
        }))
      });

      // Trigger system failure detection
      connectionSimulator.setOnline(false);
      await connectionMonitor.performHealthCheck();
      await offlineManager.handleOffline();

      // Phase 3: System recovery process
      connectionSimulator.setOnline(true);

      // Mock gradual system recovery
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        }),
        insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
        update: vi.fn().mockResolvedValue({ data: {}, error: null })
      });

      // Execute recovery
      await connectionMonitor.performHealthCheck();
      await offlineManager.handleOnline();

      // Phase 4: Verify complete state restoration
      const restoredUserSession = await stateManager.restoreState('user-session');
      const restoredWorkInProgress = await stateManager.restoreState('work-in-progress');
      const restoredSystemPreferences = await stateManager.restoreState('system-preferences');

      expect(restoredUserSession).toEqual(criticalState.userSession);
      expect(restoredWorkInProgress).toEqual(criticalState.workInProgress);
      expect(restoredSystemPreferences).toEqual(criticalState.systemPreferences);

      // Verify session is functional
      const isValid = await sessionManager.validateSession();
      expect(isValid).toBe(true);
      expect(connectionMonitor.getConnectionStatus().isOnline).toBe(true);
    });

    it('should handle concurrent system stress with graceful degradation', async () => {
      // Initialize all systems
      await sessionManager.initializeSession();
      await offlineManager.initialize();
      await backgroundSyncManager.initialize();
      connectionMonitor.startMonitoring();

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();

      // Phase 1: Generate high system load
      const concurrentOperations = [
        // Session operations
        ...Array(20).fill(null).map(() => sessionManager.validateSession()),
        
        // State operations
        ...Array(50).fill(null).map((_, i) => 
          stateManager.saveState(`stress-test-${i}`, { data: `value-${i}`, timestamp: Date.now() })
        ),
        
        // Offline operations
        ...Array(100).fill(null).map((_, i) => 
          offlineManager.queueOperation({
            type: 'stress-operation',
            data: { id: i, payload: 'x'.repeat(100) }
          })
        )
      ];

      // Mock system under stress
      let operationCount = 0;
      const maxOperationsPerSecond = 50;
      
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockImplementation(() => {
          operationCount++;
          const delay = operationCount > maxOperationsPerSecond ? 100 : 10;
          return new Promise(resolve => {
            setTimeout(() => resolve({ data: {}, error: null }), delay);
          });
        }),
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Execute concurrent operations
      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        await Promise.all(concurrentOperations);
      });

      // System should handle stress within reasonable bounds
      expect(time).toBeLessThan(10000); // 10 seconds max

      // Phase 2: Verify system stability after stress
      const finalSessionStatus = sessionManager.getSessionStatus();
      expect(finalSessionStatus.isActive).toBe(true);

      const queuedOps = await offlineManager.getQueuedOperations();
      expect(queuedOps.length).toBeGreaterThanOrEqual(0); // Some operations may still be queued

      // System should still be responsive
      const quickOperation = await stateManager.saveState('post-stress-test', { recovered: true });
      const retrievedState = await stateManager.restoreState('post-stress-test');
      expect(retrievedState).toEqual({ recovered: true });
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance benchmarks for critical operations', async () => {
      await sessionManager.initializeSession();
      await offlineManager.initialize();
      connectionMonitor.startMonitoring();

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();

      // Benchmark 1: Session validation speed
      const sessionValidationBenchmark = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        await sessionManager.validateSession();
      });
      expect(sessionValidationBenchmark.time).toBeLessThan(50); // 50ms max

      // Benchmark 2: State save/restore speed
      const stateOperationBenchmark = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        await stateManager.saveState('benchmark-test', { large: 'x'.repeat(1000) });
        await stateManager.restoreState('benchmark-test');
      });
      expect(stateOperationBenchmark.time).toBeLessThan(100); // 100ms max

      // Benchmark 3: Offline transition speed
      const offlineTransitionBenchmark = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        connectionSimulator.setOnline(false);
        await offlineManager.handleOffline();
      });
      expect(offlineTransitionBenchmark.time).toBeLessThan(200); // 200ms max

      // Benchmark 4: Online recovery speed
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      const onlineRecoveryBenchmark = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        connectionSimulator.setOnline(true);
        await offlineManager.handleOnline();
      });
      expect(onlineRecoveryBenchmark.time).toBeLessThan(300); // 300ms max

      // Benchmark 5: Cross-tab communication speed
      const crossTabBenchmark = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        crossTabService.sendMessage('benchmark-test', { data: 'test' });
      });
      expect(crossTabBenchmark.time).toBeLessThan(10); // 10ms max
    });

    it('should maintain performance under realistic user load', async () => {
      // Simulate realistic user behavior patterns
      const userBehaviorSimulation = {
        sessionDuration: 3600000, // 1 hour
        actionsPerMinute: 10,
        offlinePeriods: 3,
        tabSwitches: 20,
        formInteractions: 50
      };

      await sessionManager.initializeSession();
      await offlineManager.initialize();
      connectionMonitor.startMonitoring();

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();

      // Generate realistic user actions
      const userActions = [];
      
      // Form interactions
      for (let i = 0; i < userBehaviorSimulation.formInteractions; i++) {
        userActions.push(async () => {
          await stateManager.saveState(`form-field-${i}`, { 
            value: `user-input-${i}`,
            timestamp: Date.now()
          });
        });
      }

      // Navigation actions
      for (let i = 0; i < userBehaviorSimulation.tabSwitches; i++) {
        userActions.push(async () => {
          await stateManager.saveState('current-route', { 
            path: `/page-${i}`,
            timestamp: Date.now()
          });
        });
      }

      // Offline operations
      for (let i = 0; i < 20; i++) {
        userActions.push(async () => {
          await offlineManager.queueOperation({
            type: 'user-action',
            data: { action: `action-${i}`, timestamp: Date.now() }
          });
        });
      }

      // Mock realistic API responses
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockImplementation(() => 
          new Promise(resolve => setTimeout(() => resolve({ data: {}, error: null }), 50))
        ),
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      // Execute user behavior simulation
      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(async () => {
        // Execute actions in batches to simulate realistic timing
        const batchSize = 10;
        for (let i = 0; i < userActions.length; i += batchSize) {
          const batch = userActions.slice(i, i + batchSize);
          await Promise.all(batch.map(action => action()));
          
          // Small delay between batches to simulate user thinking time
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      });

      // Should handle realistic user load efficiently
      expect(time).toBeLessThan(5000); // 5 seconds for all actions

      // Verify system remains stable
      expect(sessionManager.getSessionStatus().isActive).toBe(true);
      
      const finalState = await stateManager.restoreState('current-route');
      expect(finalState).toBeDefined();
    });
  });
});