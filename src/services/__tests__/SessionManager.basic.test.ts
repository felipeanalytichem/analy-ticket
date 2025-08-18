/**
 * Basic unit tests for SessionManager
 * Tests core session management functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../SessionManager';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn()
    }
  }
}));

describe('SessionManager - Basic Tests', () => {
  let sessionManager: SessionManager;
  let mockSupabase: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Get the mocked supabase instance
    const { supabase } = await import('../../lib/supabase');
    mockSupabase = supabase;
    
    sessionManager = new SessionManager();
  });

  afterEach(() => {
    sessionManager.destroy?.();
    vi.useRealTimers();
  });

  describe('Session Initialization', () => {
    it('should initialize successfully', () => {
      expect(sessionManager).toBeDefined();
      expect(typeof sessionManager.initializeSession).toBe('function');
      expect(typeof sessionManager.validateSession).toBe('function');
      expect(typeof sessionManager.refreshSession).toBe('function');
    });

    it('should have correct initial state', () => {
      const status = sessionManager.getSessionStatus();
      expect(status.isActive).toBe(false);
      expect(status.accessToken).toBe(null);
      expect(status.refreshToken).toBe(null);
    });
  });

  describe('Session Validation', () => {
    it('should validate session with valid session data', async () => {
      const mockSession = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'test-user' }
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const isValid = await sessionManager.validateSession();
      expect(isValid).toBe(true);
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
      mockSupabase.auth.getSession.mockRejectedValue(new Error('Network error'));

      const isValid = await sessionManager.validateSession();
      expect(isValid).toBe(false);
    });
  });

  describe('Session Refresh', () => {
    it('should refresh session successfully', async () => {
      const mockSession = {
        access_token: 'new-token',
        refresh_token: 'new-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: 'bearer',
        user: { id: 'test-user' }
      };

      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await sessionManager.refreshSession();
      expect(result).toBe(true);
    });

    it('should handle refresh failure', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Refresh failed')
      });

      const result = await sessionManager.refreshSession();
      expect(result).toBe(false);
    });
  });

  describe('Session Monitoring', () => {
    it('should start monitoring', () => {
      sessionManager.startSessionMonitoring();
      // The actual implementation doesn't expose isMonitoring property
      // We can test that it doesn't throw and the interval is set
      expect(() => sessionManager.startSessionMonitoring()).not.toThrow();
    });

    it('should stop monitoring', () => {
      sessionManager.startSessionMonitoring();
      sessionManager.stopSessionMonitoring();
      // Test that stopping doesn't throw
      expect(() => sessionManager.stopSessionMonitoring()).not.toThrow();
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
        error: new Error('Signout failed')
      });

      // The actual implementation logs the error but doesn't throw
      await expect(sessionManager.terminateSession()).resolves.not.toThrow();
    });
  });

  describe('Event Callbacks', () => {
    it('should register session expiring callback', () => {
      const callback = vi.fn();
      sessionManager.onSessionExpiring(callback);

      // Trigger expiring event by calling the private method through the public interface
      // We need to simulate this through the monitoring system
      sessionManager['showExpirationWarning'](300000);
      expect(callback).toHaveBeenCalledWith({ timeLeft: 300000 });
    });

    it('should register session expired callback', () => {
      const callback = vi.fn();
      sessionManager.onSessionExpired(callback);

      // Trigger expired event
      sessionManager['handleSessionExpired']();
      expect(callback).toHaveBeenCalled();
    });
  });
});