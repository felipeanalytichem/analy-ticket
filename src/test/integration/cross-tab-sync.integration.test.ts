/**
 * Integration tests for cross-tab synchronization
 * Tests session state sync, token sharing, and multi-tab coordination
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../services/SessionManager';
import { TokenRefreshService } from '../../services/TokenRefreshService';
import { CrossTabCommunicationService } from '../../services/CrossTabCommunicationService';
import { TabSpecificSessionManager } from '../../services/TabSpecificSessionManager';
import {
  createMockSupabaseClient,
  MockBroadcastChannel,
  mockSession,
  mockExpiredSession,
  TimerUtils,
  createMockLocalStorage
} from '../utils/sessionTestUtils';

// Mock dependencies
const mockSupabase = createMockSupabaseClient();
vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase
}));

global.BroadcastChannel = MockBroadcastChannel as any;
const mockLocalStorage = createMockLocalStorage();
Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage,
  writable: true
});

describe('Cross-Tab Synchronization Integration Tests', () => {
  let sessionManager1: SessionManager;
  let sessionManager2: SessionManager;
  let tokenRefreshService1: TokenRefreshService;
  let tokenRefreshService2: TokenRefreshService;
  let crossTabService1: CrossTabCommunicationService;
  let crossTabService2: CrossTabCommunicationService;
  let tabSessionManager1: TabSpecificSessionManager;
  let tabSessionManager2: TabSpecificSessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    TimerUtils.useFakeTimers();
    
    // Create instances for two tabs
    sessionManager1 = new SessionManager();
    sessionManager2 = new SessionManager();
    tokenRefreshService1 = new TokenRefreshService();
    tokenRefreshService2 = new TokenRefreshService();
    crossTabService1 = new CrossTabCommunicationService();
    crossTabService2 = new CrossTabCommunicationService();
    tabSessionManager1 = new TabSpecificSessionManager();
    tabSessionManager2 = new TabSpecificSessionManager();
    
    mockLocalStorage.clear();
  });

  afterEach(() => {
    sessionManager1.destroy?.();
    sessionManager2.destroy?.();
    tokenRefreshService1.cleanup?.();
    tokenRefreshService2.cleanup?.();
    crossTabService1.cleanup?.();
    crossTabService2.cleanup?.();
    tabSessionManager1.cleanup?.();
    tabSessionManager2.cleanup?.();
    TimerUtils.useRealTimers();
  });

  describe('Session State Synchronization', () => {
    it('should synchronize login state across tabs', async () => {
      // Set up session expired callback on tab 2
      const sessionExpiredCallback = vi.fn();
      sessionManager2.onSessionExpired(sessionExpiredCallback);

      // Initialize session on tab 1
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager1.initializeSession();
      expect(sessionManager1.getSessionStatus().isActive).toBe(true);

      // Simulate auth state change broadcast
      const authStateChangeCallback = mockSupabase.auth.onAuthStateChange.mock.calls[0]?.[0];
      if (authStateChangeCallback) {
        authStateChangeCallback('SIGNED_IN', mockSession);
      }

      // Tab 2 should receive the session update
      // In a real scenario, this would be handled by the auth state change listener
      await sessionManager2.initializeSession();
      expect(sessionManager2.getSessionStatus().isActive).toBe(true);
    });

    it('should synchronize logout across all tabs', async () => {
      // Initialize sessions on both tabs
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager1.initializeSession();
      await sessionManager2.initializeSession();

      // Set up session expired callback on tab 2
      const sessionExpiredCallback = vi.fn();
      sessionManager2.onSessionExpired(sessionExpiredCallback);

      // Logout from tab 1
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });
      await sessionManager1.terminateSession();

      // Simulate auth state change broadcast
      const authStateChangeCallback = mockSupabase.auth.onAuthStateChange.mock.calls[1]?.[0];
      if (authStateChangeCallback) {
        authStateChangeCallback('SIGNED_OUT', null);
      }

      // Tab 2 should handle the logout
      expect(sessionExpiredCallback).toHaveBeenCalled();
    });

    it('should handle session expiration across tabs', async () => {
      // Initialize with expiring session
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockExpiredSession },
        error: null
      });

      await sessionManager1.initializeSession();
      await sessionManager2.initializeSession();

      // Set up callbacks
      const expiredCallback1 = vi.fn();
      const expiredCallback2 = vi.fn();
      sessionManager1.onSessionExpired(expiredCallback1);
      sessionManager2.onSessionExpired(expiredCallback2);

      // Mock failed refresh
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Refresh failed')
      });

      // Trigger session validation on tab 1
      await sessionManager1.validateSession();

      // Both tabs should handle expiration
      expect(expiredCallback1).toHaveBeenCalled();
      
      // Simulate broadcast to other tabs
      const authStateChangeCallback = mockSupabase.auth.onAuthStateChange.mock.calls[0]?.[0];
      if (authStateChangeCallback) {
        authStateChangeCallback('SIGNED_OUT', null);
      }
    });
  });

  describe('Token Synchronization', () => {
    it('should synchronize token refresh across tabs', async () => {
      // Set up token update listener on tab 2
      const tokenUpdateCallback = vi.fn();
      tokenRefreshService2.onTokensUpdated(tokenUpdateCallback);

      // Mock successful refresh on tab 1
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Refresh tokens on tab 1
      const tokenPair = await tokenRefreshService1.refreshTokens();

      // Tab 2 should receive the token update
      expect(tokenUpdateCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          accessToken: mockSession.access_token,
          refreshToken: mockSession.refresh_token
        })
      );
    });

    it('should prevent duplicate token refresh across tabs', async () => {
      // Mock successful refresh
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Start concurrent refresh on both tabs
      const refreshPromise1 = tokenRefreshService1.refreshTokens();
      const refreshPromise2 = tokenRefreshService2.refreshTokens();

      const [result1, result2] = await Promise.all([refreshPromise1, refreshPromise2]);

      // Both should get the same result
      expect(result1.accessToken).toBe(mockSession.access_token);
      expect(result2.accessToken).toBe(mockSession.access_token);

      // Should only make one API call (deduplication)
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    });

    it('should handle token refresh failure synchronization', async () => {
      // Set up error callbacks
      const errorCallback1 = vi.fn();
      const errorCallback2 = vi.fn();
      
      tokenRefreshService1.onRefreshError?.(errorCallback1);
      tokenRefreshService2.onRefreshError?.(errorCallback2);

      // Mock refresh failure
      mockSupabase.auth.refreshSession.mockRejectedValue(new Error('Refresh failed'));

      // Attempt refresh on tab 1
      try {
        await tokenRefreshService1.refreshTokens();
      } catch (error) {
        // Expected to fail
      }

      // Both tabs should be notified of the failure
      // This would typically be handled through the auth state change
      const authStateChangeCallback = mockSupabase.auth.onAuthStateChange.mock.calls[0]?.[0];
      if (authStateChangeCallback) {
        authStateChangeCallback('SIGNED_OUT', null);
      }
    });
  });

  describe('Cross-Tab Communication', () => {
    it('should establish communication between tabs', () => {
      // Set up message handlers
      const messageHandler1 = vi.fn();
      const messageHandler2 = vi.fn();

      crossTabService1.onMessage('test-message', messageHandler1);
      crossTabService2.onMessage('test-message', messageHandler2);

      // Send message from tab 1
      crossTabService1.sendMessage('test-message', { data: 'hello from tab 1' });

      // Tab 2 should receive the message
      expect(messageHandler2).toHaveBeenCalledWith({ data: 'hello from tab 1' });
    });

    it('should handle tab lifecycle events', () => {
      // Set up tab lifecycle handlers
      const tabOpenedHandler = vi.fn();
      const tabClosedHandler = vi.fn();

      crossTabService1.onTabOpened(tabOpenedHandler);
      crossTabService1.onTabClosed(tabClosedHandler);

      // Simulate tab 2 opening
      crossTabService2.announceTabOpened();

      // Tab 1 should be notified
      expect(tabOpenedHandler).toHaveBeenCalled();

      // Simulate tab 2 closing
      crossTabService2.announceTabClosed();

      // Tab 1 should be notified
      expect(tabClosedHandler).toHaveBeenCalled();
    });

    it('should coordinate master tab election', () => {
      // Both tabs start up
      tabSessionManager1.initialize();
      tabSessionManager2.initialize();

      // One should become master
      const isMaster1 = tabSessionManager1.isMasterTab();
      const isMaster2 = tabSessionManager2.isMasterTab();

      // Only one should be master
      expect(isMaster1 !== isMaster2).toBe(true);

      // Master tab should handle session management
      const masterTab = isMaster1 ? tabSessionManager1 : tabSessionManager2;
      expect(masterTab.shouldHandleSessionManagement()).toBe(true);
    });

    it('should handle master tab failover', () => {
      // Initialize tabs
      tabSessionManager1.initialize();
      tabSessionManager2.initialize();

      // Determine initial master
      const initialMaster = tabSessionManager1.isMasterTab() ? 
        tabSessionManager1 : tabSessionManager2;
      const initialSlave = tabSessionManager1.isMasterTab() ? 
        tabSessionManager2 : tabSessionManager1;

      expect(initialMaster.isMasterTab()).toBe(true);
      expect(initialSlave.isMasterTab()).toBe(false);

      // Simulate master tab closing
      initialMaster.cleanup?.();

      // Advance time to trigger failover detection
      TimerUtils.advanceTimersByTime(5000);

      // Slave should become master
      expect(initialSlave.isMasterTab()).toBe(true);
    });
  });

  describe('Data Synchronization Across Tabs', () => {
    it('should synchronize application state changes', () => {
      // Set up state change handlers
      const stateChangeHandler1 = vi.fn();
      const stateChangeHandler2 = vi.fn();

      crossTabService1.onMessage('state-change', stateChangeHandler1);
      crossTabService2.onMessage('state-change', stateChangeHandler2);

      // Update state on tab 1
      const newState = { currentRoute: '/tickets/123', user: { id: '456' } };
      crossTabService1.sendMessage('state-change', { 
        type: 'route-change', 
        state: newState 
      });

      // Tab 2 should receive the state update
      expect(stateChangeHandler2).toHaveBeenCalledWith({
        type: 'route-change',
        state: newState
      });
    });

    it('should handle conflicting state changes', () => {
      // Set up conflict resolution
      const conflictResolver = vi.fn().mockReturnValue({
        resolved: true,
        state: { merged: true }
      });

      crossTabService1.onMessage('state-conflict', conflictResolver);

      // Simulate conflicting changes
      crossTabService2.sendMessage('state-conflict', {
        tab1State: { version: 1, data: 'tab1' },
        tab2State: { version: 1, data: 'tab2' }
      });

      // Should attempt conflict resolution
      expect(conflictResolver).toHaveBeenCalled();
    });

    it('should synchronize form data across tabs', () => {
      // Set up form sync handlers
      const formSyncHandler1 = vi.fn();
      const formSyncHandler2 = vi.fn();

      crossTabService1.onMessage('form-sync', formSyncHandler1);
      crossTabService2.onMessage('form-sync', formSyncHandler2);

      // Update form data on tab 1
      const formData = {
        formId: 'ticket-form',
        data: { title: 'Synced title', description: 'Synced description' }
      };

      crossTabService1.sendMessage('form-sync', formData);

      // Tab 2 should receive the form update
      expect(formSyncHandler2).toHaveBeenCalledWith(formData);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should handle multiple tabs efficiently', () => {
      // Create multiple tab instances
      const tabs = Array(5).fill(null).map(() => ({
        sessionManager: new SessionManager(),
        crossTabService: new CrossTabCommunicationService(),
        tabSessionManager: new TabSpecificSessionManager()
      }));

      try {
        // Initialize all tabs
        tabs.forEach(tab => {
          tab.tabSessionManager.initialize();
        });

        // Only one should be master
        const masterTabs = tabs.filter(tab => tab.tabSessionManager.isMasterTab());
        expect(masterTabs).toHaveLength(1);

        // Send messages between tabs
        const messageHandler = vi.fn();
        tabs[1].crossTabService.onMessage('test', messageHandler);

        tabs[0].crossTabService.sendMessage('test', { data: 'broadcast' });

        // Should receive message efficiently
        expect(messageHandler).toHaveBeenCalledWith({ data: 'broadcast' });
      } finally {
        // Cleanup all tabs
        tabs.forEach(tab => {
          tab.sessionManager.destroy?.();
          tab.crossTabService.cleanup?.();
          tab.tabSessionManager.cleanup?.();
        });
      }
    });

    it('should prevent memory leaks in cross-tab communication', () => {
      // Set up multiple message handlers
      const handlers = Array(10).fill(null).map(() => vi.fn());

      handlers.forEach((handler, index) => {
        crossTabService1.onMessage(`test-${index}`, handler);
      });

      // Remove some handlers
      handlers.slice(0, 5).forEach((handler, index) => {
        crossTabService1.offMessage(`test-${index}`, handler);
      });

      // Send messages
      for (let i = 0; i < 10; i++) {
        crossTabService2.sendMessage(`test-${i}`, { data: i });
      }

      // Only remaining handlers should be called
      handlers.slice(0, 5).forEach(handler => {
        expect(handler).not.toHaveBeenCalled();
      });

      handlers.slice(5).forEach(handler => {
        expect(handler).toHaveBeenCalled();
      });
    });

    it('should handle rapid tab opening and closing', () => {
      const tabs: any[] = [];

      // Rapidly create and destroy tabs
      for (let i = 0; i < 20; i++) {
        const tab = {
          crossTabService: new CrossTabCommunicationService(),
          tabSessionManager: new TabSpecificSessionManager()
        };

        tab.tabSessionManager.initialize();
        tabs.push(tab);

        // Close every other tab immediately
        if (i % 2 === 1) {
          tab.crossTabService.cleanup?.();
          tab.tabSessionManager.cleanup?.();
        }
      }

      // Should handle rapid creation/destruction without errors
      const activeTabs = tabs.filter((_, index) => index % 2 === 0);
      const masterTabs = activeTabs.filter(tab => 
        tab.tabSessionManager.isMasterTab()
      );

      expect(masterTabs.length).toBeGreaterThan(0);
      expect(masterTabs.length).toBeLessThanOrEqual(1);

      // Cleanup remaining tabs
      activeTabs.forEach(tab => {
        tab.crossTabService.cleanup?.();
        tab.tabSessionManager.cleanup?.();
      });
    });
  });

  describe('Advanced Cross-Tab Synchronization', () => {
    it('should handle complex multi-tab scenarios with state conflicts', async () => {
      // Create 5 tabs to simulate real-world usage
      const tabs = Array(5).fill(null).map((_, index) => ({
        id: `tab-${index}`,
        sessionManager: new SessionManager(),
        crossTabService: new CrossTabCommunicationService(),
        tabSessionManager: new TabSpecificSessionManager(),
        stateChanges: [] as any[]
      }));

      try {
        // Initialize all tabs
        mockSupabase.auth.getSession.mockResolvedValue({
          data: { session: mockSession },
          error: null
        });

        for (const tab of tabs) {
          await tab.sessionManager.initializeSession();
          tab.tabSessionManager.initialize();
          
          // Set up state change tracking
          tab.crossTabService.onMessage('state-change', (data) => {
            tab.stateChanges.push(data);
          });
        }

        // Verify only one master tab
        const masterTabs = tabs.filter(tab => tab.tabSessionManager.isMasterTab());
        expect(masterTabs).toHaveLength(1);

        // Simulate concurrent state changes from multiple tabs
        const stateUpdates = [
          { tabIndex: 0, state: { currentPage: '/dashboard', timestamp: Date.now() } },
          { tabIndex: 1, state: { currentPage: '/tickets', timestamp: Date.now() + 100 } },
          { tabIndex: 2, state: { currentPage: '/profile', timestamp: Date.now() + 200 } }
        ];

        // Send state updates concurrently
        await Promise.all(stateUpdates.map(update => {
          const tab = tabs[update.tabIndex];
          return tab.crossTabService.sendMessage('state-change', {
            type: 'navigation',
            state: update.state,
            tabId: tab.id
          });
        }));

        // Verify all tabs received state updates
        tabs.forEach((tab, index) => {
          if (index < 3) { // Tabs that sent updates
            expect(tab.stateChanges.length).toBeGreaterThanOrEqual(2); // Should receive updates from other tabs
          } else { // Tabs that only received
            expect(tab.stateChanges.length).toBe(3); // Should receive all updates
          }
        });

        // Test master tab failover
        const originalMaster = masterTabs[0];
        originalMaster.tabSessionManager.cleanup?.();

        // Advance time to trigger failover
        TimerUtils.advanceTimersByTime(5000);

        // New master should be elected
        const newMasterTabs = tabs
          .filter(tab => tab !== originalMaster)
          .filter(tab => tab.tabSessionManager.isMasterTab());
        expect(newMasterTabs).toHaveLength(1);

      } finally {
        // Cleanup all tabs
        tabs.forEach(tab => {
          tab.sessionManager.destroy?.();
          tab.crossTabService.cleanup?.();
          tab.tabSessionManager.cleanup?.();
        });
      }
    });

    it('should synchronize form data across tabs with conflict resolution', async () => {
      // Create two tabs with form synchronization
      const tab1 = {
        crossTabService: new CrossTabCommunicationService(),
        formData: { title: '', description: '' }
      };
      
      const tab2 = {
        crossTabService: new CrossTabCommunicationService(),
        formData: { title: '', description: '' }
      };

      try {
        // Set up form sync handlers
        tab1.crossTabService.onMessage('form-sync', (data) => {
          if (data.formId === 'ticket-form') {
            tab1.formData = { ...tab1.formData, ...data.data };
          }
        });

        tab2.crossTabService.onMessage('form-sync', (data) => {
          if (data.formId === 'ticket-form') {
            tab2.formData = { ...tab2.formData, ...data.data };
          }
        });

        // Simulate concurrent form edits
        tab1.crossTabService.sendMessage('form-sync', {
          formId: 'ticket-form',
          data: { title: 'Title from tab 1' },
          timestamp: Date.now()
        });

        tab2.crossTabService.sendMessage('form-sync', {
          formId: 'ticket-form',
          data: { description: 'Description from tab 2' },
          timestamp: Date.now() + 100
        });

        // Both tabs should have merged form data
        expect(tab1.formData.title).toBe('Title from tab 1');
        expect(tab1.formData.description).toBe('Description from tab 2');
        expect(tab2.formData.title).toBe('Title from tab 1');
        expect(tab2.formData.description).toBe('Description from tab 2');

      } finally {
        tab1.crossTabService.cleanup?.();
        tab2.crossTabService.cleanup?.();
      }
    });
  });

  describe('Error Handling in Cross-Tab Scenarios', () => {
    it('should handle BroadcastChannel failures gracefully', () => {
      // Mock BroadcastChannel failure
      const originalBroadcastChannel = global.BroadcastChannel;
      global.BroadcastChannel = vi.fn().mockImplementation(() => {
        throw new Error('BroadcastChannel not supported');
      });

      try {
        // Should still create services without throwing
        const fallbackService = new CrossTabCommunicationService();
        expect(fallbackService).toBeDefined();

        // Should handle message sending gracefully
        expect(() => {
          fallbackService.sendMessage('test', { data: 'test' });
        }).not.toThrow();
      } finally {
        global.BroadcastChannel = originalBroadcastChannel;
      }
    });

    it('should handle corrupted cross-tab messages', () => {
      const messageHandler = vi.fn();
      crossTabService1.onMessage('test', messageHandler);

      // Simulate corrupted message
      const corruptedEvent = new MessageEvent('message', {
        data: 'corrupted-json{invalid'
      });

      // Should handle corruption gracefully
      expect(() => {
        crossTabService1['broadcastChannel']?.dispatchEvent(corruptedEvent);
      }).not.toThrow();

      expect(messageHandler).not.toHaveBeenCalled();
    });

    it('should recover from tab communication failures', () => {
      // Initialize communication
      tabSessionManager1.initialize();
      tabSessionManager2.initialize();

      // Simulate communication failure
      const originalSendMessage = crossTabService1.sendMessage;
      crossTabService1.sendMessage = vi.fn().mockImplementation(() => {
        throw new Error('Communication failed');
      });

      // Should handle failure gracefully
      expect(() => {
        tabSessionManager1.announceTabStatus();
      }).not.toThrow();

      // Restore communication
      crossTabService1.sendMessage = originalSendMessage;

      // Should recover and continue working
      const messageHandler = vi.fn();
      crossTabService2.onMessage('test', messageHandler);
      crossTabService1.sendMessage('test', { recovered: true });

      expect(messageHandler).toHaveBeenCalledWith({ recovered: true });
    });
  });
});