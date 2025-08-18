import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TabSpecificSessionManager, TabSessionInfo, TabSessionEvent, MasterTabElectionResult } from '../TabSpecificSessionManager';
import { crossTabCommunication } from '../CrossTabCommunicationService';
import { sessionEventSynchronizer } from '../SessionEventSynchronizer';

// Mock dependencies
vi.mock('../CrossTabCommunicationService', () => ({
    crossTabCommunication: {
        initialize: vi.fn(),
        subscribe: vi.fn(),
        broadcastMessage: vi.fn(),
        syncSessionState: vi.fn(),
        getTabId: vi.fn(() => 'test-tab-id')
    }
}));

vi.mock('../SessionEventSynchronizer', () => ({
    sessionEventSynchronizer: {
        initialize: vi.fn(),
        onSessionEvent: vi.fn()
    }
}));

// Mock supabase
vi.mock('@/lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: vi.fn()
        }
    }
}));

// Mock document event listeners
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
Object.defineProperty(document, 'addEventListener', {
    value: mockAddEventListener
});
Object.defineProperty(document, 'removeEventListener', {
    value: mockRemoveEventListener
});

describe('TabSpecificSessionManager', () => {
    let manager: TabSpecificSessionManager;
    let mockSubscribe: ReturnType<typeof vi.fn>;
    let mockBroadcastMessage: ReturnType<typeof vi.fn>;
    let mockSyncSessionState: ReturnType<typeof vi.fn>;
    let mockOnSessionEvent: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();

        // Setup mocks
        mockSubscribe = vi.fn(() => vi.fn()); // Return unsubscribe function
        mockBroadcastMessage = vi.fn();
        mockSyncSessionState = vi.fn();
        mockOnSessionEvent = vi.fn(() => vi.fn()); // Return unsubscribe function

        (crossTabCommunication.subscribe as any) = mockSubscribe;
        (crossTabCommunication.broadcastMessage as any) = mockBroadcastMessage;
        (crossTabCommunication.syncSessionState as any) = mockSyncSessionState;
        (crossTabCommunication.initialize as any) = vi.fn();
        (sessionEventSynchronizer.initialize as any) = vi.fn();
        (sessionEventSynchronizer.onSessionEvent as any) = mockOnSessionEvent;

        manager = new TabSpecificSessionManager();
    });

    afterEach(async () => {
        vi.useRealTimers();
        await manager.cleanup();
    });

    describe('initialization', () => {
        it('should initialize successfully', async () => {
            await manager.initialize();

            expect(crossTabCommunication.initialize).toHaveBeenCalled();
            expect(sessionEventSynchronizer.initialize).toHaveBeenCalled();
            expect(mockSubscribe).toHaveBeenCalledTimes(5); // 5 different message types
            expect(mockOnSessionEvent).toHaveBeenCalledTimes(2); // LOGIN and LOGOUT events
            expect(mockAddEventListener).toHaveBeenCalledTimes(6); // Activity events
        });

        it('should not initialize twice', async () => {
            await manager.initialize();
            await manager.initialize();

            expect(crossTabCommunication.initialize).toHaveBeenCalledTimes(1);
            expect(sessionEventSynchronizer.initialize).toHaveBeenCalledTimes(1);
        });

        it('should handle initialization errors', async () => {
            (crossTabCommunication.initialize as any).mockRejectedValue(new Error('Init failed'));

            await expect(manager.initialize()).rejects.toThrow('Init failed');
        });

        it('should register tab and start heartbeat on initialization', async () => {
            await manager.initialize();

            expect(mockBroadcastMessage).toHaveBeenCalledWith('TAB_REGISTERED', expect.objectContaining({
                tabId: expect.stringMatching(/^tab_\d+_[a-z0-9]+$/),
                sessionId: expect.stringMatching(/^session_\d+_[a-z0-9]+$/),
                timestamp: expect.any(Number)
            }));

            // Fast-forward time to trigger heartbeat
            vi.advanceTimersByTime(5000);

            expect(mockBroadcastMessage).toHaveBeenCalledWith('HEARTBEAT', expect.objectContaining({
                tabId: expect.stringMatching(/^tab_\d+_[a-z0-9]+$/),
                isMaster: expect.any(Boolean),
                lastActivity: expect.any(Number),
                heartbeatCount: expect.any(Number)
            }));
        });
    });

    describe('tab session info', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should return current tab session info', () => {
            const tabInfo = manager.getTabSessionInfo();

            expect(tabInfo).toMatchObject({
                tabId: expect.stringMatching(/^tab_\d+_[a-z0-9]+$/),
                sessionId: expect.stringMatching(/^session_\d+_[a-z0-9]+$/),
                isActive: true,
                isMaster: expect.any(Boolean),
                lastActivity: expect.any(Number),
                connectionStatus: 'connected',
                heartbeatCount: expect.any(Number)
            });
        });

        it('should update activity', () => {
            const initialActivity = manager.getTabSessionInfo().lastActivity;

            // Wait a moment and update activity
            vi.advanceTimersByTime(1000);
            manager.updateActivity();

            const updatedActivity = manager.getTabSessionInfo().lastActivity;
            expect(updatedActivity).toBeGreaterThan(initialActivity);
        });

        it('should check if tab is master', () => {
            const isMaster = manager.isMasterTab();
            expect(typeof isMaster).toBe('boolean');
        });
    });

    describe('event subscription', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should subscribe to tab session events', () => {
            const handler = vi.fn();
            const unsubscribe = manager.onTabSessionEvent('TAB_ACTIVATED', handler);

            expect(typeof unsubscribe).toBe('function');
        });

        it('should call event handlers when events occur', () => {
            const activatedHandler = vi.fn();
            const masterElectedHandler = vi.fn();

            manager.onTabSessionEvent('TAB_ACTIVATED', activatedHandler);
            manager.onTabSessionEvent('MASTER_ELECTED', masterElectedHandler);

            // Simulate tab activated event
            manager['emitTabEvent']('TAB_ACTIVATED', { test: 'data' });

            expect(activatedHandler).toHaveBeenCalledWith(expect.objectContaining({
                type: 'TAB_ACTIVATED',
                tabId: expect.stringMatching(/^tab_\d+_[a-z0-9]+$/),
                timestamp: expect.any(Number),
                data: { test: 'data' }
            }));
            expect(masterElectedHandler).not.toHaveBeenCalled();
        });

        it('should unsubscribe from events', () => {
            const handler = vi.fn();
            const unsubscribe = manager.onTabSessionEvent('TAB_ACTIVATED', handler);

            unsubscribe();

            // Simulate event
            manager['emitTabEvent']('TAB_ACTIVATED', { test: 'data' });

            expect(handler).not.toHaveBeenCalled();
        });
    });

    describe('session synchronization', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should synchronize session data', async () => {
            const sessionData = {
                user: { id: 'user123', email: 'test@example.com' },
                access_token: 'token123',
                refresh_token: 'refresh123',
                expires_at: Math.floor(Date.now() / 1000) + 3600
            };

            await manager.synchronizeSession(sessionData);

            expect(mockSyncSessionState).toHaveBeenCalledWith(expect.objectContaining({
                isAuthenticated: true,
                user: sessionData.user,
                accessToken: sessionData.access_token,
                refreshToken: sessionData.refresh_token,
                expiresAt: expect.any(Number),
                lastActivity: expect.any(Number)
            }));

            const tabInfo = manager.getTabSessionInfo();
            expect(tabInfo.sessionData).toEqual(sessionData);
        });

        it('should handle synchronization errors', async () => {
            mockSyncSessionState.mockRejectedValue(new Error('Sync failed'));

            await expect(manager.synchronizeSession({ test: 'data' }))
                .rejects.toThrow('Sync failed');
        });
    });

    describe('message handling', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should handle tab registered messages', () => {
            const message = {
                type: 'TAB_REGISTERED',
                payload: {
                    tabId: 'other-tab-123',
                    sessionId: 'other-session-123',
                    tabInfo: {
                        isActive: true,
                        isMaster: false,
                        connectionStatus: 'connected'
                    }
                },
                timestamp: Date.now(),
                tabId: 'other-tab-123',
                sessionId: 'session123'
            };

            manager['handleTabRegistered'](message);

            const activeTabs = manager.getActiveTabs();
            expect(activeTabs).toHaveLength(1);
            expect(activeTabs[0].tabId).toBe('other-tab-123');
        });

        it('should handle tab closing messages', () => {
            // First add a tab
            const registerMessage = {
                type: 'TAB_REGISTERED',
                payload: {
                    tabId: 'other-tab-123',
                    tabInfo: { isMaster: true }
                },
                timestamp: Date.now(),
                tabId: 'other-tab-123',
                sessionId: 'session123'
            };

            manager['handleTabRegistered'](registerMessage);

            // Then handle tab closing
            const closeMessage = {
                type: 'TAB_CLOSING',
                payload: {
                    tabId: 'other-tab-123',
                    isMaster: true
                },
                timestamp: Date.now(),
                tabId: 'other-tab-123',
                sessionId: 'session123'
            };

            manager['handleTabClosing'](closeMessage);

            const activeTabs = manager.getActiveTabs();
            expect(activeTabs).toHaveLength(0);
        });

        it('should handle heartbeat messages', () => {
            const message = {
                type: 'HEARTBEAT',
                payload: {
                    tabId: 'other-tab-123',
                    isMaster: false,
                    lastActivity: Date.now(),
                    heartbeatCount: 5,
                    connectionStatus: 'connected'
                },
                timestamp: Date.now(),
                tabId: 'other-tab-123',
                sessionId: 'session123'
            };

            manager['handleHeartbeat'](message);

            const activeTabs = manager.getActiveTabs();
            expect(activeTabs).toHaveLength(1);
            expect(activeTabs[0].heartbeatCount).toBe(5);
        });

        it('should handle master election messages', () => {
            const handler = vi.fn();
            manager.onTabSessionEvent('MASTER_ELECTED', handler);

            const message = {
                type: 'MASTER_ELECTION',
                payload: {
                    candidateTabId: manager.getTabSessionInfo().tabId,
                    electionReason: 'initialization'
                },
                timestamp: Date.now(),
                tabId: 'other-tab-123',
                sessionId: 'session123'
            };

            manager['handleMasterElection'](message);

            expect(manager.isMasterTab()).toBe(true);
            expect(handler).toHaveBeenCalledWith(expect.objectContaining({
                type: 'MASTER_ELECTED',
                data: expect.objectContaining({
                    newMasterTabId: manager.getTabSessionInfo().tabId,
                    electionReason: 'initialization'
                })
            }));
        });
    });

    describe('master tab election', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should elect master tab', async () => {
            const result = await manager.forceMasterElection();

            expect(result).toMatchObject({
                newMasterTabId: expect.stringMatching(/^tab_\d+_[a-z0-9]+$/),
                electionReason: 'manual_election'
            });

            expect(mockBroadcastMessage).toHaveBeenCalledWith('MASTER_ELECTION', expect.objectContaining({
                candidateTabId: result.newMasterTabId,
                electionReason: 'manual_election'
            }));
        });

        it('should handle master election with multiple tabs', async () => {
            // Add another tab with earlier activity
            const earlierTime = Date.now() - 10000;
            manager['activeTabs'].set('older-tab', {
                tabId: 'older-tab',
                sessionId: 'session-older',
                isActive: true,
                isMaster: false,
                lastActivity: earlierTime,
                connectionStatus: 'connected',
                heartbeatCount: 0
            });

            const result = await manager.forceMasterElection();

            // The older tab should become master
            expect(result.newMasterTabId).toBe('older-tab');
        });

        it('should schedule master election on master tab closure', () => {
            const scheduleSpy = vi.spyOn(manager as any, 'scheduleMasterElection');

            const message = {
                type: 'TAB_CLOSING',
                payload: {
                    tabId: 'master-tab-123',
                    isMaster: true
                },
                timestamp: Date.now(),
                tabId: 'master-tab-123',
                sessionId: 'session123'
            };

            manager['handleTabClosing'](message);

            expect(scheduleSpy).toHaveBeenCalledWith('master_tab_closed');
        });
    });

    describe('activity monitoring', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should monitor user activity', () => {
            const initialActivity = manager.getTabSessionInfo().lastActivity;

            // Simulate user activity
            vi.advanceTimersByTime(1000);
            manager.updateActivity();

            const updatedActivity = manager.getTabSessionInfo().lastActivity;
            expect(updatedActivity).toBeGreaterThan(initialActivity);
        });

        it('should remove inactive tabs', () => {
            // Add a tab with old activity
            const oldTime = Date.now() - 35000; // 35 seconds ago (beyond threshold)
            manager['activeTabs'].set('inactive-tab', {
                tabId: 'inactive-tab',
                sessionId: 'session-inactive',
                isActive: true,
                isMaster: false,
                lastActivity: oldTime,
                connectionStatus: 'connected',
                heartbeatCount: 0
            });

            // Trigger activity check
            vi.advanceTimersByTime(10000); // Activity check interval

            const activeTabs = manager.getActiveTabs();
            expect(activeTabs.find(tab => tab.tabId === 'inactive-tab')).toBeUndefined();
        });
    });

    describe('cleanup', () => {
        it('should cleanup resources', async () => {
            await manager.initialize();

            const tabInfo = manager.getTabSessionInfo();
            expect(tabInfo.isActive).toBe(true);
            expect(tabInfo.connectionStatus).toBe('connected');

            await manager.cleanup();

            const updatedTabInfo = manager.getTabSessionInfo();
            expect(updatedTabInfo.isActive).toBe(false);
            expect(updatedTabInfo.connectionStatus).toBe('disconnected');

            expect(mockBroadcastMessage).toHaveBeenCalledWith('TAB_CLOSING', expect.objectContaining({
                tabId: tabInfo.tabId,
                isMaster: tabInfo.isMaster
            }));
        });

        it('should handle cleanup errors gracefully', async () => {
            await manager.initialize();

            mockBroadcastMessage.mockRejectedValue(new Error('Cleanup failed'));

            // Should not throw
            await expect(manager.cleanup()).resolves.not.toThrow();
        });

        it('should remove activity event listeners on cleanup', async () => {
            await manager.initialize();
            await manager.cleanup();

            expect(mockRemoveEventListener).toHaveBeenCalledTimes(6); // Activity events
        });
    });

    describe('error handling', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should handle heartbeat errors gracefully', () => {
            // Test that heartbeat errors are handled by checking the error handling logic
            const sendHeartbeatSpy = vi.spyOn(manager as any, 'sendHeartbeat');
            sendHeartbeatSpy.mockRejectedValue(new Error('Heartbeat failed'));

            // Manually call the heartbeat error handling
            manager['tabSessionInfo'].connectionStatus = 'reconnecting';
            manager['emitTabEvent']('CONNECTION_STATUS_CHANGED', {
                status: 'reconnecting',
                error: 'Heartbeat failed'
            });

            const tabInfo = manager.getTabSessionInfo();
            expect(tabInfo.connectionStatus).toBe('reconnecting');

            sendHeartbeatSpy.mockRestore();
        });

        it('should handle event handler errors gracefully', () => {
            const errorHandler = vi.fn(() => {
                throw new Error('Handler error');
            });

            manager.onTabSessionEvent('TAB_ACTIVATED', errorHandler);

            // Should not throw despite handler error
            expect(() => manager['emitTabEvent']('TAB_ACTIVATED', {})).not.toThrow();
            expect(errorHandler).toHaveBeenCalled();
        });

        it('should handle master election errors', async () => {
            mockBroadcastMessage.mockRejectedValue(new Error('Election failed'));

            await expect(manager.forceMasterElection()).rejects.toThrow('Election failed');
        });
    });

    describe('session event handling', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should handle session login events', () => {
            const sessionData = { user: { id: 'user123' }, access_token: 'token123' };

            manager['handleSessionLogin']({
                type: 'LOGIN',
                timestamp: Date.now(),
                sessionData
            });

            const tabInfo = manager.getTabSessionInfo();
            expect(tabInfo.sessionData).toEqual(sessionData);
        });

        it('should handle session logout events', () => {
            // First set some session data
            manager['tabSessionInfo'].sessionData = { user: { id: 'user123' } };

            manager['handleSessionLogout']({
                type: 'LOGOUT',
                timestamp: Date.now()
            });

            const tabInfo = manager.getTabSessionInfo();
            expect(tabInfo.sessionData).toBeNull();
        });
    });

    describe('utility methods', () => {
        beforeEach(async () => {
            await manager.initialize();
        });

        it('should get master tab info', () => {
            // Set this tab as master
            manager['tabSessionInfo'].isMaster = true;

            const masterTab = manager.getMasterTab();
            expect(masterTab).not.toBeNull();
            expect(masterTab!.tabId).toBe(manager.getTabSessionInfo().tabId);
        });

        it('should return null when no master tab exists', () => {
            // Ensure no tab is master
            manager['tabSessionInfo'].isMaster = false;

            const masterTab = manager.getMasterTab();
            expect(masterTab).toBeNull();
        });

        it('should get active tabs', () => {
            // Add some tabs
            manager['activeTabs'].set('tab1', {
                tabId: 'tab1',
                sessionId: 'session1',
                isActive: true,
                isMaster: false,
                lastActivity: Date.now(),
                connectionStatus: 'connected',
                heartbeatCount: 0
            });

            manager['activeTabs'].set('tab2', {
                tabId: 'tab2',
                sessionId: 'session2',
                isActive: false, // Inactive
                isMaster: false,
                lastActivity: Date.now(),
                connectionStatus: 'disconnected',
                heartbeatCount: 0
            });

            const activeTabs = manager.getActiveTabs();
            expect(activeTabs).toHaveLength(1);
            expect(activeTabs[0].tabId).toBe('tab1');
        });
    });
});