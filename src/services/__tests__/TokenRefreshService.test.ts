import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TokenRefreshService, TokenPair } from '../TokenRefreshService';
import { supabase } from '@/lib/supabase';

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      refreshSession: vi.fn(),
    }
  }
}));

// Mock BroadcastChannel
class MockBroadcastChannel {
  private listeners: Array<(event: any) => void> = [];
  
  constructor(public name: string) {}
  
  addEventListener(type: string, listener: (event: any) => void) {
    this.listeners.push(listener);
  }
  
  postMessage(data: any) {
    // Simulate message to other tabs
    setTimeout(() => {
      this.listeners.forEach(listener => {
        listener({ data });
      });
    }, 0);
  }
  
  close() {
    this.listeners = [];
  }
}

// Mock console methods
const consoleSpy = {
  log: vi.spyOn(console, 'log'),
  error: vi.spyOn(console, 'error'),
  warn: vi.spyOn(console, 'warn')
};

describe('TokenRefreshService', () => {
  let tokenRefreshService: TokenRefreshService;
  let mockTokenPair: TokenPair;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Mock console methods
    consoleSpy.log.mockImplementation(() => {});
    consoleSpy.error.mockImplementation(() => {});
    consoleSpy.warn.mockImplementation(() => {});

    // Mock BroadcastChannel globally
    global.BroadcastChannel = MockBroadcastChannel as any;

    // Create a fresh instance for each test
    tokenRefreshService = new TokenRefreshService({
      refreshBufferTime: 300, // 5 minutes
      maxRetryAttempts: 3,
      retryDelay: 1000,
      enableCrossTabSync: true
    });

    // Mock token pair
    mockTokenPair = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresIn: 3600, // 1 hour
      tokenType: 'bearer'
    };
  });

  afterEach(() => {
    tokenRefreshService.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('refreshTokens', () => {
    it('should refresh tokens successfully', async () => {
      // Arrange
      const mockSession = {
        access_token: mockTokenPair.accessToken,
        refresh_token: mockTokenPair.refreshToken,
        expires_in: mockTokenPair.expiresIn,
        token_type: mockTokenPair.tokenType
      };

      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const refreshedCallback = vi.fn();
      tokenRefreshService.on('refreshed', refreshedCallback);

      // Act
      const result = await tokenRefreshService.refreshTokens();

      // Assert
      expect(result).toEqual(mockTokenPair);
      expect(refreshedCallback).toHaveBeenCalledWith({ tokens: mockTokenPair });
      expect(supabase.auth.refreshSession).toHaveBeenCalled();
    });

    it('should handle refresh failure', async () => {
      // Arrange
      const mockError = new Error('Refresh failed');
      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: null },
        error: mockError
      });

      // Act & Assert
      await expect(tokenRefreshService.refreshTokens()).rejects.toThrow('Token refresh failed: Refresh failed');
    });

    it('should handle concurrent refresh requests', async () => {
      // Arrange
      const mockSession = {
        access_token: mockTokenPair.accessToken,
        refresh_token: mockTokenPair.refreshToken,
        expires_in: mockTokenPair.expiresIn,
        token_type: mockTokenPair.tokenType
      };

      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Act - Start two concurrent refresh requests
      const promise1 = tokenRefreshService.refreshTokens();
      const promise2 = tokenRefreshService.refreshTokens();

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Assert - Both should return the same result and API should be called only once
      expect(result1).toEqual(mockTokenPair);
      expect(result2).toEqual(mockTokenPair);
      expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('scheduleRefresh', () => {
    it('should schedule refresh before token expiry', () => {
      // Arrange
      const expiresIn = 600; // 10 minutes
      const expectedRefreshIn = (600 - 300) * 1000; // 5 minutes before expiry

      // Act
      tokenRefreshService.scheduleRefresh(expiresIn);

      // Assert
      const status = tokenRefreshService.getRefreshStatus();
      expect(status.hasScheduledRefresh).toBe(true);
    });

    it('should refresh immediately if token expires soon', async () => {
      // Arrange
      const expiresIn = 60; // 1 minute (less than buffer time)
      
      const mockSession = {
        access_token: mockTokenPair.accessToken,
        refresh_token: mockTokenPair.refreshToken,
        expires_in: mockTokenPair.expiresIn,
        token_type: mockTokenPair.tokenType
      };

      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      // Act
      tokenRefreshService.scheduleRefresh(expiresIn);

      // Fast-forward only the immediate timeout
      await vi.advanceTimersByTimeAsync(1);

      // Assert
      expect(supabase.auth.refreshSession).toHaveBeenCalled();
    });

    it('should cancel previous scheduled refresh', () => {
      // Act
      tokenRefreshService.scheduleRefresh(600);
      const firstStatus = tokenRefreshService.getRefreshStatus();
      
      tokenRefreshService.scheduleRefresh(700);
      const secondStatus = tokenRefreshService.getRefreshStatus();

      // Assert
      expect(firstStatus.hasScheduledRefresh).toBe(true);
      expect(secondStatus.hasScheduledRefresh).toBe(true);
    });
  });

  describe('cancelScheduledRefresh', () => {
    it('should cancel scheduled refresh', () => {
      // Arrange
      tokenRefreshService.scheduleRefresh(600);
      expect(tokenRefreshService.getRefreshStatus().hasScheduledRefresh).toBe(true);

      // Act
      tokenRefreshService.cancelScheduledRefresh();

      // Assert
      expect(tokenRefreshService.getRefreshStatus().hasScheduledRefresh).toBe(false);
    });
  });

  describe('token validation', () => {
    it('should detect expired tokens', () => {
      // Arrange
      const expiredTime = Math.floor(Date.now() / 1000) - 100; // 100 seconds ago

      // Act
      const isExpired = tokenRefreshService.isTokenExpired(expiredTime);

      // Assert
      expect(isExpired).toBe(true);
    });

    it('should detect valid tokens', () => {
      // Arrange
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      // Act
      const isExpired = tokenRefreshService.isTokenExpired(futureTime);

      // Assert
      expect(isExpired).toBe(false);
    });

    it('should detect tokens that need refresh', () => {
      // Arrange
      const soonToExpire = Math.floor(Date.now() / 1000) + 200; // 200 seconds from now (less than 5 min buffer)

      // Act
      const needsRefresh = tokenRefreshService.needsRefresh(soonToExpire);

      // Assert
      expect(needsRefresh).toBe(true);
    });

    it('should detect tokens that do not need refresh', () => {
      // Arrange
      const farFuture = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now

      // Act
      const needsRefresh = tokenRefreshService.needsRefresh(farFuture);

      // Assert
      expect(needsRefresh).toBe(false);
    });
  });

  describe('cross-tab synchronization', () => {
    it('should broadcast token updates to other tabs', () => {
      // Arrange
      const broadcastSpy = vi.spyOn(tokenRefreshService['broadcastChannel']!, 'postMessage');

      // Act
      tokenRefreshService.syncTokensAcrossTabs(mockTokenPair);

      // Assert
      expect(broadcastSpy).toHaveBeenCalledWith({
        type: 'TOKEN_UPDATED',
        tokens: mockTokenPair,
        timestamp: expect.any(Number)
      });
    });

    it('should handle token updates from other tabs', async () => {
      // Arrange
      const syncedCallback = vi.fn();
      tokenRefreshService.on('synced', syncedCallback);

      // Mock the refresh session to avoid infinite loops
      vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
        data: { 
          session: {
            access_token: mockTokenPair.accessToken,
            refresh_token: mockTokenPair.refreshToken,
            expires_in: mockTokenPair.expiresIn,
            token_type: mockTokenPair.tokenType
          }
        },
        error: null
      });

      // Simulate receiving a message from another tab
      const broadcastChannel = tokenRefreshService['broadcastChannel']!;
      
      // Act
      broadcastChannel.postMessage({
        type: 'TOKEN_UPDATED',
        tokens: mockTokenPair,
        timestamp: Date.now()
      });

      // Wait for async message handling
      await vi.advanceTimersByTimeAsync(1);

      // Assert
      expect(syncedCallback).toHaveBeenCalledWith({ tokens: mockTokenPair });
    });
  });

  describe('retry logic', () => {
    it('should handle retry configuration', () => {
      // Arrange
      const customService = new TokenRefreshService({
        maxRetryAttempts: 5,
        retryDelay: 2000
      });

      // Act
      const status = customService.getRefreshStatus();

      // Assert
      expect(status.retryCount).toBe(0);
      expect(status.isRefreshing).toBe(false);

      customService.destroy();
    });

    it('should track retry attempts', async () => {
      // Arrange
      const mockError = new Error('Network error');
      vi.mocked(supabase.auth.refreshSession).mockRejectedValue(mockError);

      // Act
      try {
        await tokenRefreshService.refreshTokens();
      } catch (error) {
        // Expected to fail
      }

      // Assert - Initial attempt should have been made
      expect(supabase.auth.refreshSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('event handling', () => {
    it('should add and remove event listeners', () => {
      // Arrange
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      // Act
      tokenRefreshService.on('refreshed', callback1);
      tokenRefreshService.on('refreshed', callback2);
      tokenRefreshService.off('refreshed', callback1);

      // Emit event to test remaining listener
      tokenRefreshService['emit']('refreshed', { test: true });

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

      tokenRefreshService.on('refreshed', errorCallback);
      tokenRefreshService.on('refreshed', normalCallback);

      // Act
      tokenRefreshService['emit']('refreshed', { test: true });

      // Assert
      expect(errorCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled();
    });

    it('should support onTokensUpdated convenience method', () => {
      // Arrange
      const callback = vi.fn();
      tokenRefreshService.onTokensUpdated(callback);

      // Act
      tokenRefreshService['emit']('refreshed', { tokens: mockTokenPair });
      tokenRefreshService['emit']('synced', { tokens: mockTokenPair });

      // Assert
      expect(callback).toHaveBeenCalledTimes(2);
    });
  });

  describe('getRefreshStatus', () => {
    it('should return current refresh status', () => {
      // Act
      const status = tokenRefreshService.getRefreshStatus();

      // Assert
      expect(status).toEqual({
        isRefreshing: false,
        retryCount: 0,
        hasScheduledRefresh: false
      });
    });

    it('should reflect refreshing state', async () => {
      // Arrange
      let resolveRefresh: (value: any) => void;
      const refreshPromise = new Promise(resolve => {
        resolveRefresh = resolve;
      });

      vi.mocked(supabase.auth.refreshSession).mockImplementation(() => refreshPromise);

      // Act
      const tokenRefreshPromise = tokenRefreshService.refreshTokens();
      const statusDuringRefresh = tokenRefreshService.getRefreshStatus();
      
      // Resolve the refresh
      resolveRefresh!({
        data: { 
          session: {
            access_token: mockTokenPair.accessToken,
            refresh_token: mockTokenPair.refreshToken,
            expires_in: mockTokenPair.expiresIn,
            token_type: mockTokenPair.tokenType
          }
        },
        error: null
      });
      
      await tokenRefreshPromise;
      const statusAfterRefresh = tokenRefreshService.getRefreshStatus();

      // Assert
      expect(statusDuringRefresh.isRefreshing).toBe(true);
      expect(statusAfterRefresh.isRefreshing).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('should clean up resources on destroy', () => {
      // Arrange
      tokenRefreshService.scheduleRefresh(600);
      tokenRefreshService.on('refreshed', vi.fn());

      // Act
      tokenRefreshService.destroy();

      // Assert
      const status = tokenRefreshService.getRefreshStatus();
      expect(status.hasScheduledRefresh).toBe(false);
      expect(status.isRefreshing).toBe(false);
      expect(status.retryCount).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should use custom configuration', () => {
      // Arrange
      const customService = new TokenRefreshService({
        refreshBufferTime: 600, // 10 minutes
        maxRetryAttempts: 5,
        retryDelay: 2000,
        enableCrossTabSync: false
      });

      // Act
      const needsRefresh = customService.needsRefresh(Math.floor(Date.now() / 1000) + 500); // 500 seconds

      // Assert
      expect(needsRefresh).toBe(true); // Should need refresh with 10-minute buffer

      customService.destroy();
    });
  });
});