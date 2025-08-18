import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager, SessionStatus } from '../SessionManager';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      signOut: vi.fn(),
    }
  }
}));

// Mock console methods
const consoleSpy = {
  log: vi.spyOn(console, 'log'),
  error: vi.spyOn(console, 'error'),
  warn: vi.spyOn(console, 'warn')
};

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockSession: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Mock console methods
    consoleSpy.log.mockImplementation(() => {});
    consoleSpy.error.mockImplementation(() => {});
    consoleSpy.warn.mockImplementation(() => {});
    
    // Create a fresh instance for each test
    sessionManager = new SessionManager({
      checkInterval: 100, // Fast interval for testing
      warningThreshold: 1000, // 1 second for testing
      autoRefresh: true
    });

    // Mock session data
    mockSession = {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
      user: {
        id: 'mock-user-id',
        email: 'test@example.com'
      }
    };

    // Mock document.addEventListener for activity tracking
    vi.spyOn(document, 'addEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    sessionManager.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('initializeSession', () => {
    it('should initialize session successfully when session exists', async () => {
      // Arrange
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Act
      await sessionManager.initializeSession();

      // Assert
      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(consoleSpy.log).toHaveBeenCalledWith('🔐 SessionManager: Session initialized successfully');
    });

    it('should handle no session gracefully', async () => {
      // Arrange
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      // Act
      await sessionManager.initializeSession();

      // Assert
      expect(supabase.auth.getSession).toHaveBeenCalled();
      const status = sessionManager.getSessionStatus();
      expect(status.isActive).toBe(false);
    });

    it('should throw error when session initialization fails', async () => {
      // Arrange
      const mockError = new Error('Session initialization failed');
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: mockError
      });

      // Act & Assert
      await expect(sessionManager.initializeSession()).rejects.toThrow('Session initialization failed');
    });
  });

  describe('validateSession', () => {
    it('should return true for valid session', async () => {
      // Arrange
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Act
      const result = await sessionManager.validateSession();

      // Assert
      expect(result).toBe(true);
    });

    it('should return false when no session exists', async () => {
      // Arrange
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null
      });

      const expiredCallback = vi.fn();
      sessionManager.onSessionExpired(expiredCallback);

      // Act
      const result = await sessionManager.validateSession();

      // Assert
      expect(result).toBe(false);
      expect(expiredCallback).toHaveBeenCalledWith({ reason: 'no_session' });
    });

    it('should attempt refresh for expired token when auto-refresh is enabled', async () => {
      // Arrange
      const expiredSession = {
        ...mockSession,
        expires_at: Math.floor(Date.now() / 1000) - 100 // Expired 100 seconds ago
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: expiredSession },
        error: null
      });

      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Act
      const result = await sessionManager.validateSession();

      // Assert
      expect(result).toBe(true);
      expect(supabase.auth.refreshSession).toHaveBeenCalled();
    });

    it('should return false for expired token when auto-refresh is disabled', async () => {
      // Arrange
      const sessionManagerNoRefresh = new SessionManager({ autoRefresh: false });
      const expiredSession = {
        ...mockSession,
        expires_at: Math.floor(Date.now() / 1000) - 100 // Expired 100 seconds ago
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: expiredSession },
        error: null
      });

      const expiredCallback = vi.fn();
      sessionManagerNoRefresh.onSessionExpired(expiredCallback);

      // Act
      const result = await sessionManagerNoRefresh.validateSession();

      // Assert
      expect(result).toBe(false);
      expect(expiredCallback).toHaveBeenCalledWith({ reason: 'token_expired' });
      
      sessionManagerNoRefresh.destroy();
    });
  });

  describe('refreshSession', () => {
    it('should refresh session successfully', async () => {
      // Arrange
      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const refreshedCallback = vi.fn();
      sessionManager.onSessionRefreshed(refreshedCallback);

      // Act
      const result = await sessionManager.refreshSession();

      // Assert
      expect(result).toBe(true);
      expect(refreshedCallback).toHaveBeenCalledWith({ session: mockSession });
      expect(supabase.auth.refreshSession).toHaveBeenCalled();
    });

    it('should handle refresh failure', async () => {
      // Arrange
      const mockError = new Error('Refresh failed');
      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: null },
        error: mockError
      });

      const expiredCallback = vi.fn();
      sessionManager.onSessionExpired(expiredCallback);

      // Act
      const result = await sessionManager.refreshSession();

      // Assert
      expect(result).toBe(false);
      expect(expiredCallback).toHaveBeenCalled();
    });
  });

  describe('terminateSession', () => {
    it('should terminate session successfully', async () => {
      // Arrange
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

      const terminatedCallback = vi.fn();
      sessionManager.on('terminated', terminatedCallback);

      // Act
      await sessionManager.terminateSession();

      // Assert
      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(terminatedCallback).toHaveBeenCalledWith({ reason: 'manual' });
      const status = sessionManager.getSessionStatus();
      expect(status.isActive).toBe(false);
    });

    it('should handle sign out error gracefully', async () => {
      // Arrange
      const mockError = new Error('Sign out failed');
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: mockError });

      const terminatedCallback = vi.fn();
      sessionManager.on('terminated', terminatedCallback);

      // Act
      await sessionManager.terminateSession();

      // Assert
      expect(terminatedCallback).toHaveBeenCalledWith({ reason: 'manual' });
      const status = sessionManager.getSessionStatus();
      expect(status.isActive).toBe(false);
    });
  });

  describe('getSessionStatus', () => {
    it('should return inactive status when no session', () => {
      // Act
      const status = sessionManager.getSessionStatus();

      // Assert
      expect(status.isActive).toBe(false);
      expect(status.expiresAt).toBeNull();
      expect(status.timeUntilExpiry).toBe(0);
      expect(status.accessToken).toBeNull();
      expect(status.refreshToken).toBeNull();
    });

    it('should return active status for valid session', async () => {
      // Arrange
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();

      // Act
      const status = sessionManager.getSessionStatus();

      // Assert
      expect(status.isActive).toBe(true);
      expect(status.expiresAt).toBeInstanceOf(Date);
      expect(status.timeUntilExpiry).toBeGreaterThan(0);
      expect(status.accessToken).toBe('mock-access-token');
      expect(status.refreshToken).toBe('mock-refresh-token');
    });
  });

  describe('session monitoring', () => {
    it('should start and stop monitoring', () => {
      // Act
      sessionManager.startSessionMonitoring();
      sessionManager.stopSessionMonitoring();

      // Assert - verify monitoring state through behavior
      expect(sessionManager['sessionCheckInterval']).toBeNull();
    });

    it('should not start monitoring if already active', () => {
      // Act
      sessionManager.startSessionMonitoring();
      const firstInterval = sessionManager['sessionCheckInterval'];
      sessionManager.startSessionMonitoring();
      const secondInterval = sessionManager['sessionCheckInterval'];

      // Assert - interval should be the same (not recreated)
      expect(firstInterval).toBe(secondInterval);
      expect(firstInterval).not.toBeNull();
    });
  });

  describe('event handling', () => {
    it('should add and remove event listeners', () => {
      // Arrange
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      // Act
      sessionManager.on('expired', callback1);
      sessionManager.on('expired', callback2);
      sessionManager.off('expired', callback1);

      // Emit event to test remaining listener
      sessionManager['emit']('expired', { test: true });

      // Assert
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith({ test: true });
    });

    it('should handle event listener errors gracefully', () => {
      // Arrange
      const errorCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();

      sessionManager.on('expired', errorCallback);
      sessionManager.on('expired', normalCallback);

      // Act
      sessionManager['emit']('expired', { test: true });

      // Assert - both callbacks should be called despite error in first one
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });
  });

  describe('activity tracking', () => {
    it('should update activity timestamp', () => {
      // Arrange
      const initialActivity = sessionManager.getSessionStatus().lastActivity;

      // Wait a bit to ensure timestamp difference
      vi.advanceTimersByTime(10);

      // Act
      sessionManager.updateActivity();

      // Assert
      const newActivity = sessionManager.getSessionStatus().lastActivity;
      expect(newActivity.getTime()).toBeGreaterThan(initialActivity.getTime());
    });
  });

  describe('cleanup', () => {
    it('should clean up resources on destroy', () => {
      // Arrange
      sessionManager.startSessionMonitoring();
      sessionManager.on('expired', vi.fn());

      // Act
      sessionManager.destroy();

      // Assert
      expect(sessionManager['sessionCheckInterval']).toBeNull();
      expect(sessionManager['eventListeners'].size).toBe(0);
      expect(sessionManager['currentSession']).toBeNull();
    });
  });

  describe('session expiration warning', () => {
    it('should emit expiring event when session is about to expire', async () => {
      // Arrange
      const soonToExpireSession = {
        ...mockSession,
        expires_at: Math.floor(Date.now() / 1000) + 1 // Expires in 1 second
      };

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: soonToExpireSession },
        error: null
      });

      const expiringCallback = vi.fn();
      sessionManager.onSessionExpiring(expiringCallback);

      // Act
      await sessionManager['checkSessionStatus']();

      // Assert
      expect(expiringCallback).toHaveBeenCalled();
      expect(expiringCallback).toHaveBeenCalledWith(expect.objectContaining({
        timeLeft: expect.any(Number)
      }));
    });
  });
});