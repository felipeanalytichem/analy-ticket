import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionEventSynchronizer, SessionEvent, TokenRefreshEvent } from '../SessionEventSynchronizer';
import { crossTabCommunication } from '../CrossTabCommunicationService';

// Mock cross-tab communication
vi.mock('../CrossTabCommunicationService', () => ({
  crossTabCommunication: {
    initialize: vi.fn(),
    subscribe: vi.fn(),
    broadcastMessage: vi.fn(),
    syncSessionState: vi.fn(),
    getCurrentSessionState: vi.fn(),
    isMaster: vi.fn(),
    getTabId: vi.fn(() => 'test-tab-id')
  }
}));

// Mock supabase
const mockAuthStateChange = vi.fn();
const mockUnsubscribe = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(() => ({
        data: {
          subscription: {
            unsubscribe: mockUnsubscribe
          }
        }
      }))
    }
  }
}));

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    pathname: '/',
    href: ''
  },
  writable: true
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock sessionStorage
const sessionStorageMock = {
  clear: vi.fn()
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock
});

describe('SessionEventSynchronizer', () => {
  let synchronizer: SessionEventSynchronizer;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockBroadcastMessage: ReturnType<typeof vi.fn>;
  let mockSyncSessionState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mocks
    mockSubscribe = vi.fn(() => vi.fn()); // Return unsubscribe function
    mockBroadcastMessage = vi.fn();
    mockSyncSessionState = vi.fn();

    (crossTabCommunication.subscribe as any) = mockSubscribe;
    (crossTabCommunication.broadcastMessage as any) = mockBroadcastMessage;
    (crossTabCommunication.syncSessionState as any) = mockSyncSessionState;
    (crossTabCommunication.initialize as any) = vi.fn();
    (crossTabCommunication.isMaster as any) = vi.fn(() => true);
    (crossTabCommunication.getCurrentSessionState as any) = vi.fn(() => null);

    synchronizer = new SessionEventSynchronizer();
  });

  afterEach(async () => {
    await synchronizer.cleanup();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await synchronizer.initialize();

      expect(crossTabCommunication.initialize).toHaveBeenCalled();
      expect(mockSubscribe).toHaveBeenCalledTimes(5); // 5 different message types
    });

    it('should not initialize twice', async () => {
      await synchronizer.initialize();
      await synchronizer.initialize();

      expect(crossTabCommunication.initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      (crossTabCommunication.initialize as any).mockRejectedValue(new Error('Init failed'));

      await expect(synchronizer.initialize()).rejects.toThrow('Init failed');
    });
  });

  describe('event subscription', () => {
    beforeEach(async () => {
      await synchronizer.initialize();
    });

    it('should subscribe to session events', () => {
      const handler = vi.fn();
      const unsubscribe = synchronizer.onSessionEvent('LOGIN', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call event handlers when events occur', () => {
      const loginHandler = vi.fn();
      const logoutHandler = vi.fn();

      synchronizer.onSessionEvent('LOGIN', loginHandler);
      synchronizer.onSessionEvent('LOGOUT', logoutHandler);

      // Simulate login event
      const loginEvent: SessionEvent = {
        type: 'LOGIN',
        timestamp: Date.now(),
        sessionData: { user: { id: 'user123' } },
        userId: 'user123'
      };

      synchronizer['handleLocalSessionEvent'](loginEvent);

      expect(loginHandler).toHaveBeenCalledWith(loginEvent);
      expect(logoutHandler).not.toHaveBeenCalled();
    });

    it('should unsubscribe from events', () => {
      const handler = vi.fn();
      const unsubscribe = synchronizer.onSessionEvent('LOGIN', handler);

      unsubscribe();

      // Simulate login event
      const loginEvent: SessionEvent = {
        type: 'LOGIN',
        timestamp: Date.now(),
        sessionData: { user: { id: 'user123' } },
        userId: 'user123'
      };

      synchronizer['handleLocalSessionEvent'](loginEvent);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('session event broadcasting', () => {
    beforeEach(async () => {
      await synchronizer.initialize();
    });

    it('should broadcast login events', async () => {
      const sessionData = { user: { id: 'user123' }, access_token: 'token123' };

      await synchronizer.broadcastLogin(sessionData);

      expect(mockBroadcastMessage).toHaveBeenCalledWith('SESSION_EVENT', {
        event: expect.objectContaining({
          type: 'LOGIN',
          sessionData,
          userId: 'user123'
        }),
        fromTabId: 'test-tab-id'
      });
    });

    it('should broadcast logout events', async () => {
      const reason = 'user_initiated';

      await synchronizer.broadcastLogout(reason);

      expect(mockBroadcastMessage).toHaveBeenCalledWith('SESSION_EVENT', {
        event: expect.objectContaining({
          type: 'LOGOUT',
          reason
        }),
        fromTabId: 'test-tab-id'
      });
    });

    it('should broadcast session expired events', async () => {
      const reason = 'timeout';

      await synchronizer.broadcastSessionExpired(reason);

      expect(mockBroadcastMessage).toHaveBeenCalledWith('SESSION_EVENT', {
        event: expect.objectContaining({
          type: 'SESSION_EXPIRED',
          reason
        }),
        fromTabId: 'test-tab-id'
      });
    });

    it('should broadcast token refresh events', async () => {
      const tokenData: TokenRefreshEvent = {
        accessToken: 'new_token',
        refreshToken: 'new_refresh_token',
        expiresAt: Date.now() + 3600000,
        userId: 'user123'
      };

      await synchronizer.broadcastTokenRefresh(tokenData);

      expect(mockBroadcastMessage).toHaveBeenCalledWith('SESSION_EVENT', {
        event: expect.objectContaining({
          type: 'TOKEN_REFRESHED',
          sessionData: tokenData,
          userId: 'user123'
        }),
        fromTabId: 'test-tab-id'
      });
    });

    it('should broadcast session extended events', async () => {
      const sessionData = { user: { id: 'user123' }, expires_at: Date.now() + 7200000 };

      await synchronizer.broadcastSessionExtended(sessionData);

      expect(mockBroadcastMessage).toHaveBeenCalledWith('SESSION_EVENT', {
        event: expect.objectContaining({
          type: 'SESSION_EXTENDED',
          sessionData,
          userId: 'user123'
        }),
        fromTabId: 'test-tab-id'
      });
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      await synchronizer.initialize();
    });

    it('should handle session event messages', () => {
      const handler = vi.fn();
      synchronizer.onSessionEvent('LOGIN', handler);

      const message = {
        type: 'SESSION_EVENT',
        payload: {
          event: {
            type: 'LOGIN',
            timestamp: Date.now(),
            sessionData: { user: { id: 'user123' } },
            userId: 'user123'
          }
        },
        timestamp: Date.now(),
        tabId: 'other-tab',
        sessionId: 'session123'
      };

      synchronizer['handleSessionEventMessage'](message);

      expect(handler).toHaveBeenCalledWith(message.payload.event);
    });

    it('should handle login messages', () => {
      const handler = vi.fn();
      synchronizer.onSessionEvent('LOGIN', handler);

      const message = {
        type: 'USER_LOGIN',
        payload: {
          sessionData: { user: { id: 'user123' } },
          userId: 'user123'
        },
        timestamp: Date.now(),
        tabId: 'other-tab',
        sessionId: 'session123'
      };

      synchronizer['handleLoginMessage'](message);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'LOGIN',
        sessionData: message.payload.sessionData,
        userId: 'user123'
      }));
    });

    it('should handle logout messages', () => {
      const handler = vi.fn();
      synchronizer.onSessionEvent('LOGOUT', handler);

      const message = {
        type: 'USER_LOGOUT',
        payload: {
          reason: 'session_expired'
        },
        timestamp: Date.now(),
        tabId: 'other-tab',
        sessionId: 'session123'
      };

      synchronizer['handleLogoutMessage'](message);

      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        type: 'LOGOUT',
        reason: 'session_expired'
      }));
    });
  });

  describe('default event actions', () => {
    beforeEach(async () => {
      await synchronizer.initialize();
    });

    it('should clear local data on logout', () => {
      const logoutEvent: SessionEvent = {
        type: 'LOGOUT',
        timestamp: Date.now(),
        reason: 'user_initiated'
      };

      // Mock localStorage keys
      localStorageMock.length = 3;
      localStorageMock.key.mockImplementation((index) => {
        const keys = ['session-data', 'auth-token', 'other-data'];
        return keys[index] || null;
      });

      synchronizer['performDefaultEventActions'](logoutEvent);

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('session-data');
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('auth-token');
      expect(localStorageMock.removeItem).not.toHaveBeenCalledWith('other-data');
      expect(sessionStorageMock.clear).toHaveBeenCalled();
    });

    it('should clear local data on session expired', () => {
      const expiredEvent: SessionEvent = {
        type: 'SESSION_EXPIRED',
        timestamp: Date.now(),
        reason: 'timeout'
      };

      localStorageMock.length = 1;
      localStorageMock.key.mockImplementation(() => 'session-info');

      synchronizer['performDefaultEventActions'](expiredEvent);

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('session-info');
      expect(sessionStorageMock.clear).toHaveBeenCalled();
    });

    it('should update local token data on token refresh', () => {
      const tokenRefreshEvent: SessionEvent = {
        type: 'TOKEN_REFRESHED',
        timestamp: Date.now(),
        sessionData: {
          accessToken: 'new_token',
          refreshToken: 'new_refresh_token',
          expiresAt: Date.now() + 3600000
        }
      };

      synchronizer['performDefaultEventActions'](tokenRefreshEvent);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'analy-ticket-token-info',
        expect.stringContaining('new_token')
      );
    });

    it('should redirect to login on logout when not on login page', () => {
      window.location.pathname = '/dashboard';

      const logoutEvent: SessionEvent = {
        type: 'LOGOUT',
        timestamp: Date.now()
      };

      synchronizer['performDefaultEventActions'](logoutEvent);

      expect(window.location.href).toBe('/login');
    });

    it('should redirect to dashboard on login when on login page', () => {
      window.location.pathname = '/login';

      const loginEvent: SessionEvent = {
        type: 'LOGIN',
        timestamp: Date.now(),
        sessionData: { user: { id: 'user123' } }
      };

      synchronizer['performDefaultEventActions'](loginEvent);

      expect(window.location.href).toBe('/');
    });
  });

  describe('utility methods', () => {
    beforeEach(async () => {
      await synchronizer.initialize();
    });

    it('should get current session state', () => {
      const mockState = {
        isAuthenticated: true,
        user: { id: 'user123' },
        accessToken: 'token123',
        refreshToken: 'refresh123',
        expiresAt: Date.now() + 3600000,
        lastActivity: Date.now()
      };

      (crossTabCommunication.getCurrentSessionState as any).mockReturnValue(mockState);

      const result = synchronizer.getCurrentSessionState();

      expect(result).toEqual(mockState);
      expect(crossTabCommunication.getCurrentSessionState).toHaveBeenCalled();
    });

    it('should check if tab is master', () => {
      (crossTabCommunication.isMaster as any).mockReturnValue(true);

      const result = synchronizer.isMasterTab();

      expect(result).toBe(true);
      expect(crossTabCommunication.isMaster).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources', async () => {
      await synchronizer.initialize();

      // Mock unsubscribe functions
      const unsubscribeFn = vi.fn();
      synchronizer['unsubscribeFunctions'] = [unsubscribeFn, unsubscribeFn];

      await synchronizer.cleanup();

      expect(unsubscribeFn).toHaveBeenCalledTimes(2);
    });

    it('should handle cleanup errors gracefully', async () => {
      await synchronizer.initialize();

      const errorUnsubscribe = vi.fn(() => {
        throw new Error('Cleanup error');
      });
      synchronizer['unsubscribeFunctions'] = [errorUnsubscribe];

      // Should not throw
      await expect(synchronizer.cleanup()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await synchronizer.initialize();
    });

    it('should handle broadcast errors gracefully', async () => {
      mockBroadcastMessage.mockRejectedValue(new Error('Broadcast failed'));

      await expect(synchronizer.broadcastLogin({ user: { id: 'user123' } }))
        .rejects.toThrow('Broadcast failed');
    });

    it('should handle event handler errors gracefully', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });

      synchronizer.onSessionEvent('LOGIN', errorHandler);

      const loginEvent: SessionEvent = {
        type: 'LOGIN',
        timestamp: Date.now(),
        sessionData: { user: { id: 'user123' } }
      };

      // Should not throw despite handler error
      expect(() => synchronizer['handleLocalSessionEvent'](loginEvent)).not.toThrow();
      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.removeItem.mockImplementation(() => {
        throw new Error('Storage error');
      });

      const logoutEvent: SessionEvent = {
        type: 'LOGOUT',
        timestamp: Date.now()
      };

      // Should not throw despite storage error
      expect(() => synchronizer['performDefaultEventActions'](logoutEvent)).not.toThrow();
    });
  });
});