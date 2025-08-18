import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SessionProvider, useSessionContext } from '../SessionContext';
import { SessionManager, SessionStatus } from '@/services/SessionManager';
import { TokenRefreshService } from '@/services/TokenRefreshService';
import React from 'react';

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    session: { access_token: 'mock-token' },
    isInitialized: true,
  }),
}));

// Mock the services
const mockSessionManager = {
  getSessionStatus: vi.fn(),
  initializeSession: vi.fn(),
  destroy: vi.fn(),
  onSessionExpiring: vi.fn(),
  onSessionExpired: vi.fn(),
  onSessionRefreshed: vi.fn(),
  on: vi.fn(),
} as unknown as SessionManager;

const mockTokenRefreshService = {
  destroy: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
} as unknown as TokenRefreshService;

// Mock console methods
const consoleSpy = {
  log: vi.spyOn(console, 'log'),
  error: vi.spyOn(console, 'error'),
  warn: vi.spyOn(console, 'warn')
};

// Test component that uses the context
function TestComponent() {
  const context = useSessionContext();
  
  return (
    <div>
      <div data-testid="initialized">{context.isInitialized.toString()}</div>
      <div data-testid="session-active">{context.sessionStatus.isActive.toString()}</div>
      <div data-testid="session-expiring">{context.isSessionExpiring.toString()}</div>
      <div data-testid="expiration-time">{context.expirationWarningTime?.toString() || 'null'}</div>
    </div>
  );
}

describe('SessionContext', () => {
  let mockSessionStatus: SessionStatus;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Mock console methods
    consoleSpy.log.mockImplementation(() => {});
    consoleSpy.error.mockImplementation(() => {});
    consoleSpy.warn.mockImplementation(() => {});

    // Mock session status
    mockSessionStatus = {
      isActive: true,
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      timeUntilExpiry: 3600000,
      lastActivity: new Date(),
      refreshToken: 'mock-refresh-token',
      accessToken: 'mock-access-token'
    };

    vi.mocked(mockSessionManager.getSessionStatus).mockReturnValue(mockSessionStatus);
    vi.mocked(mockSessionManager.initializeSession).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should throw error when useSessionContext is used outside provider', () => {
    // Arrange & Act & Assert
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useSessionContext must be used within a SessionProvider');
  });

  it('should provide session context values', async () => {
    // Act
    render(
      <SessionProvider 
        sessionManager={mockSessionManager}
        tokenRefreshService={mockTokenRefreshService}
      >
        <TestComponent />
      </SessionProvider>
    );

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true');
      expect(screen.getByTestId('session-active')).toHaveTextContent('true');
      expect(screen.getByTestId('session-expiring')).toHaveTextContent('false');
      expect(screen.getByTestId('expiration-time')).toHaveTextContent('null');
    });

    expect(mockSessionManager.initializeSession).toHaveBeenCalled();
  });

  it('should initialize session management', async () => {
    // Act
    render(
      <SessionProvider 
        sessionManager={mockSessionManager}
        tokenRefreshService={mockTokenRefreshService}
      >
        <TestComponent />
      </SessionProvider>
    );

    // Assert
    await waitFor(() => {
      expect(mockSessionManager.onSessionExpiring).toHaveBeenCalled();
      expect(mockSessionManager.onSessionExpired).toHaveBeenCalled();
      expect(mockSessionManager.onSessionRefreshed).toHaveBeenCalled();
      expect(mockSessionManager.on).toHaveBeenCalledWith('validated', expect.any(Function));
      expect(mockSessionManager.on).toHaveBeenCalledWith('terminated', expect.any(Function));
    });
  });

  it('should handle session expiring event', async () => {
    // Arrange
    let expiringCallback: (data: { timeLeft: number }) => void;
    vi.mocked(mockSessionManager.onSessionExpiring).mockImplementation((callback) => {
      expiringCallback = callback;
    });

    // Act
    render(
      <SessionProvider 
        sessionManager={mockSessionManager}
        tokenRefreshService={mockTokenRefreshService}
      >
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true');
    });

    // Simulate session expiring event
    expiringCallback!({ timeLeft: 300000 }); // 5 minutes

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId('session-expiring')).toHaveTextContent('true');
      expect(screen.getByTestId('expiration-time')).toHaveTextContent('300000');
    });
  });

  it('should handle session expired event', async () => {
    // Arrange
    let expiredCallback: (data: any) => void;
    vi.mocked(mockSessionManager.onSessionExpired).mockImplementation((callback) => {
      expiredCallback = callback;
    });

    // Act
    render(
      <SessionProvider 
        sessionManager={mockSessionManager}
        tokenRefreshService={mockTokenRefreshService}
      >
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true');
    });

    // Simulate session expired event
    expiredCallback!({ reason: 'expired' });

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId('session-expiring')).toHaveTextContent('false');
      expect(screen.getByTestId('expiration-time')).toHaveTextContent('null');
    });
  });

  it('should handle session refreshed event', async () => {
    // Arrange
    let refreshedCallback: (data: any) => void;
    vi.mocked(mockSessionManager.onSessionRefreshed).mockImplementation((callback) => {
      refreshedCallback = callback;
    });

    // Act
    render(
      <SessionProvider 
        sessionManager={mockSessionManager}
        tokenRefreshService={mockTokenRefreshService}
      >
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true');
    });

    // Simulate session refreshed event
    refreshedCallback!({ session: { access_token: 'new-token' } });

    // Assert
    await waitFor(() => {
      expect(screen.getByTestId('session-expiring')).toHaveTextContent('false');
      expect(screen.getByTestId('expiration-time')).toHaveTextContent('null');
    });
  });

  it('should handle token refresh events', async () => {
    // Arrange
    const tokenCallbacks: { [key: string]: (data: any) => void } = {};
    vi.mocked(mockTokenRefreshService.on).mockImplementation((event, callback) => {
      tokenCallbacks[event] = callback;
    });

    // Act
    render(
      <SessionProvider 
        sessionManager={mockSessionManager}
        tokenRefreshService={mockTokenRefreshService}
      >
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true');
    });

    // Simulate token events
    tokenCallbacks['refreshed']({ tokens: { accessToken: 'new-token' } });
    tokenCallbacks['synced']({ tokens: { accessToken: 'synced-token' } });
    tokenCallbacks['failed']({ error: new Error('Token failed') });

    // Assert - Events should be handled without errors
    expect(mockTokenRefreshService.on).toHaveBeenCalledWith('refreshed', expect.any(Function));
    expect(mockTokenRefreshService.on).toHaveBeenCalledWith('synced', expect.any(Function));
    expect(mockTokenRefreshService.on).toHaveBeenCalledWith('failed', expect.any(Function));
  });

  it('should update session status periodically', async () => {
    // Act
    render(
      <SessionProvider 
        sessionManager={mockSessionManager}
        tokenRefreshService={mockTokenRefreshService}
      >
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true');
    });

    // Fast-forward time to trigger periodic update
    vi.advanceTimersByTime(10000); // 10 seconds

    // Assert
    expect(mockSessionManager.getSessionStatus).toHaveBeenCalledTimes(2); // Initial + periodic
  });

  it('should handle initialization error gracefully', async () => {
    // Arrange
    vi.mocked(mockSessionManager.initializeSession).mockRejectedValue(new Error('Init failed'));

    // Act
    render(
      <SessionProvider 
        sessionManager={mockSessionManager}
        tokenRefreshService={mockTokenRefreshService}
      >
        <TestComponent />
      </SessionProvider>
    );

    // Assert - Should still initialize despite error
    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true');
    });
  });

  it('should cleanup on unmount', async () => {
    // Act
    const { unmount } = render(
      <SessionProvider 
        sessionManager={mockSessionManager}
        tokenRefreshService={mockTokenRefreshService}
      >
        <TestComponent />
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true');
    });

    unmount();

    // Assert
    expect(mockSessionManager.destroy).toHaveBeenCalled();
    expect(mockTokenRefreshService.destroy).toHaveBeenCalled();
  });

  it('should create default services when none provided', async () => {
    // Act
    render(
      <SessionProvider>
        <TestComponent />
      </SessionProvider>
    );

    // Assert - Should not throw and should initialize
    await waitFor(() => {
      expect(screen.getByTestId('initialized')).toHaveTextContent('true');
    });
  });
});