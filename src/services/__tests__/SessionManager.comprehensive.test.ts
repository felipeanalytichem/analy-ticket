/**
 * Comprehensive unit tests for SessionManager
 * Tests all session lifecycle management functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../SessionManager';
import {
  createMockSupabaseClient,
  mockSession,
  mockExpiredSession,
  mockExpiringSession,
  TimerUtils,
  ErrorSimulator,
  PerformanceTestUtils,
  MemoryTestUtils
} from '../../test/utils/sessionTestUtils';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: createMockSupabaseClient()
}));

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let memoryTracker: ReturnType<typeof MemoryTestUtils.trackTimers>;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(async () => {
    vi.clearAllMocks();
    TimerUtils.useFakeTimers();
    memoryTracker = MemoryTestUtils.trackTimers();
    
    // Get the mocked supabase instance
    const { supabase } = await import('../../lib/supabase');
    mockSupabase = supabase as any;
    
    sessionManager = new SessionManager();
  });

  afterEach(() => {
    sessionManager.cleanup?.();
    memoryTracker.cleanup();
    TimerUtils.useRealTimers();
  });

  describe('Session Initialization', () => {
    it('should initialize session successfully with valid session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();

      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
      expect(sessionManager.getSessionStatus().isActive).toBe(true);
    });

    it('should handle initialization with no session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      await sessionManager.initializeSession();

      expect(sessionManager.getSessionStatus().isActive).toBe(false);
    });

    it('should handle initialization errors gracefully', async () => {
      mockSupabase.auth.getSession.mockRejectedValue(ErrorSimulator.authError());

      await expect(sessionManager.initializeSession()).rejects.toThrow();
    });

    it('should start session monitoring after successful initialization', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const startMonitoringSpy = vi.spyOn(sessionManager, 'startSessionMonitoring');
      await sessionManager.initializeSession();

      expect(startMonitoringSpy).toHaveBeenCalled();
    });
  });

  describe('Session Validation', () => {
    it('should validate active session successfully', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const isValid = await sessionManager.validateSession();

      expect(isValid).toBe(true);
      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
    });

    it('should return false for expired session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockExpiredSession },
        error: null
      });

      const refreshSpy = vi.spyOn(sessionManager, 'refreshSession').mockResolvedValue(false);
      const isValid = await sessionManager.validateSession();

      expect(isValid).toBe(false);
      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should return false for no session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const isValid = await sessionManager.validateSession();

      expect(isValid).toBe(false);
    });

    it('should handle validation errors', async () => {
      mockSupabase.auth.getSession.mockRejectedValue(ErrorSimulator.networkError());

      const isValid = await sessionManager.validateSession();

      expect(isValid).toBe(false);
    });

    it('should attempt refresh for near-expired sessions', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockExpiringSession },
        error: null
      });

      const refreshSpy = vi.spyOn(sessionManager, 'refreshSession').mockResolvedValue(true);
      const isValid = await sessionManager.validateSession();

      expect(refreshSpy).toHaveBeenCalled();
      expect(isValid).toBe(true);
    });
  });

  describe('Session Refresh', () => {
    it('should refresh session successfully', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await sessionManager.refreshSession();

      expect(result).toBe(true);
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalled();
    });

    it('should handle refresh failure', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: ErrorSimulator.authError()
      });

      const handleExpiredSpy = vi.spyOn(sessionManager, 'handleSessionExpired');
      const result = await sessionManager.refreshSession();

      expect(result).toBe(false);
      expect(handleExpiredSpy).toHaveBeenCalled();
    });

    it('should handle refresh network errors', async () => {
      mockSupabase.auth.refreshSession.mockRejectedValue(ErrorSimulator.networkError());

      const result = await sessionManager.refreshSession();

      expect(result).toBe(false);
    });

    it('should schedule next refresh after successful refresh', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const scheduleRefreshSpy = vi.spyOn(sessionManager, 'scheduleTokenRefresh');
      await sessionManager.refreshSession();

      expect(scheduleRefreshSpy).toHaveBeenCalledWith(mockSession);
    });

    it('should notify listeners of successful refresh', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const callback = vi.fn();
      sessionManager.onSessionRefreshed(callback);

      await sessionManager.refreshSession();

      expect(callback).toHaveBeenCalledWith(mockSession);
    });
  });

  describe('Session Monitoring', () => {
    it('should start session monitoring', () => {
      sessionManager.startSessionMonitoring();

      expect(memoryTracker.getActiveTimers().size).toBeGreaterThan(0);
    });

    it('should stop session monitoring', () => {
      sessionManager.startSessionMonitoring();
      sessionManager.stopSessionMonitoring();

      expect(memoryTracker.getActiveTimers().size).toBe(0);
    });

    it('should check session status periodically', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      sessionManager.startSessionMonitoring();
      
      // Advance timer to trigger check
      TimerUtils.advanceTimersByTime(30000); // 30 seconds

      expect(mockSupabase.auth.getSession).toHaveBeenCalled();
    });

    it('should show expiration warning when session is expiring', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockExpiringSession },
        error: null
      });

      const showWarningSpy = vi.spyOn(sessionManager, 'showExpirationWarning');
      sessionManager.startSessionMonitoring();
      
      TimerUtils.advanceTimersByTime(30000);

      expect(showWarningSpy).toHaveBeenCalled();
    });

    it('should handle expired session during monitoring', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockExpiredSession },
        error: null
      });

      const refreshSpy = vi.spyOn(sessionManager, 'refreshSession').mockResolvedValue(false);
      sessionManager.startSessionMonitoring();
      
      TimerUtils.advanceTimersByTime(30000);

      expect(refreshSpy).toHaveBeenCalled();
    });
  });

  describe('Session Termination', () => {
    it('should terminate session successfully', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      await sessionManager.terminateSession();

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should handle termination errors', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ 
        error: ErrorSimulator.authError() 
      });

      await expect(sessionManager.terminateSession()).rejects.toThrow();
    });

    it('should stop monitoring when terminating session', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      sessionManager.startSessionMonitoring();
      await sessionManager.terminateSession();

      expect(memoryTracker.getActiveTimers().size).toBe(0);
    });

    it('should clear session data on termination', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      await sessionManager.terminateSession();

      expect(sessionManager.getSessionStatus().isActive).toBe(false);
    });
  });

  describe('Event Handling', () => {
    it('should register session expiring callback', () => {
      const callback = vi.fn();
      sessionManager.onSessionExpiring(callback);

      // Trigger expiring event
      sessionManager.showExpirationWarning(300000); // 5 minutes

      expect(callback).toHaveBeenCalledWith(300000);
    });

    it('should register session expired callback', () => {
      const callback = vi.fn();
      sessionManager.onSessionExpired(callback);

      // Trigger expired event
      sessionManager.handleSessionExpired();

      expect(callback).toHaveBeenCalled();
    });

    it('should register session refreshed callback', () => {
      const callback = vi.fn();
      sessionManager.onSessionRefreshed(callback);

      // Trigger refreshed event
      sessionManager.notifySessionRefreshed(mockSession);

      expect(callback).toHaveBeenCalledWith(mockSession);
    });

    it('should handle multiple callbacks for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      sessionManager.onSessionExpired(callback1);
      sessionManager.onSessionExpired(callback2);

      sessionManager.handleSessionExpired();

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });
  });

  describe('Session Status', () => {
    it('should return correct session status for active session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      await sessionManager.initializeSession();
      const status = sessionManager.getSessionStatus();

      expect(status.isActive).toBe(true);
      expect(status.accessToken).toBe(mockSession.access_token);
      expect(status.refreshToken).toBe(mockSession.refresh_token);
    });

    it('should return correct session status for inactive session', () => {
      const status = sessionManager.getSessionStatus();

      expect(status.isActive).toBe(false);
      expect(status.accessToken).toBe('');
      expect(status.refreshToken).toBe('');
    });

    it('should calculate time until expiry correctly', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockExpiringSession },
        error: null
      });

      await sessionManager.initializeSession();
      const status = sessionManager.getSessionStatus();

      expect(status.timeUntilExpiry).toBeGreaterThan(0);
      expect(status.timeUntilExpiry).toBeLessThanOrEqual(300000); // 5 minutes
    });
  });

  describe('Performance', () => {
    it('should initialize session within performance threshold', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(
        () => sessionManager.initializeSession()
      );

      expect(time).toBeLessThan(100); // Should complete within 100ms
    });

    it('should validate session within performance threshold', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(
        () => sessionManager.validateSession()
      );

      expect(time).toBeLessThan(50); // Should complete within 50ms
    });

    it('should handle multiple concurrent refresh attempts efficiently', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const promises = Array(10).fill(null).map(() => sessionManager.refreshSession());
      const results = await Promise.all(promises);

      expect(results.every(result => result === true)).toBe(true);
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalledTimes(1); // Should deduplicate
    });
  });

  describe('Memory Management', () => {
    it('should not leak timers when starting/stopping monitoring', () => {
      const initialTimers = memoryTracker.getActiveTimers().size;

      sessionManager.startSessionMonitoring();
      sessionManager.stopSessionMonitoring();

      expect(memoryTracker.getActiveTimers().size).toBe(initialTimers);
    });

    it('should cleanup resources on termination', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({ error: null });

      sessionManager.startSessionMonitoring();
      await sessionManager.terminateSession();

      expect(memoryTracker.getActiveTimers().size).toBe(0);
    });

    it('should handle cleanup when no resources are active', () => {
      expect(() => sessionManager.cleanup?.()).not.toThrow();
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed operations with exponential backoff', async () => {
      let callCount = 0;
      mockSupabase.auth.refreshSession.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(ErrorSimulator.networkError());
        }
        return Promise.resolve({
          data: { session: mockSession },
          error: null
        });
      });

      const result = await sessionManager.refreshSession();

      expect(result).toBe(true);
      expect(callCount).toBe(3);
    });

    it('should give up after maximum retry attempts', async () => {
      mockSupabase.auth.refreshSession.mockRejectedValue(ErrorSimulator.networkError());

      const result = await sessionManager.refreshSession();

      expect(result).toBe(false);
    });

    it('should handle different error types appropriately', async () => {
      // Test auth error
      mockSupabase.auth.refreshSession.mockRejectedValue(ErrorSimulator.authError());
      let result = await sessionManager.refreshSession();
      expect(result).toBe(false);

      // Test network error
      mockSupabase.auth.refreshSession.mockRejectedValue(ErrorSimulator.networkError());
      result = await sessionManager.refreshSession();
      expect(result).toBe(false);

      // Test timeout error
      mockSupabase.auth.refreshSession.mockRejectedValue(ErrorSimulator.timeoutError());
      result = await sessionManager.refreshSession();
      expect(result).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle session with missing expiration time', async () => {
      const sessionWithoutExpiry = { ...mockSession, expires_at: undefined };
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: sessionWithoutExpiry },
        error: null
      });

      const isValid = await sessionManager.validateSession();

      expect(isValid).toBe(true); // Should assume valid if no expiry
    });

    it('should handle malformed session data', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: {} as any },
        error: null
      });

      const isValid = await sessionManager.validateSession();

      expect(isValid).toBe(false);
    });

    it('should handle rapid start/stop monitoring calls', () => {
      expect(() => {
        sessionManager.startSessionMonitoring();
        sessionManager.startSessionMonitoring(); // Should not create duplicate timers
        sessionManager.stopSessionMonitoring();
        sessionManager.stopSessionMonitoring(); // Should not error
      }).not.toThrow();
    });

    it('should handle session refresh during active monitoring', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      sessionManager.startSessionMonitoring();
      await sessionManager.refreshSession();

      // Should not interfere with monitoring
      expect(memoryTracker.getActiveTimers().size).toBeGreaterThan(0);
    });
  });
});