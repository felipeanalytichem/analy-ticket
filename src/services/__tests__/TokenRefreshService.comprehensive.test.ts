/**
 * Comprehensive unit tests for TokenRefreshService
 * Tests automatic token refresh and cross-tab synchronization
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenRefreshService } from '../TokenRefreshService';
import {
  createMockSupabaseClient,
  MockBroadcastChannel,
  mockSession,
  mockExpiredSession,
  TimerUtils,
  ErrorSimulator,
  PerformanceTestUtils,
  MemoryTestUtils
} from '../../test/utils/sessionTestUtils';

// Mock Supabase
const mockSupabase = createMockSupabaseClient();
vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabase
}));

// Mock BroadcastChannel
global.BroadcastChannel = MockBroadcastChannel as any;

describe('TokenRefreshService', () => {
  let tokenRefreshService: TokenRefreshService;
  let memoryTracker: ReturnType<typeof MemoryTestUtils.trackTimers>;

  beforeEach(() => {
    vi.clearAllMocks();
    TimerUtils.useFakeTimers();
    memoryTracker = MemoryTestUtils.trackTimers();
    tokenRefreshService = new TokenRefreshService();
  });

  afterEach(() => {
    tokenRefreshService.cleanup?.();
    memoryTracker.cleanup();
    TimerUtils.useRealTimers();
  });

  describe('Token Refresh', () => {
    it('should refresh tokens successfully', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const tokenPair = await tokenRefreshService.refreshTokens();

      expect(tokenPair.accessToken).toBe(mockSession.access_token);
      expect(tokenPair.refreshToken).toBe(mockSession.refresh_token);
      expect(tokenPair.expiresIn).toBe(mockSession.expires_in);
      expect(tokenPair.tokenType).toBe(mockSession.token_type);
    });

    it('should handle refresh failure', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: ErrorSimulator.authError()
      });

      await expect(tokenRefreshService.refreshTokens()).rejects.toThrow('Token refresh failed');
    });

    it('should handle network errors during refresh', async () => {
      mockSupabase.auth.refreshSession.mockRejectedValue(ErrorSimulator.networkError());

      await expect(tokenRefreshService.refreshTokens()).rejects.toThrow();
    });

    it('should prevent concurrent refresh attempts', async () => {
      let resolveFirst: (value: any) => void;
      const firstPromise = new Promise(resolve => {
        resolveFirst = resolve;
      });

      mockSupabase.auth.refreshSession
        .mockImplementationOnce(() => firstPromise)
        .mockResolvedValue({
          data: { session: mockSession },
          error: null
        });

      // Start two concurrent refresh attempts
      const promise1 = tokenRefreshService.refreshTokens();
      const promise2 = tokenRefreshService.refreshTokens();

      // Resolve the first request
      resolveFirst!({
        data: { session: mockSession },
        error: null
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toEqual(result2);
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    });

    it('should sync tokens across tabs after refresh', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const syncSpy = vi.spyOn(tokenRefreshService, 'syncTokensAcrossTabs');
      await tokenRefreshService.refreshTokens();

      expect(syncSpy).toHaveBeenCalledWith(expect.objectContaining({
        accessToken: mockSession.access_token,
        refreshToken: mockSession.refresh_token
      }));
    });

    it('should schedule next refresh after successful refresh', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const scheduleSpy = vi.spyOn(tokenRefreshService, 'scheduleRefresh');
      await tokenRefreshService.refreshTokens();

      expect(scheduleSpy).toHaveBeenCalledWith(mockSession.expires_in);
    });
  });

  describe('Scheduled Refresh', () => {
    it('should schedule refresh correctly', () => {
      const expiresIn = 3600; // 1 hour
      tokenRefreshService.scheduleRefresh(expiresIn);

      expect(memoryTracker.getActiveTimers().size).toBe(1);
    });

    it('should cancel existing scheduled refresh when scheduling new one', () => {
      tokenRefreshService.scheduleRefresh(3600);
      tokenRefreshService.scheduleRefresh(1800);

      expect(memoryTracker.getActiveTimers().size).toBe(1);
    });

    it('should not schedule refresh for expired tokens', () => {
      tokenRefreshService.scheduleRefresh(-100); // Already expired

      expect(memoryTracker.getActiveTimers().size).toBe(0);
    });

    it('should execute scheduled refresh', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const refreshSpy = vi.spyOn(tokenRefreshService, 'refreshTokens');
      
      // Schedule refresh for 5 minutes before expiry (300 seconds)
      tokenRefreshService.scheduleRefresh(600); // 10 minutes total
      
      // Advance time to trigger refresh (5 minutes)
      TimerUtils.advanceTimersByTime(300 * 1000);

      expect(refreshSpy).toHaveBeenCalled();
    });

    it('should cancel scheduled refresh', () => {
      tokenRefreshService.scheduleRefresh(3600);
      tokenRefreshService.cancelScheduledRefresh();

      expect(memoryTracker.getActiveTimers().size).toBe(0);
    });

    it('should handle cancellation when no refresh is scheduled', () => {
      expect(() => tokenRefreshService.cancelScheduledRefresh()).not.toThrow();
    });
  });

  describe('Cross-Tab Synchronization', () => {
    it('should sync tokens across tabs', () => {
      const tokenPair = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
        tokenType: 'bearer'
      };

      const broadcastSpy = vi.spyOn(tokenRefreshService['broadcastChannel']!, 'postMessage');
      tokenRefreshService.syncTokensAcrossTabs(tokenPair);

      expect(broadcastSpy).toHaveBeenCalledWith({
        type: 'TOKEN_UPDATED',
        tokens: tokenPair
      });
    });

    it('should handle incoming token updates from other tabs', () => {
      const callback = vi.fn();
      tokenRefreshService.onTokensUpdated(callback);

      const tokenPair = {
        accessToken: 'updated-access-token',
        refreshToken: 'updated-refresh-token',
        expiresIn: 3600,
        tokenType: 'bearer'
      };

      // Simulate message from another tab
      const event = new MessageEvent('message', {
        data: {
          type: 'TOKEN_UPDATED',
          tokens: tokenPair
        }
      });

      tokenRefreshService['broadcastChannel']!.dispatchEvent(event);

      expect(callback).toHaveBeenCalledWith(tokenPair);
    });

    it('should ignore non-token messages', () => {
      const callback = vi.fn();
      tokenRefreshService.onTokensUpdated(callback);

      // Simulate non-token message
      const event = new MessageEvent('message', {
        data: {
          type: 'OTHER_MESSAGE',
          data: 'some data'
        }
      });

      tokenRefreshService['broadcastChannel']!.dispatchEvent(event);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle multiple token update callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      
      tokenRefreshService.onTokensUpdated(callback1);
      tokenRefreshService.onTokensUpdated(callback2);

      const tokenPair = {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresIn: 3600,
        tokenType: 'bearer'
      };

      const event = new MessageEvent('message', {
        data: {
          type: 'TOKEN_UPDATED',
          tokens: tokenPair
        }
      });

      tokenRefreshService['broadcastChannel']!.dispatchEvent(event);

      expect(callback1).toHaveBeenCalledWith(tokenPair);
      expect(callback2).toHaveBeenCalledWith(tokenPair);
    });

    it('should handle BroadcastChannel creation failure gracefully', () => {
      // Mock BroadcastChannel constructor to throw
      const originalBroadcastChannel = global.BroadcastChannel;
      global.BroadcastChannel = vi.fn().mockImplementation(() => {
        throw new Error('BroadcastChannel not supported');
      });

      expect(() => new TokenRefreshService()).not.toThrow();

      global.BroadcastChannel = originalBroadcastChannel;
    });
  });

  describe('Waiting for Refresh', () => {
    it('should wait for ongoing refresh to complete', async () => {
      let resolveRefresh: (value: any) => void;
      const refreshPromise = new Promise(resolve => {
        resolveRefresh = resolve;
      });

      mockSupabase.auth.refreshSession.mockImplementationOnce(() => refreshPromise);

      // Start first refresh
      const promise1 = tokenRefreshService.refreshTokens();
      
      // Start second refresh while first is ongoing
      const promise2 = tokenRefreshService.refreshTokens();

      // Resolve the refresh
      resolveRefresh!({
        data: { session: mockSession },
        error: null
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toEqual(result2);
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    });

    it('should handle refresh failure while waiting', async () => {
      let rejectRefresh: (error: any) => void;
      const refreshPromise = new Promise((resolve, reject) => {
        rejectRefresh = reject;
      });

      mockSupabase.auth.refreshSession.mockImplementationOnce(() => refreshPromise);

      const promise1 = tokenRefreshService.refreshTokens();
      const promise2 = tokenRefreshService.refreshTokens();

      rejectRefresh!(ErrorSimulator.authError());

      await expect(Promise.all([promise1, promise2])).rejects.toThrow();
    });
  });

  describe('Performance', () => {
    it('should refresh tokens within performance threshold', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const { time } = await PerformanceTestUtils.measureAsyncExecutionTime(
        () => tokenRefreshService.refreshTokens()
      );

      expect(time).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle high-frequency refresh requests efficiently', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const promises = Array(100).fill(null).map(() => tokenRefreshService.refreshTokens());
      const results = await Promise.all(promises);

      expect(results.every(result => result.accessToken === mockSession.access_token)).toBe(true);
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    });

    it('should sync tokens across tabs efficiently', () => {
      const tokenPair = {
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresIn: 3600,
        tokenType: 'bearer'
      };

      const { time } = PerformanceTestUtils.measureExecutionTime(
        () => tokenRefreshService.syncTokensAcrossTabs(tokenPair)
      );

      expect(time).toBeLessThan(10); // Should complete within 10ms
    });
  });

  describe('Memory Management', () => {
    it('should not leak timers when scheduling/canceling refresh', () => {
      const initialTimers = memoryTracker.getActiveTimers().size;

      tokenRefreshService.scheduleRefresh(3600);
      tokenRefreshService.cancelScheduledRefresh();

      expect(memoryTracker.getActiveTimers().size).toBe(initialTimers);
    });

    it('should cleanup resources properly', () => {
      tokenRefreshService.scheduleRefresh(3600);
      tokenRefreshService.cleanup?.();

      expect(memoryTracker.getActiveTimers().size).toBe(0);
    });

    it('should handle cleanup when no resources are active', () => {
      expect(() => tokenRefreshService.cleanup?.()).not.toThrow();
    });

    it('should close BroadcastChannel on cleanup', () => {
      const closeSpy = vi.spyOn(tokenRefreshService['broadcastChannel']!, 'close');
      tokenRefreshService.cleanup?.();

      expect(closeSpy).toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed refresh with exponential backoff', async () => {
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

      const tokenPair = await tokenRefreshService.refreshTokens();

      expect(tokenPair.accessToken).toBe(mockSession.access_token);
      expect(callCount).toBe(3);
    });

    it('should give up after maximum retry attempts', async () => {
      mockSupabase.auth.refreshSession.mockRejectedValue(ErrorSimulator.networkError());

      await expect(tokenRefreshService.refreshTokens()).rejects.toThrow();
    });

    it('should handle different error types during refresh', async () => {
      // Test auth error - should not retry
      mockSupabase.auth.refreshSession.mockRejectedValue(ErrorSimulator.authError());
      await expect(tokenRefreshService.refreshTokens()).rejects.toThrow();

      // Test network error - should retry
      let callCount = 0;
      mockSupabase.auth.refreshSession.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(ErrorSimulator.networkError());
        }
        return Promise.resolve({
          data: { session: mockSession },
          error: null
        });
      });

      const tokenPair = await tokenRefreshService.refreshTokens();
      expect(tokenPair.accessToken).toBe(mockSession.access_token);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing session data in refresh response', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      await expect(tokenRefreshService.refreshTokens()).rejects.toThrow('Token refresh failed');
    });

    it('should handle malformed session data', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: {} as any },
        error: null
      });

      await expect(tokenRefreshService.refreshTokens()).rejects.toThrow();
    });

    it('should handle BroadcastChannel message errors', () => {
      const callback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      
      tokenRefreshService.onTokensUpdated(callback);

      const event = new MessageEvent('message', {
        data: {
          type: 'TOKEN_UPDATED',
          tokens: {
            accessToken: 'test',
            refreshToken: 'test',
            expiresIn: 3600,
            tokenType: 'bearer'
          }
        }
      });

      expect(() => {
        tokenRefreshService['broadcastChannel']!.dispatchEvent(event);
      }).not.toThrow(); // Should handle callback errors gracefully
    });

    it('should handle rapid schedule/cancel operations', () => {
      expect(() => {
        for (let i = 0; i < 10; i++) {
          tokenRefreshService.scheduleRefresh(3600);
          tokenRefreshService.cancelScheduledRefresh();
        }
      }).not.toThrow();
    });

    it('should handle refresh during scheduled refresh execution', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Schedule a refresh
      tokenRefreshService.scheduleRefresh(600);
      
      // Manually trigger refresh before scheduled one
      const manualRefresh = tokenRefreshService.refreshTokens();
      
      // Advance time to trigger scheduled refresh
      TimerUtils.advanceTimersByTime(300 * 1000);
      
      await manualRefresh;

      // Should not cause conflicts
      expect(mockSupabase.auth.refreshSession).toHaveBeenCalled();
    });
  });
});