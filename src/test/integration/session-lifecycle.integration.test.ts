/**
 * Integration tests for complete session lifecycle management
 * Tests end-to-end session flows from initialization to termination
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../services/SessionManager';
import { TokenRefreshService } from '../../services/TokenRefreshService';
import { ConnectionMonitor } from '../../services/ConnectionMonitor';
import { StateManager } from '../../services/StateManager';
import {
  createMockSupabaseClient,
  MockBroadcastChannel,
  mockSession,
  mockExpiredSession,
  mockExpiringSession,
  TimerUtils,
  ConnectionSimulator,
  createMockLocalStorage
} from '../utils/sessionTestUtils';

// Mock dependencies
vi.mock('../../lib/supabase', () => ({
  supabase: createMockSupabaseClient()
}));

global.BroadcastChannel = MockBroadcastChannel as any;
const mockLocalStorage = createMockLocalStorage();
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

describe('Session Lifecycle Integration Tests', () => {
  let sessionManager: SessionManager;
  let tokenRefreshService: TokenRefreshService;
  let connectionMonitor: ConnectionMonitor;
  let stateManager: StateManager;
  let connectionSimulator: ConnectionSimulator;

  beforeEach(() => {
    vi.clearAllMocks();
    TimerUtils.useFakeTimers();
    
    sessionManager = new SessionManager();
    tokenRefreshService = new TokenRefreshService();
    connectionMonitor = new ConnectionMonitor();
    stateManager = new StateManager();
    connectionSimulator = new ConnectionSimulator();
    
    mockLocalStorage.clear();
  });

  afterEach(() => {
    sessionManager.destroy?.();
    tokenRefreshService.cleanup?.();
    connectionMonitor.cleanup?.();
    stateManager.cleanup?.();
    TimerUtils.useRealTimers();
  });

  describe('Complete Session Lifecycle', () => {
    it('should handle full session lifecycle from login to logout', async () => {
      // 1. Initialize session
      const { supabase } = await import('../../lib/supabase');
      (supabase.auth.getSession as any).mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();
      expect(sessionManager.getSessionStatus().isActive).toBe(true);

      // 2. Validate session
      const isValid = await sessionManager.validateSession();
      expect(isValid).toBe(true);

      // 3. Refresh session
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const refreshed = await sessionManager.refreshSession();
      expect(refreshed).toBe(true);

      // 4. Terminate session
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });
      await sessionManager.terminateSession();
      
      expect(sessionManager.getSessionStatus().isActive).toBe(false);
    });

    it('should handle complete session lifecycle with state persistence', async () => {
      // Initialize session with user data
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();
      
      // Save application state during active session
      const userState = {
        preferences: { theme: 'dark', language: 'en' },
        currentWorkspace: 'workspace-123',
        recentItems: ['item1', 'item2', 'item3']
      };
      
      await stateManager.saveState('user-preferences', userState);
      
      // Simulate session activity and monitoring
      sessionManager.startSessionMonitoring();
      
      // Advance time to simulate session activity
      TimerUtils.advanceTimersByTime(60000); // 1 minute
      
      // Verify session is still active and state is preserved
      expect(sessionManager.getSessionStatus().isActive).toBe(true);
      const preservedState = await stateManager.restoreState('user-preferences');
      expect(preservedState).toEqual(userState);
      
      // Graceful logout with state cleanup
      await sessionManager.terminateSession();
      expect(sessionManager.getSessionStatus().isActive).toBe(false);
    });

    it('should handle session lifecycle with multiple authentication attempts', async () => {
      // First attempt - failed authentication
      mockSupabase.auth.getSession.mockResolvedValueOnce({
        data: { session: null },
        error: new Error('Authentication failed')
      });

      let sessionInitialized = false;
      try {
        await sessionManager.initializeSession();
        sessionInitialized = true;
      } catch (error) {
        expect(error.message).toBe('Authentication failed');
      }
      
      expect(sessionInitialized).toBe(false);
      expect(sessionManager.getSessionStatus().isActive).toBe(false);

      // Second attempt - successful authentication
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();
      expect(sessionManager.getSessionStatus().isActive).toBe(true);

      // Verify session can be used normally after failed attempt
      const isValid = await sessionManager.validateSession();
      expect(isValid).toBe(true);
    });

    it('should handle session expiration and automatic refresh', async () => {
      // Start with expiring session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockExpiringSession },
        error: null
      });

      await sessionManager.initializeSession();
      sessionManager.startSessionMonitoring();

      // Mock successful refresh
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Advance time to trigger expiration check
      TimerUtils.advanceTimersByTime(30000); // 30 seconds

      // Should have attempted refresh
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalled();
    });

    it('should handle session expiration with failed refresh', async () => {
      // Start with expired session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockExpiredSession },
        error: null
      });

      // Mock failed refresh
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Refresh failed')
      });

      const sessionExpiredCallback = vi.fn();
      sessionManager.onSessionExpired(sessionExpiredCallback);

      await sessionManager.initializeSession();
      const isValid = await sessionManager.validateSession();

      expect(isValid).toBe(false);
      expect(sessionExpiredCallback).toHaveBeenCalled();
    });
  });

  describe('Cross-Tab Session Synchronization', () => {
    it('should synchronize session state across multiple tabs', async () => {
      // Create multiple session managers (simulating different tabs)
      const sessionManager1 = new SessionManager();
      const sessionManager2 = new SessionManager();
      const tokenRefreshService1 = new TokenRefreshService();
      const tokenRefreshService2 = new TokenRefreshService();

      try {
        // Initialize first tab
        mockSupabase.auth.getSession.mockResolvedValue({
          data: { session: mockSession },
          error: null
        });

        await sessionManager1.initializeSession();

        // Set up token update listener on second tab
        const tokenUpdateCallback = vi.fn();
        tokenRefreshService2.onTokensUpdated(tokenUpdateCallback);

        // Refresh tokens on first tab
        mockSupabase.auth.refreshSession.mockResolvedValue({
          data: { session: mockSession },
          error: null
        });

        await tokenRefreshService1.refreshTokens();

        // Second tab should receive token update
        expect(tokenUpdateCallback).toHaveBeenCalledWith(
          expect.objectContaining({
            accessToken: mockSession.access_token,
            refreshToken: mockSession.refresh_token
          })
        );
      } finally {
        sessionManager1.destroy?.();
        sessionManager2.destroy?.();
        tokenRefreshService1.cleanup?.();
        tokenRefreshService2.cleanup?.();
      }
    });

    it('should handle logout synchronization across tabs', async () => {
      const sessionManager1 = new SessionManager();
      const sessionManager2 = new SessionManager();

      try {
        // Initialize both tabs
        mockSupabase.auth.getSession.mockResolvedValue({
          data: { session: mockSession },
          error: null
        });

        await sessionManager1.initializeSession();
        await sessionManager2.initializeSession();

        // Set up expired callback on second tab
        const sessionExpiredCallback = vi.fn();
        sessionManager2.onSessionExpired(sessionExpiredCallback);

        // Logout from first tab
        mockSupabase.auth.signOut.mockResolvedValue({ error: null });
        await sessionManager1.terminateSession();

        // Simulate auth state change broadcast
        const authStateChangeCallback = mockSupabase.auth.onAuthStateChange.mock.calls[0]?.[0];
        if (authStateChangeCallback) {
          authStateChangeCallback('SIGNED_OUT', null);
        }

        // Second tab should handle the logout
        expect(sessionExpiredCallback).toHaveBeenCalled();
      } finally {
        sessionManager1.destroy?.();
        sessionManager2.destroy?.();
      }
    });
  });

  describe('Connection Recovery Integration', () => {
    it('should handle connection loss and recovery with session persistence', async () => {
      // Initialize session and connection monitoring
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();
      connectionMonitor.startMonitoring();

      // Save some application state
      await stateManager.saveState('user-data', { currentPage: '/dashboard' });

      // Simulate connection loss
      connectionSimulator.setOnline(false);
      
      // Mock health check failure
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockRejectedValue(new Error('Network error'))
          })
        })
      });

      await connectionMonitor.performHealthCheck();
      expect(connectionMonitor.getConnectionStatus().isOnline).toBe(false);

      // Simulate connection recovery
      connectionSimulator.setOnline(true);
      
      // Mock successful health check
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      await connectionMonitor.performHealthCheck();
      expect(connectionMonitor.getConnectionStatus().isOnline).toBe(true);

      // Verify session is still valid
      const isValid = await sessionManager.validateSession();
      expect(isValid).toBe(true);

      // Verify state is preserved
      const restoredState = await stateManager.restoreState('user-data');
      expect(restoredState).toEqual({ currentPage: '/dashboard' });
    });

    it('should handle session refresh during connection issues', async () => {
      // Initialize with expiring session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockExpiringSession },
        error: null
      });

      await sessionManager.initializeSession();
      connectionMonitor.startMonitoring();

      // Simulate intermittent connection
      let callCount = 0;
      mockSupabase.auth.refreshSession.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          data: { session: mockSession },
          error: null
        });
      });

      // Attempt refresh (should retry on failure)
      const refreshed = await sessionManager.refreshSession();
      expect(refreshed).toBe(true);
      expect(callCount).toBe(2); // Should have retried
    });
  });

  describe('State Persistence During Session Changes', () => {
    it('should preserve application state during session refresh', async () => {
      // Initialize session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();

      // Save application state
      const appState = {
        currentRoute: '/tickets/123',
        formData: { title: 'Test ticket', description: 'Test description' },
        scrollPosition: 150
      };

      await stateManager.saveState('app-state', appState);

      // Refresh session
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.refreshSession();

      // Verify state is preserved
      const restoredState = await stateManager.restoreState('app-state');
      expect(restoredState).toEqual(appState);
    });

    it('should handle form auto-save during session expiration', async () => {
      // Set up form auto-save
      const mockForm = {
        id: 'ticket-form',
        elements: [
          { name: 'title', value: 'Auto-saved title' },
          { name: 'description', value: 'Auto-saved description' }
        ]
      } as any;

      vi.spyOn(document, 'getElementById').mockReturnValue(mockForm);
      global.FormData = vi.fn().mockImplementation(() => ({
        entries: vi.fn().mockReturnValue([
          ['title', 'Auto-saved title'],
          ['description', 'Auto-saved description']
        ])
      }));

      stateManager.enableAutoSave('ticket-form', 1000);

      // Initialize session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();

      // Trigger auto-save
      TimerUtils.advanceTimersByTime(1000);

      // Simulate session expiration
      const sessionExpiredCallback = vi.fn();
      sessionManager.onSessionExpired(sessionExpiredCallback);

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      await sessionManager.validateSession();

      // Verify form data was saved
      const savedFormData = await stateManager.restoreFormData('ticket-form');
      expect(savedFormData).toEqual({
        title: 'Auto-saved title',
        description: 'Auto-saved description'
      });
    });
  });

  describe('Performance Under Load', () => {
    it('should handle multiple concurrent session operations efficiently', async () => {
      // Initialize session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();

      // Mock successful operations
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Perform multiple concurrent operations
      const operations = [
        sessionManager.validateSession(),
        sessionManager.refreshSession(),
        stateManager.saveState('key1', { data: 'test1' }),
        stateManager.saveState('key2', { data: 'test2' }),
        stateManager.saveState('key3', { data: 'test3' })
      ];

      const startTime = Date.now();
      const results = await Promise.all(operations);
      const endTime = Date.now();

      // All operations should succeed
      expect(results[0]).toBe(true); // validateSession
      expect(results[1]).toBe(true); // refreshSession

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(1000);
    });

    it('should handle high-frequency token refresh requests', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Make multiple concurrent refresh requests
      const refreshPromises = Array(10).fill(null).map(() => 
        tokenRefreshService.refreshTokens()
      );

      const results = await Promise.all(refreshPromises);

      // All should return the same result
      expect(results.every(result => 
        result.accessToken === mockSession.access_token
      )).toBe(true);

      // Should only make one actual API call (deduplication)
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from cascading failures', async () => {
      // Initialize session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();
      connectionMonitor.startMonitoring();

      // Simulate cascading failures
      let refreshCallCount = 0;
      mockSupabase.auth.refreshSession.mockImplementation(() => {
        refreshCallCount++;
        if (refreshCallCount <= 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          data: { session: mockSession },
          error: null
        });
      });

      // Simulate connection issues
      let healthCheckCount = 0;
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockImplementation(() => {
              healthCheckCount++;
              if (healthCheckCount <= 2) {
                return Promise.reject(new Error('Connection error'));
              }
              return Promise.resolve({ data: null, error: null });
            })
          })
        })
      });

      // Attempt operations that should eventually succeed
      const refreshResult = await sessionManager.refreshSession();
      await connectionMonitor.performHealthCheck();

      expect(refreshResult).toBe(true);
      expect(connectionMonitor.getConnectionStatus().isOnline).toBe(true);
      expect(refreshCallCount).toBe(3); // Should have retried
      expect(healthCheckCount).toBe(3); // Should have retried
    });

    it('should maintain data integrity during error recovery', async () => {
      // Save initial state
      const initialState = { data: 'initial', timestamp: Date.now() };
      await stateManager.saveState('recovery-test', initialState);

      // Simulate storage errors during save
      let saveCallCount = 0;
      const originalSetItem = mockLocalStorage.setItem;
      mockLocalStorage.setItem.mockImplementation((key, value) => {
        saveCallCount++;
        if (saveCallCount <= 2 && key.includes('recovery-test')) {
          throw new Error('Storage quota exceeded');
        }
        return originalSetItem(key, value);
      });

      // Attempt to save new state (should eventually succeed)
      const newState = { data: 'updated', timestamp: Date.now() };
      await stateManager.saveState('recovery-test', newState);

      // Verify final state is correct
      const restoredState = await stateManager.restoreState('recovery-test');
      expect(restoredState).toEqual(newState);
    });
  });

  describe('Offline/Online Transitions', () => {
    it('should handle offline to online transition with queued operations', async () => {
      // Initialize session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();
      connectionMonitor.startMonitoring();

      // Go offline
      connectionSimulator.setOnline(false);
      
      // Queue some operations while offline
      const offlineOperations = [
        stateManager.saveState('offline-1', { data: 'test1' }),
        stateManager.saveState('offline-2', { data: 'test2' })
      ];

      await Promise.all(offlineOperations);

      // Come back online
      connectionSimulator.setOnline(true);
      
      // Mock successful health check
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          })
        })
      });

      await connectionMonitor.performHealthCheck();

      // Verify operations completed successfully
      const state1 = await stateManager.restoreState('offline-1');
      const state2 = await stateManager.restoreState('offline-2');

      expect(state1).toEqual({ data: 'test1' });
      expect(state2).toEqual({ data: 'test2' });
    });
  });
});